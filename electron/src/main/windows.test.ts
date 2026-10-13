import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { EventEmitter } from 'node:events';

// Just enough of Electron for windows.ts. A window's page starts loading when
// loadURL is called and "loads" 10 ms later, which is when it emits
// ready-to-show. Tests play the page's part in saying it's listening.
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  // What windows.ts registers with ipcMain, by channel.
  const listeners = new Map<string, (...args: unknown[]) => unknown>();
  const register = (channel: string, listener: (...args: unknown[]) => unknown) => void listeners.set(channel, listener);
  let nextId = 1;
  class FakeWebContents extends EventEmitter {
    id = nextId++;
    sent: unknown[][] = [];
    openHandler: unknown = null;
    destroyed = false;
    send(...args: unknown[]) {
      this.sent.push(args);
    }
    isDestroyed() {
      return this.destroyed;
    }
    setWindowOpenHandler(handler: unknown) {
      this.openHandler = handler;
    }
  }
  class FakeBrowserWindow extends EventEmitter {
    static all: FakeBrowserWindow[] = [];
    static focused: FakeBrowserWindow | null = null;
    webContents = new FakeWebContents();
    destroyed = false;
    visible = false;
    shown = false;
    constructor(public options: { x?: number; y?: number; width: number; height: number }) {
      super();
      FakeBrowserWindow.all.push(this);
    }
    loadURL() {
      this.webContents.emit('did-start-loading');
      setTimeout(() => {
        if (this.destroyed) return;
        this.emit('ready-to-show');
      }, 10);
    }
    loadFile() {
      this.loadURL();
    }
    show() {
      if (this.destroyed) return;
      this.visible = true;
      this.shown = true;
      this.emit('show');
    }
    focus() {
      FakeBrowserWindow.focused = this;
      this.emit('focus');
    }
    moveTop() {
      FakeBrowserWindow.focused = this;
    }
    restore() {
      this.visible = true;
    }
    isMinimized() {
      return false;
    }
    isVisible() {
      return this.visible;
    }
    isDestroyed() {
      return this.destroyed;
    }
    // A window given no position is centered on the 1440×900 screen, as Electron does.
    getNormalBounds() {
      const { width, height } = this.options;
      const { x = Math.round((1440 - width) / 2), y = Math.round(25 + (875 - height) / 2) } = this.options;
      return { x, y, width, height };
    }
    close() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.webContents.destroyed = true;
      this.visible = false;
      setTimeout(() => this.emit('closed'), 0);
    }
    static getFocusedWindow() {
      return FakeBrowserWindow.focused && !FakeBrowserWindow.focused.destroyed ? FakeBrowserWindow.focused : null;
    }
    static getAllWindows() {
      return FakeBrowserWindow.all.filter((w) => !w.destroyed);
    }
    static fromWebContents(wc: unknown) {
      return FakeBrowserWindow.all.find((w) => w.webContents === wc) ?? null;
    }
  }
  const workArea = { x: 0, y: 25, width: 1440, height: 875 };
  return {
    app: {
      getPath: () => process.env.EMDY_TEST_USER_DATA,
      addRecentDocument: () => undefined,
    },
    BrowserWindow: FakeBrowserWindow,
    ipcMain: { handle: register, on: register, listeners },
    screen: {
      getAllDisplays: () => [{ workArea }],
      getPrimaryDisplay: () => ({ workArea }),
      getDisplayMatching: () => ({ workArea }),
    },
  };
});

vi.mock('./window-theme', () => ({ getWindowBackgroundColor: () => '#F5F3EF' }));

interface FakeWindow extends EventEmitter {
  webContents: EventEmitter & { sent: unknown[][] };
  options: { x?: number; y?: number; width: number; height: number };
  destroyed: boolean;
  shown: boolean;
  close(): void;
  getNormalBounds(): { x: number; y: number; width: number; height: number };
}

interface FakeWindowClass {
  all: FakeWindow[];
  focused: FakeWindow | null;
}

interface FakeIpcMain {
  listeners: Map<string, (event: { sender: unknown }, ...args: unknown[]) => unknown>;
}

const realStat = fsp.stat;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let windows: typeof import('./windows');
let Fake: FakeWindowClass;
let ipcMain: FakeIpcMain;
let dir: string;

const live = () => Fake.all.filter((w) => !w.destroyed);
const sent = (win: FakeWindow, channel: string) => win.webContents.sent.filter(([c]) => c === channel);
// The page has registered its listeners and says so, as App.tsx does.
const reportReady = (win: FakeWindow) => ipcMain.listeners.get('window:ready')?.({ sender: win.webContents });
// Files dropped on a window, as the preload sends them.
const drop = (win: FakeWindow, paths: string[]) => ipcMain.listeners.get('drop:open')?.({ sender: win.webContents }, paths);

