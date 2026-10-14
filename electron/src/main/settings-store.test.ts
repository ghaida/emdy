import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Handler = (event: { sender: { id: number } }, ...args: unknown[]) => unknown;

// Just enough of Electron for settings-store.ts: settings.json lives in a temp
// folder, the handlers it registers are kept by channel, and the open windows
// are whatever a test puts in `windows`.
const electron = vi.hoisted(() => ({
  userData: '',
  handlers: new Map<string, Handler>(),
  windows: [] as FakeWindow[],
}));

vi.mock('electron', () => ({
  app: { getPath: () => electron.userData },
  ipcMain: {
    handle: (channel: string, handler: Handler) => void electron.handlers.set(channel, handler),
    on: () => undefined,
  },
  BrowserWindow: { getAllWindows: () => electron.windows },
}));

// A window and its page. What main sends the page lands in `sent`. As in
// Electron, a destroyed window's webContents can't be read.
class FakeWindow {
  sent: unknown[][] = [];
  destroyed = false;
  private readonly page: { id: number; send: (...args: unknown[]) => void };
  constructor(id: number) {
    this.page = { id, send: (...args: unknown[]) => void this.sent.push(args) };
  }
  get webContents() {
    if (this.destroyed) throw new Error('Object has been destroyed');
    return this.page;
  }
  isDestroyed() {
    return this.destroyed;
  }
}

let store: typeof import('./settings-store');

beforeEach(async () => {
  electron.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-settings-'));
  electron.handlers.clear();
  electron.windows.length = 0;
  // settings-store reads settings.json as it loads, so each test loads it afresh.
  vi.resetModules();
  store = await import('./settings-store');
  store.registerSettingsHandlers();
});

afterEach(() => {
  fs.rmSync(electron.userData, { recursive: true, force: true });
});

// Sets a value as the window whose page has webContents id `sender` would. The
// event carries its own object for the page, so only the id ties it to a window.
function setFrom(sender: number, key: string, value: unknown) {
  const handler = electron.handlers.get('settings:set');
  if (!handler) throw new Error('settings:set is not registered');
  return handler({ sender: { id: sender } }, key, value);
}

const changed = (key: string, value: unknown) => ['settings:changed', key, value];

describe('settings:set', () => {
  it('sends the change to every other window, and not back to the one that made it', () => {
    const a = new FakeWindow(1);
    const b = new FakeWindow(2);
    const c = new FakeWindow(3);
    electron.windows.push(a, b, c);
    setFrom(1, 'theme', 'dark');
    expect(b.sent).toEqual([changed('theme', 'dark')]);
    expect(c.sent).toEqual([changed('theme', 'dark')]);
    expect(a.sent).toEqual([]);
    expect(store.getSettings().theme).toBe('dark');
  });

  it('skips a window that has been destroyed', () => {
    const a = new FakeWindow(1);
    const closed = new FakeWindow(2);
    const b = new FakeWindow(3);
    closed.destroyed = true;
    electron.windows.push(a, closed, b);
    expect(() => setFrom(1, 'zoom', 1.5)).not.toThrow();
    expect(b.sent).toEqual([changed('zoom', 1.5)]);
    expect(closed.sent).toEqual([]);
  });

  it('neither saves nor sends a value the schema rejects', () => {
    const a = new FakeWindow(1);
    const b = new FakeWindow(2);
    electron.windows.push(a, b);
    setFrom(1, 'zoom', 99);
    setFrom(1, 'theme', 'sepia');
    // Not a setting, though every object has it.
    setFrom(1, 'constructor', 'x');
    setFrom(1, 'fontFamily', 'serif');
    // Only the valid one reaches the other window.
    expect(b.sent).toEqual([changed('fontFamily', 'serif')]);
    expect(store.getSettings()).toMatchObject({ zoom: 1, theme: 'system', fontFamily: 'serif' });
  });
});
