import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, onTestFinished } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dialog } from 'electron';
import type { SearchResult } from '../renderer/lib/types';
import { registerFileHandlers } from './ipc-handlers';
import { addAllowedRoot } from './allowed-paths';
import { recentPaths } from './recents';
import { windowPaths } from './windows';

type Handler = (event: { sender: { id: number } }, ...args: unknown[]) => unknown;

// What ipc-handlers.ts registers with ipcMain.handle, by channel.
const handlers = vi.hoisted(() => new Map<string, Handler>());

vi.mock('electron', () => ({
  app: { getPath: (name: string) => (name === 'home' ? '/Users/me' : `/unexpected/${name}`) },
  ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  // The person cancels every Open dialog here; the tests read how it was opened.
  dialog: { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
  BrowserWindow: { fromWebContents: () => ({ appWindow: true }) },
  shell: {},
}));
// These reach Electron's app and windows as they load. The handlers tested here
// use none of them, apart from file:read counting an open, which does nothing
// here, and the Open dialogs asking what the window shows and what was opened
// recently.
vi.mock('./settings-store', () => ({ nudgeTrackFileOpen: vi.fn() }));
vi.mock('./recents', () => ({ noteRecent: vi.fn(), recentPaths: vi.fn(async () => []) }));
vi.mock('./windows', () => ({
  openPathInNewWindow: vi.fn(),
  windowPaths: vi.fn(() => ({ dirPath: null, filePath: null })),
}));

let dir: string;

function write(rel: string, text: string): string {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
}

// Invokes search:everything as the window with webContents id `sender` would.
function search(sender: number, query: unknown, scope: unknown, generation: unknown): Promise<SearchResult[] | null> {
  const handler = handlers.get('search:everything');
  if (!handler) throw new Error('search:everything is not registered');
  return Promise.resolve(handler({ sender: { id: sender } }, query, scope, generation)) as Promise<SearchResult[] | null>;
}

// Invokes file:read as a window's sidebar click or live reload would.
function read(filePath: unknown): Promise<string> {
  const handler = handlers.get('file:read');
  if (!handler) throw new Error('file:read is not registered');
  return Promise.resolve(handler({ sender: { id: 1 } }, filePath)) as Promise<string>;
}

// A slow drive, as in search.test.ts: every read takes a few milliseconds, and
// `third` settles when the third read starts.
function slowReads(): { count: () => number; third: Promise<void> } {
  const realReadFile = fsp.readFile;
  let reads = 0;
  let thirdStarted: () => void = () => undefined;
  const third = new Promise<void>((resolve) => {
    thirdStarted = resolve;
  });
  vi.spyOn(fsp, 'readFile').mockImplementation(((...args: Parameters<typeof fsp.readFile>) => {
    if (++reads === 3) thirdStarted();
    return new Promise((resolve) => setTimeout(resolve, 5)).then(() => realReadFile(...args));
  }) as unknown as typeof fsp.readFile);
  return { count: () => reads, third };
}

beforeAll(() => {
  registerFileHandlers();
});

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-ipc-search-')));
  addAllowedRoot(dir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('search:everything', () => {
  it('stops the search in flight when the same window sends an empty query, which reads nothing', async () => {
    for (let i = 0; i < 20; i++) write(`n${String(i).padStart(2, '0')}.md`, 'alpha\n');
    const reads = slowReads();
    const readdir = vi.spyOn(fsp, 'readdir');
    const pending = search(1, 'alpha', { rootPath: dir, filePath: null }, 1);
    await reads.third;
    const listed = readdir.mock.calls.length;
    // A cleared field or a closed palette sends this.
    expect(await search(1, '', { rootPath: null, filePath: null }, 2)).toEqual([]);
    expect(readdir.mock.calls.length).toBe(listed);
    expect(await pending).toBeNull();
    expect(reads.count()).toBe(3);
  });

  it('leaves the search in flight alone when the generation is not a number', async () => {
    for (let i = 0; i < 20; i++) write(`n${String(i).padStart(2, '0')}.md`, 'alpha\n');
    const reads = slowReads();
    const pending = search(2, 'alpha', { rootPath: dir, filePath: null }, 1);
    await reads.third;
    expect(await search(2, '', { rootPath: null, filePath: null }, 'two')).toEqual([]);
    expect((await pending)?.length).toBe(20);
  });

  it('returns nothing for a scope outside the opened folders, without listing it', async () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-ipc-outside-')));
    onTestFinished(() => fs.rmSync(outside, { recursive: true, force: true }));
    const secret = path.join(outside, 'secret.md');
    fs.writeFileSync(secret, 'alpha\n');
    const readdir = vi.spyOn(fsp, 'readdir');
    expect(await search(3, 'alpha', { rootPath: outside, filePath: secret }, 1)).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });

  it('searches a single open file only when it is Markdown or plain text', async () => {
    const env = write('.env', 'API_KEY=secret-value\n');
    const todo = write('todo.txt', 'API_KEY goes here\n');
    expect(await search(4, 'API_KEY', { rootPath: null, filePath: env }, 1)).toEqual([]);
    expect((await search(4, 'API_KEY', { rootPath: null, filePath: todo }, 2))?.map((r) => r.lineNumber)).toEqual([1]);
  });
});

describe('file:read', () => {
  it('serves Markdown and plain text from an opened folder, and refuses any other file in it', async () => {
    const notes = write('notes.md', '# Notes\n');
    const todo = write('todo.TXT', 'milk\n');
    const env = write('.env', 'API_KEY=secret-value\n');
    expect(await read(notes)).toBe('# Notes\n');
    expect(await read(todo)).toBe('milk\n');
    await expect(read(env)).rejects.toThrow('Access denied');
  });

  it('checks the file a link points at, so a document-named link to .env is refused', async () => {
    const notes = write('notes.md', '# Notes\n');
    write('.env', 'API_KEY=secret-value\n');
    const setup = path.join(dir, 'setup.md');
    fs.symlinkSync('.env', setup);
    const alias = path.join(dir, 'alias.md');
    fs.symlinkSync(notes, alias);
    await expect(read(setup)).rejects.toThrow('Access denied');
    expect(await read(alias)).toBe('# Notes\n');
  });
});

// Electron 43 and later start a dialog with no defaultPath in Downloads.
describe('the Open dialogs', () => {
  const channels = ['open:dialog', 'file:open-dialog', 'dir:open-dialog', 'open:dialog-in-new-window'];
  // The page of the window that asks.
  const sender = { id: 1 };
  let recentFolder: string;

  beforeEach(() => {
    // A folder opened recently. It counts only for a window that shows nothing.
    recentFolder = path.join(dir, 'recent');
    fs.mkdirSync(recentFolder);
    vi.mocked(recentPaths).mockResolvedValue([recentFolder]);
  });

  // Asks for the dialog as the window's page would, and gives the folder it
  // opened in.
  async function startFolder(channel: string): Promise<unknown> {
    vi.mocked(dialog.showOpenDialog).mockClear();
    vi.mocked(windowPaths).mockClear();
    await handlers.get(channel)?.({ sender });
    expect(windowPaths).toHaveBeenCalledWith(sender);
    // Called as showOpenDialog(window, options), which the typings list first.
    const [, options] = vi.mocked(dialog.showOpenDialog).mock.calls[0] as unknown as [unknown, Electron.OpenDialogOptions];
    return options.defaultPath;
  }

  it.each(channels)("%s opens in the window's folder", async (channel) => {
    vi.mocked(windowPaths).mockReturnValue({ dirPath: '/Users/me/notes', filePath: '/Users/me/notes/drafts/plan.md' });
    expect(await startFolder(channel)).toBe('/Users/me/notes');
  });

  it.each(channels)("%s opens in the folder of the window's file when no folder is open", async (channel) => {
    vi.mocked(windowPaths).mockReturnValue({ dirPath: null, filePath: '/Users/me/notes/drafts/plan.md' });
    expect(await startFolder(channel)).toBe('/Users/me/notes/drafts');
  });

  it.each(channels)('%s opens in the newest recent folder when the window shows nothing', async (channel) => {
    vi.mocked(windowPaths).mockReturnValue({ dirPath: null, filePath: null });
    expect(await startFolder(channel)).toBe(recentFolder);
  });

  it.each(channels)('%s opens in the folder of the newest recent file when the window shows nothing', async (channel) => {
    const plan = write('drafts/plan.md', '# Plan\n');
    vi.mocked(recentPaths).mockResolvedValue([plan, recentFolder]);
    vi.mocked(windowPaths).mockReturnValue({ dirPath: null, filePath: null });
    expect(await startFolder(channel)).toBe(path.join(dir, 'drafts'));
  });

  it.each(channels)('%s opens in the home folder when the window shows nothing and nothing is recent', async (channel) => {
    vi.mocked(recentPaths).mockResolvedValue([]);
    vi.mocked(windowPaths).mockReturnValue({ dirPath: null, filePath: null });
    expect(await startFolder(channel)).toBe('/Users/me');
  });
});
