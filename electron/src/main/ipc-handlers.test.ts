import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, onTestFinished } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SearchResult } from '../renderer/lib/types';
import { registerFileHandlers } from './ipc-handlers';
import { addAllowedRoot } from './allowed-paths';

type Handler = (event: { sender: { id: number } }, ...args: unknown[]) => unknown;

// What ipc-handlers.ts registers with ipcMain.handle, by channel.
const handlers = vi.hoisted(() => new Map<string, Handler>());

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  dialog: {},
  BrowserWindow: {},
  shell: {},
}));
// These reach Electron's app and windows as they load; the search handler uses none of them.
vi.mock('./settings-store', () => ({ nudgeTrackFileOpen: vi.fn() }));
vi.mock('./recents', () => ({ noteRecent: vi.fn() }));
vi.mock('./windows', () => ({ openPathInNewWindow: vi.fn() }));

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
