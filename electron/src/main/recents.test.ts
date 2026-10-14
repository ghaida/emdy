import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const electronApp = vi.hoisted(() => ({
  getPath: () => process.env.EMDY_TEST_USER_DATA as string,
  addRecentDocument: vi.fn(),
  clearRecentDocuments: vi.fn(),
}));
vi.mock('electron', () => ({ app: electronApp }));

let recents: typeof import('./recents');
let dir: string;

function file(name: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `# ${name}\n`);
  return filePath;
}

const saved = () => JSON.parse(fs.readFileSync(path.join(dir, 'recents.json'), 'utf-8'));

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-recents-'));
  process.env.EMDY_TEST_USER_DATA = dir;
  electronApp.addRecentDocument.mockClear();
  electronApp.clearRecentDocuments.mockClear();
  vi.resetModules();
  recents = await import('./recents');
});

afterEach(() => {
  for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name));
  fs.rmdirSync(dir);
});

describe('Open Recent list', () => {
  it('puts a newly opened file at the top, saves the list and tells macOS', async () => {
    const a = file('a.md');
    const b = file('b.md');
    recents.noteRecent(a);
    recents.noteRecent(b);
    await expect(recents.recentPaths()).resolves.toEqual([b, a]);
    expect(saved()).toEqual([b, a]);
    expect(electronApp.addRecentDocument).toHaveBeenCalledWith(b);
  });

  it('tells listeners when the list changes, so the menu can be rebuilt', () => {
    const listener = vi.fn();
    recents.onRecentsChange(listener);
    recents.noteRecent(file('a.md'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('leaves out files that have been moved or deleted', async () => {
    const a = file('a.md');
    const gone = file('gone.md');
    recents.noteRecent(a);
    recents.noteRecent(gone);
    fs.unlinkSync(gone);
    await expect(recents.recentPaths()).resolves.toEqual([a]);
  });

  it('forgets a path that turns out not to open', () => {
    const a = file('a.md');
    const b = file('b.md');
    recents.noteRecent(a);
    recents.noteRecent(b);
    recents.forgetRecent(b);
    expect(saved()).toEqual([a]);
  });

  it('clears the list and macOS\'s list', async () => {
    recents.noteRecent(file('a.md'));
    recents.clearRecents();
    await expect(recents.recentPaths()).resolves.toEqual([]);
    expect(saved()).toEqual([]);
    expect(electronApp.clearRecentDocuments).toHaveBeenCalled();
  });

  it('reads the saved list back after a restart', async () => {
    const a = file('a.md');
    fs.writeFileSync(path.join(dir, 'recents.json'), JSON.stringify([a, 'not-absolute.md']));
    vi.resetModules();
    recents = await import('./recents');
    await expect(recents.recentPaths()).resolves.toEqual([a]);
  });
});
