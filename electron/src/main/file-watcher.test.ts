// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterEach, onTestFinished } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'chokidar';
import { registerFileWatcher } from './file-watcher';

type Handler = (event: { sender: FakeWebContents }, ...args: unknown[]) => unknown;
type FakeStats = { isFile(): boolean };
type Matcher = string | RegExp | ((p: string, stats?: FakeStats) => boolean);

interface FakeWatcher extends EventEmitter {
  readonly target: string;
  readonly options: { ignored?: Matcher | Matcher[] };
  closed: boolean;
}

const fakes = vi.hoisted(() => ({
  // What file-watcher.ts registers with ipcMain.handle, by channel.
  handlers: new Map<string, Handler>(),
  // Every watcher chokidar.watch has made, oldest first.
  watchers: [] as FakeWatcher[],
  // The test that uses real folders turns this on to get the real chokidar.
  useRealChokidar: false,
  realWatchers: [] as FSWatcher[],
  // The windows that are still open, for webContents.fromId.
  contents: new Map<number, FakeWebContents>(),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: Handler) => void fakes.handlers.set(channel, handler) },
  webContents: { fromId: (id: number) => fakes.contents.get(id) },
}));

// Just enough of chokidar: watch() returns a watcher the tests emit
// chokidar's events on, or the real chokidar's when a test asks for it.
vi.mock('chokidar', async (importOriginal) => {
  const real = await importOriginal<typeof import('chokidar')>();
  const { EventEmitter } = await import('node:events');
  class Watcher extends EventEmitter implements FakeWatcher {
    closed = false;
    constructor(readonly target: string, readonly options: FakeWatcher['options']) {
      super();
    }
    add() {
      return this;
    }
    unwatch() {
      return this;
    }
    close() {
      this.closed = true;
      return Promise.resolve();
    }
  }
  const watch = (target: string, options: FakeWatcher['options']) => {
    if (fakes.useRealChokidar) {
      const watcher = real.watch(target, options);
      fakes.realWatchers.push(watcher);
      return watcher;
    }
    const watcher = new Watcher(target, options);
    fakes.watchers.push(watcher);
    return watcher;
  };
  return { default: { watch }, watch };
});

vi.mock('./allowed-paths', () => ({ isPathAllowed: () => true }));
// A rescan finds one file in whichever folder it reads.
vi.mock('./scan-directory', () => ({
  scanDirectory: async (dir: string) => [{ name: 'new.md', path: `${dir}/new.md`, isDirectory: false }],
}));

let nextId = 1;

// A window's webContents: keeps what main sends it, and can be closed.
class FakeWebContents extends EventEmitter {
  readonly id = nextId++;
  readonly sent: unknown[][] = [];
  private destroyed = false;
  constructor() {
    super();
    fakes.contents.set(this.id, this);
  }
  send(...args: unknown[]) {
    this.sent.push(args);
  }
  isDestroyed() {
    return this.destroyed;
  }
  destroy() {
    this.destroyed = true;
    fakes.contents.delete(this.id);
    this.emit('destroyed');
  }
}

const windows: FakeWebContents[] = [];

function newWindow(): FakeWebContents {
  const wc = new FakeWebContents();
  windows.push(wc);
  return wc;
}

// Calls a file-watcher channel as the window `wc` would.
function invoke(channel: string, wc: FakeWebContents, ...args: unknown[]): unknown {
  const handler = fakes.handlers.get(channel);
  if (!handler) throw new Error(`${channel} is not registered`);
  return handler({ sender: wc }, ...args);
}

const FILE: FakeStats = { isFile: () => true };
const FOLDER: FakeStats = { isFile: () => false };

// Whether chokidar would skip `p` with this watcher's `ignored` option. It calls
// a function with the path, plus the stats once it has them, and tests a
// RegExp against the path.
function ignores(watcher: FakeWatcher, p: string, stats?: FakeStats): boolean {
  const matchers = [watcher.options.ignored ?? []].flat();
  return matchers.some((m) => (typeof m === 'function' ? m(p, stats) : m instanceof RegExp ? m.test(p) : m === p));
}