function file(name: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `# ${name}\n`);
  return filePath;
}

function writeSession(saved: object[]) {
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ version: 1, windows: saved }));
}

// Reading anything named slow.md never finishes, like a file on a drive that won't wake up.
function makeSlowFilesHang() {
  vi.spyOn(fsp, 'stat').mockImplementation(((p: fs.PathLike) =>
    String(p).endsWith('slow.md') ? new Promise(() => undefined) : realStat(p)) as unknown as typeof fsp.stat);
}

beforeEach(async () => {
  // realpath: os.tmpdir() is under /var, a symlink to /private/var.
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-windows-')));
  process.env.EMDY_TEST_USER_DATA = dir;
  vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
  vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
  vi.resetModules();
  const electron = await import('electron');
  Fake = electron.BrowserWindow as unknown as FakeWindowClass;
  Fake.all.length = 0;
  Fake.focused = null;
  ipcMain = electron.ipcMain as unknown as FakeIpcMain;
  windows = await import('./windows');
  windows.registerWindowHandlers();
});

afterEach(() => {
  // Stops this test's pending saves before its folder goes away.
  windows.prepareForQuit();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name));
  fs.rmdirSync(dir);
});

describe('restoring windows at launch', () => {
  it('opens every saved window right away, even while one is slow to load', async () => {
    const fast = file('fast.md');
    file('slow.md');
    writeSession([
      { dirPath: null, filePath: fast, scrollTop: 0, bounds: { x: 40, y: 60, width: 900, height: 600 } },
      { dirPath: null, filePath: path.join(dir, 'slow.md'), scrollTop: 0, bounds: { x: 200, y: 100, width: 900, height: 600 } },
    ]);
    makeSlowFilesHang();
    void windows.startWindows([]);
    await sleep(100);
    expect(live()).toHaveLength(2);
    reportReady(live()[0]);
    expect(sent(live()[0], 'window:restore')).toHaveLength(1);
  });

  it('lets the Dock icon open a window while a saved window is still loading', async () => {
    file('slow.md');
    writeSession([{ dirPath: null, filePath: path.join(dir, 'slow.md'), scrollTop: 0, bounds: null }]);
    makeSlowFilesHang();
    await Promise.race([windows.startWindows([]), sleep(500)]);
    for (const win of live()) win.close();
    await sleep(20);
    windows.handleActivate();
    expect(live()).toHaveLength(1);
  });

  it('replaces a saved window whose file is gone with a welcome window, without showing it', async () => {
    const gone = path.join(dir, 'gone.md');
    writeSession([{ dirPath: null, filePath: gone, scrollTop: 0, bounds: null }]);
    // Settle the existence check without real I/O, so the window closes in the
    // turn it was created, before its page can load and show it.
    vi.spyOn(fsp, 'stat').mockImplementation(((p: fs.PathLike) =>
      String(p) === gone
        ? Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
        : realStat(p)) as unknown as typeof fsp.stat);
    await windows.startWindows([]);
    await sleep(50);
    expect(live()).toHaveLength(1);
    reportReady(live()[0]);
    expect(sent(live()[0], 'window:restore')).toHaveLength(0);
    expect(Fake.all.filter((w) => w.destroyed && w.shown)).toHaveLength(0);
  });

  it('keeps a saved window that is still loading in session.json when Emdy quits', async () => {
    const fast = file('fast.md');
    file('slow.md');
    const slow = path.join(dir, 'slow.md');
    writeSession([
      { dirPath: null, filePath: fast, scrollTop: 0, bounds: { x: 40, y: 60, width: 900, height: 600 } },
      { dirPath: null, filePath: slow, scrollTop: 300, bounds: { x: 200, y: 100, width: 900, height: 600 } },
    ]);
    makeSlowFilesHang();
    await Promise.race([windows.startWindows([]), sleep(500)]);
    windows.prepareForQuit();
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf-8'));
    expect(saved.windows.map((w: { filePath: string; scrollTop: number }) => [w.filePath, w.scrollTop]))
      .toEqual([[fast, 0], [slow, 300]]);
  });
});

describe('opening files from outside Emdy', () => {
  it('opens a file without waiting for a slower one that arrived first', async () => {
    await windows.startWindows([]);
    const fast = file('fast.md');
    file('slow.md');
    makeSlowFilesHang();
    void windows.openFromOutside(path.join(dir, 'slow.md'));
    void windows.openFromOutside(fast);
    await sleep(100);
    for (const win of live()) reportReady(win);
    const opened = live().filter((w) => sent(w, 'file:open').some(([, p]) => p === fast));
    expect(opened).toHaveLength(1);
    // slow.md arrived first, so it holds the welcome window.
    expect(opened[0]).not.toBe(Fake.all[0]);
  });

  it('gives the welcome window to the first of several files, even when it loads last', async () => {
    await windows.startWindows([]);
    const a = file('a.md');
    const b = file('b.md');
    vi.spyOn(fsp, 'stat').mockImplementation(((p: fs.PathLike) =>
      String(p) === a ? sleep(50).then(() => realStat(p)) : realStat(p)) as unknown as typeof fsp.stat);
    void windows.openFromOutside(a);
    void windows.openFromOutside(b);
    await sleep(200);
    for (const win of live()) reportReady(win);
    expect(sent(Fake.all[0], 'file:open').map(([, p]) => p)).toEqual([a]);
    expect(live()).toHaveLength(2);
  });

  it('opens each new window a step down and to the right of the one before, at its size', async () => {
    await windows.startWindows([]);
    const [welcome] = Fake.all;
    await windows.openFromOutside(file('a.md'));
    // The person made their reading window wider.
    Object.assign(welcome.options, { x: 220, y: 113, width: 1100 });
    void windows.openFromOutside(file('b.md'));
    void windows.openFromOutside(file('c.md'));
    await sleep(100);
    expect(live().map((w) => w.getNormalBounds())).toEqual([
      { x: 220, y: 113, width: 1100, height: 700 },
      { x: 244, y: 137, width: 1100, height: 700 },
      { x: 268, y: 161, width: 1100, height: 700 },
    ]);
  });

  it('still opens the first window centered', async () => {
    await windows.startWindows([]);
    expect(Fake.all[0].options.x).toBeUndefined();
    expect(Fake.all[0].options.y).toBeUndefined();
  });

  it("closes the window it opened when the file can't be read", async () => {
    await windows.startWindows([]);
    await windows.openFromOutside(file('a.md'));
    await expect(windows.openFromOutside(path.join(dir, 'gone.md'))).rejects.toThrow();
    await sleep(20);
    expect(live()).toHaveLength(1);
  });
});

describe("sending to a window's page", () => {
  it('holds what it sends until the page is listening, then sends it in order', async () => {
    await windows.startWindows([]);
    const [welcome] = live();
    const a = file('a.md');
    const b = file('b.md');
    // Dropped on the window before its page has registered its listeners.
    await drop(welcome, [a]);
    await drop(welcome, [b]);
    expect(welcome.webContents.sent).toEqual([]);
    reportReady(welcome);
    expect(welcome.webContents.sent).toEqual([
      ['file:open', a, '# a.md\n'],
      ['file:open', b, '# b.md\n'],
    ]);
  });

  it('sends straight away once the page is listening', async () => {
    await windows.startWindows([]);
    const [welcome] = live();
    reportReady(welcome);
    const a = file('a.md');
    await windows.openFromOutside(a);
    expect(welcome.webContents.sent).toEqual([['file:open', a, '# a.md\n']]);
  });

  it('holds what it sends again while the page reloads', async () => {
    await windows.startWindows([]);
    const [welcome] = live();
    reportReady(welcome);
    welcome.webContents.emit('did-start-loading');
    const a = file('a.md');
    await windows.openFromOutside(a);
    expect(welcome.webContents.sent).toEqual([]);
    reportReady(welcome);
    expect(welcome.webContents.sent).toEqual([['file:open', a, '# a.md\n']]);
  });

  it('sends only to the window whose page says it is listening', async () => {
    await windows.startWindows([]);
    const a = file('a.md');
    const b = file('b.md');
    await windows.openFromOutside(a);
    await windows.openFromOutside(b);
    const [first, second] = live();
    reportReady(second);
    expect(second.webContents.sent).toEqual([['file:open', b, '# b.md\n']]);
    expect(first.webContents.sent).toEqual([]);
    reportReady(first);
    expect(first.webContents.sent).toEqual([['file:open', a, '# a.md\n']]);
  });

  it('sends nothing more when the page says again that it is listening', async () => {
    await windows.startWindows([]);
    const [welcome] = live();
    const a = file('a.md');
    await windows.openFromOutside(a);
    reportReady(welcome);
    reportReady(welcome);
    expect(welcome.webContents.sent).toEqual([['file:open', a, '# a.md\n']]);
  });

  it('holds a menu event until the page is listening, then sends it once', () => {
    const { webContents } = windows.createAppWindow();
    const [win] = live();
    windows.sendWhenReadyTo(webContents, 'menu:event', 'find');
    expect(sent(win, 'menu:event')).toEqual([]);
    reportReady(win);
    expect(sent(win, 'menu:event')).toEqual([['menu:event', 'find']]);
  });

  it('sends nothing to a page that has been destroyed', () => {
    // Like Electron's, a destroyed page throws when its id is read or it's sent to.
    const destroyed = {
      isDestroyed: () => true,
      get id(): number {
        throw new TypeError('Object has been destroyed');
      },
      send() {
        throw new TypeError('Object has been destroyed');
      },
    };
    const info = { version: '1.9.0', notes: null };
    expect(() =>
      windows.sendWhenReadyTo(destroyed as unknown as Electron.WebContents, 'update:ready', info),
    ).not.toThrow();
  });
});