// A real folder and a symlink to it, both removed when the test ends.
function symlinkedFolder(): { real: string; link: string } {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-watch-')));
  onTestFinished(() => fs.rmSync(base, { recursive: true, force: true }));
  const real = path.join(base, 'real');
  const link = path.join(base, 'link');
  fs.mkdirSync(real);
  fs.symlinkSync(real, link);
  return { real, link };
}

const tooManyFiles = Object.assign(new Error('EMFILE: too many open files, watch'), { code: 'EMFILE' });

beforeAll(() => {
  registerFileWatcher();
});

afterEach(async () => {
  // Closing every window lets file-watcher.ts drop all it holds.
  for (const wc of windows.splice(0)) if (!wc.isDestroyed()) wc.destroy();
  fakes.watchers.length = 0;
  await Promise.all(fakes.realWatchers.splice(0).map((watcher) => watcher.close()));
  fakes.useRealChokidar = false;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('folder watching', () => {
  it('shares one watcher between the windows showing a folder and closes it when the last one leaves', () => {
    const [a, b, c] = [newWindow(), newWindow(), newWindow()];
    for (const wc of [a, b, c]) invoke('dir:watch', wc, '/notes');
    expect(fakes.watchers).toHaveLength(1);
    const [notes] = fakes.watchers;
    expect(notes.target).toBe('/notes');

    // A window leaves by opening another folder, by closing the folder, or by being closed.
    invoke('dir:watch', a, '/other');
    expect(notes.closed).toBe(false);
    invoke('dir:unwatch', b);
    expect(notes.closed).toBe(false);
    c.destroy();
    expect(notes.closed).toBe(true);
    expect(fakes.watchers[1].closed).toBe(false);

    // The next window to open the folder starts a new watcher.
    invoke('dir:watch', newWindow(), '/notes');
    expect(fakes.watchers).toHaveLength(3);
  });

  it('sends the rescanned folder to every window showing it, and still to the others after one closes', async () => {
    vi.useFakeTimers();
    const [a, b] = [newWindow(), newWindow()];
    invoke('dir:watch', a, '/notes');
    invoke('dir:watch', b, '/notes');
    const [notes] = fakes.watchers;
    const update = ['dir:entries-updated', [{ name: 'new.md', path: '/notes/new.md', isDirectory: false }]];

    notes.emit('add', '/notes/new.md');
    await vi.advanceTimersByTimeAsync(300);
    expect(a.sent).toEqual([update]);
    expect(b.sent).toEqual([update]);

    a.destroy();
    notes.emit('unlink', '/notes/new.md');
    await vi.advanceTimersByTimeAsync(300);
    expect(b.sent).toEqual([update, update]);
  });

  it('never ignores the folder it watches, even one named .claude or inside build/, and skips dot folders and build output below it', () => {
    invoke('dir:watch', newWindow(), '/Users/me/.claude');
    invoke('dir:watch', newWindow(), '/work/build/docs');
    const [claude, docs] = fakes.watchers;

    // chokidar asks about the folder itself before and after it stats it.
    expect(ignores(claude, '/Users/me/.claude')).toBe(false);
    expect(ignores(claude, '/Users/me/.claude', FOLDER)).toBe(false);
    expect(ignores(docs, '/work/build/docs', FOLDER)).toBe(false);
    expect(ignores(docs, '/work/build/docs/guide.md', FILE)).toBe(false);
    expect(ignores(claude, '/Users/me/.claude/projects', FOLDER)).toBe(false);
    expect(ignores(claude, '/Users/me/.claude/projects/notes.md', FILE)).toBe(false);

    for (const below of ['node_modules', '.git', '.obsidian', 'site/build', 'site/node_modules/pkg']) {
      expect(ignores(claude, `/Users/me/.claude/${below}`, FOLDER), below).toBe(true);
    }
    expect(ignores(claude, '/Users/me/.claude/.obsidian/notes.md', FILE)).toBe(true);
  });

  it('keeps the files MD_EXT matches and no others, with MD_EXT the only extension rule', () => {
    invoke('dir:watch', newWindow(), '/notes');
    const [notes] = fakes.watchers;
    for (const name of ['a.md', 'B.MD', 'c.markdown']) {
      expect(ignores(notes, `/notes/${name}`, FILE), name).toBe(false);
    }
    for (const name of ['d.txt', 'e.mdx', 'f.md.bak', 'g.png']) {
      expect(ignores(notes, `/notes/${name}`, FILE), name).toBe(true);
    }
    // A folder stays whatever its name, and so does a path chokidar hasn't statted yet.
    expect(ignores(notes, '/notes/v1.txt', FOLDER)).toBe(false);
    expect(ignores(notes, '/notes/d.txt')).toBe(false);

    const source = fs.readFileSync(path.join(__dirname, 'file-watcher.ts'), 'utf8');
    expect(source).not.toContain('MD_EXT_ONLY');
    expect(source.match(/\(md\|markdown\)/g)).toHaveLength(1);
  });

  it('watches the folder a symlinked folder leads to, and sends rescans of the path the window opened', async () => {
    const { real, link } = symlinkedFolder();
    vi.useFakeTimers();
    const wc = newWindow();
    invoke('dir:watch', wc, link);
    const [watcher] = fakes.watchers;
    expect(watcher.target).toBe(real);
    // The matcher is built for the folder chokidar watches.
    expect(ignores(watcher, real, FOLDER)).toBe(false);
    expect(ignores(watcher, path.join(real, 'node_modules'), FOLDER)).toBe(true);

    // chokidar reports the real path; the window keeps the one it opened.
    watcher.emit('add', path.join(real, 'new.md'));
    await vi.advanceTimersByTimeAsync(300);
    expect(wc.sent).toEqual([['dir:entries-updated', [{ name: 'new.md', path: `${link}/new.md`, isDirectory: false }]]]);
  });

  it('sees a new file in a folder opened through a symlink, with the real chokidar', async () => {
    const { real, link } = symlinkedFolder();
    fakes.useRealChokidar = true;
    const wc = newWindow();
    invoke('dir:watch', wc, link);
    const [watcher] = fakes.realWatchers;
    const added: string[] = [];
    let ready = false;
    watcher.on('add', (p) => added.push(p));
    watcher.once('ready', () => {
      ready = true;
    });
    await vi.waitFor(() => expect(ready).toBe(true), { timeout: 5000, interval: 20 });

    fs.writeFileSync(path.join(link, 'new.md'), '# New\n');
    await vi.waitFor(() => expect(added).toContain(path.join(real, 'new.md')), { timeout: 3000, interval: 20 });
    await vi.waitFor(
      () => expect(wc.sent).toContainEqual(['dir:entries-updated', [{ name: 'new.md', path: `${link}/new.md`, isDirectory: false }]]),
      { timeout: 3000, interval: 20 },
    );
  }, 15000);

  it('logs an error from a folder watcher and keeps watching', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    const wc = newWindow();
    invoke('dir:watch', wc, '/notes');
    const [notes] = fakes.watchers;

    expect(() => notes.emit('error', tooManyFiles)).not.toThrow();
    expect(logged).toHaveBeenCalledWith('Watching folder failed:', '/notes', tooManyFiles);
    expect(notes.closed).toBe(false);

    // Still the folder's watcher: another window shares it, and changes still arrive.
    invoke('dir:watch', newWindow(), '/notes');
    expect(fakes.watchers).toHaveLength(1);
    notes.emit('add', '/notes/new.md');
    await vi.advanceTimersByTimeAsync(300);
    expect(wc.sent).toHaveLength(1);
  });
});

describe('file watching', () => {
  it('tells the window that a file which comes back after a delete has changed, so it reloads', () => {
    const wc = newWindow();
    invoke('file:watch', wc, '/notes/a.md');
    const [file] = fakes.watchers;

    // Move to Trash, then Put Back: chokidar reports unlink, then add.
    file.emit('unlink', '/notes/a.md');
    file.emit('add', '/notes/a.md');
    expect(wc.sent).toEqual([
      ['file:deleted', '/notes/a.md'],
      ['file:changed', '/notes/a.md'],
    ]);
  });

  it('logs an error from a file watcher and keeps watching', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const wc = newWindow();
    invoke('file:watch', wc, '/notes/a.md');
    const [file] = fakes.watchers;

    expect(() => file.emit('error', tooManyFiles)).not.toThrow();
    expect(logged).toHaveBeenCalledWith('Watching file failed:', '/notes/a.md', tooManyFiles);
    expect(file.closed).toBe(false);
    file.emit('change', '/notes/a.md');
    expect(wc.sent).toEqual([['file:changed', '/notes/a.md']]);
  });
});