describe('the menu with no window open', () => {
  // Launch, then close every window, as ⌘W on the last one does.
  async function closeEveryWindow() {
    await windows.startWindows([]);
    for (const win of live()) win.close();
    await sleep(20);
  }

  it.each(['open', 'show-about', 'check-for-updates'])(
    'opens a welcome window for %s and sends it there once the page is listening',
    async (event) => {
      await closeEveryWindow();
      windows.sendMenuEventWithoutWindow(event);
      expect(live()).toHaveLength(1);
      const [welcome] = live();
      await vi.waitFor(() => expect(welcome.shown).toBe(true));
      expect(sent(welcome, 'menu:event')).toEqual([]);
      reportReady(welcome);
      expect(sent(welcome, 'menu:event')).toEqual([['menu:event', event]]);
    },
  );

  it('waits for the window to be on screen, since Open… shows its dialog on it', async () => {
    await closeEveryWindow();
    windows.sendMenuEventWithoutWindow('open');
    const [welcome] = live();
    reportReady(welcome);
    expect(sent(welcome, 'menu:event')).toEqual([]);
    await vi.waitFor(() => expect(sent(welcome, 'menu:event')).toEqual([['menu:event', 'open']]));
    expect(welcome.shown).toBe(true);
  });

  it('leaves menu items that act on a document alone', async () => {
    await closeEveryWindow();
    for (const event of ['export-pdf', 'print', 'find', 'zoom-in']) windows.sendMenuEventWithoutWindow(event);
    expect(live()).toHaveLength(0);
  });

  it('opens nothing while Emdy is launching, while a window is open, or once it is quitting', async () => {
    windows.sendMenuEventWithoutWindow('open');
    expect(Fake.all).toHaveLength(0);
    await windows.startWindows([]);
    windows.sendMenuEventWithoutWindow('open');
    expect(live()).toHaveLength(1);
    for (const win of live()) win.close();
    await sleep(20);
    windows.prepareForQuit();
    windows.sendMenuEventWithoutWindow('open');
    expect(live()).toHaveLength(0);
  });
});

describe('the menu follows the focused window', () => {
  // Stands in for index.ts's rebuildMenu, which asks focusedWindowHasFile each
  // time it runs.
  function watchRebuilds() {
    const rebuild = vi.fn(() => windows.focusedWindowHasFile());
    windows.onWindowFocus(rebuild);
    return rebuild;
  }

  it('is rebuilt for each window that takes focus', () => {
    // a shows a file; b is on the welcome screen.
    const a = windows.createAppWindow();
    const b = windows.createAppWindow();
    windows.setWindowHasFile(a.webContents, true);
    const rebuild = watchRebuilds();
    a.focus();
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(windows.focusedWindowHasFile()).toBe(true);
    b.focus();
    expect(rebuild).toHaveBeenCalledTimes(2);
    expect(windows.focusedWindowHasFile()).toBe(false);
  });

  it('is rebuilt without the last window once it closes', async () => {
    // No other window takes focus afterwards, so only the close can rebuild it.
    const a = windows.createAppWindow();
    windows.setWindowHasFile(a.webContents, true);
    const rebuild = watchRebuilds();
    a.focus();
    expect(windows.focusedWindowHasFile()).toBe(true);
    a.close();
    await sleep(10);
    expect(rebuild).toHaveBeenCalledTimes(2);
    expect(rebuild).toHaveLastReturnedWith(false);
    expect(windows.focusedWindowHasFile()).toBe(false);
  });
});
