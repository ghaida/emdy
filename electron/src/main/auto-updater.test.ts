import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { EventEmitter } from 'node:events';
import type { Mock, MockedFunction } from 'vitest';
import { RECHECK_INTERVAL_MS } from './update-schedule';

// Just enough of Electron for auto-updater.ts in a packaged app. Tests play
// Squirrel's part by emitting autoUpdater's events.
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  // What auto-updater.ts registers with ipcMain, by channel.
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const windows: unknown[] = [];
  return {
    app: {
      isPackaged: true,
      getPath: () => process.env.EMDY_TEST_USER_DATA,
      getVersion: () => '1.8.1',
      on: () => undefined,
    },
    autoUpdater: Object.assign(new EventEmitter(), {
      setFeedURL: () => undefined,
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
    }),
    ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => void handlers.set(channel, handler), handlers },
    BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => windows, windows },
  };
});

// The ready queue belongs to windows.ts and is tested there. Here a page gets
// what's sent to it straight away, and the spy shows it went through the queue.
vi.mock('./windows', () => ({
  sendWhenReadyTo: vi.fn((wc: { send: (...args: unknown[]) => void }, channel: string, ...args: unknown[]) =>
    wc.send(channel, ...args),
  ),
}));

interface FakePage {
  sent: unknown[][];
  isDestroyed(): boolean;
  send(...args: unknown[]): void;
}

interface FakeWindow {
  isDestroyed(): boolean;
  webContents: FakePage;
}

interface FakeUpdater extends EventEmitter {
  checkForUpdates: Mock;
  quitAndInstall: Mock;
}

let updater: typeof import('./auto-updater');
let autoUpdater: FakeUpdater;
let sendWhenReadyTo: MockedFunction<typeof import('./windows').sendWhenReadyTo>;
let handlers: Map<string, (event: { sender: FakePage }, ...args: unknown[]) => unknown>;
let windows: FakeWindow[];
let dir: string;

function fakePage(): FakePage {
  return {
    sent: [],
    isDestroyed: () => false,
    send(...args: unknown[]) {
      this.sent.push(args);
    },
  };
}

const fakeWindow = (): FakeWindow => ({ isDestroyed: () => false, webContents: fakePage() });
// "Check for Updates" chosen in the window that shows this page.
const checkFrom = (page: FakePage) => handlers.get('update:check')?.({ sender: page });
const sentOn = (page: FakePage, channel: string) => page.sent.filter(([c]) => c === channel);
const fourHoursPass = () => vi.advanceTimersByTime(RECHECK_INTERVAL_MS);

const READY = { version: '1.9.0', notes: '- Faster search' };

// Squirrel finds 1.9.0 and downloads it.
function downloadUpdate() {
  autoUpdater.emit('update-available');
  autoUpdater.emit('update-downloaded', {}, '- Faster search', 'v1.9.0');
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-updater-'));
  process.env.EMDY_TEST_USER_DATA = dir;
  // setupAutoUpdater starts the 4-hour check timer.
  vi.useFakeTimers();
  vi.resetModules();
  const electron = await import('electron');
  autoUpdater = electron.autoUpdater as unknown as FakeUpdater;
  autoUpdater.removeAllListeners();
  autoUpdater.checkForUpdates.mockClear();
  autoUpdater.quitAndInstall.mockClear();
  handlers = (electron.ipcMain as unknown as { handlers: typeof handlers }).handlers;
  handlers.clear();
  windows = (electron.BrowserWindow as unknown as { windows: FakeWindow[] }).windows;
  windows.length = 0;
  sendWhenReadyTo = vi.mocked((await import('./windows')).sendWhenReadyTo);
  sendWhenReadyTo.mockClear();
  updater = await import('./auto-updater');
  updater.registerAutoUpdaterIPC();
});

afterEach(() => {
  vi.useRealTimers();
  for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name));
  fs.rmdirSync(dir);
});

describe('Check for Updates', () => {
  it('sends the download to every window that asked during one check, through its ready queue', () => {
    updater.setupAutoUpdater();
    // The launch check finds nothing.
    autoUpdater.emit('checking-for-update');
    autoUpdater.emit('update-not-available');
    const first = fakePage();
    const second = fakePage();
    expect(checkFrom(first)).toEqual({ status: 'checking' });
    autoUpdater.emit('checking-for-update');
    // The second window joins the check the first one started.
    expect(checkFrom(second)).toEqual({ status: 'checking' });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    downloadUpdate();
    expect(sentOn(first, 'update:ready')).toEqual([['update:ready', READY]]);
    expect(sentOn(second, 'update:ready')).toEqual([['update:ready', READY]]);
    expect(sendWhenReadyTo).toHaveBeenCalledWith(first, 'update:ready', READY);
    expect(sendWhenReadyTo).toHaveBeenCalledWith(second, 'update:ready', READY);
  });

  it('joins a check that is downloading instead of starting another', () => {
    updater.setupAutoUpdater();
    autoUpdater.emit('checking-for-update');
    autoUpdater.emit('update-available');
    const page = fakePage();
    expect(checkFrom(page)).toEqual({ status: 'checking' });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    autoUpdater.emit('update-downloaded', {}, '- Faster search', 'v1.9.0');
    expect(sentOn(page, 'update:ready')).toEqual([['update:ready', READY]]);
  });

  it.each([
    ['finds nothing', () => autoUpdater.emit('update-not-available')],
    ['fails', () => autoUpdater.emit('error', new Error('offline'))],
  ])('forgets a window once the check it asked about %s', (_, endCheck) => {
    updater.setupAutoUpdater();
    autoUpdater.emit('checking-for-update');
    const page = fakePage();
    checkFrom(page);
    endCheck();
    // A later check downloads a version the user skipped, which pops up nowhere.
    handlers.get('update:skip')?.({ sender: page }, '1.9.0');
    autoUpdater.emit('checking-for-update');
    downloadUpdate();
    expect(sentOn(page, 'update:ready')).toEqual([]);
  });

  it('answers each window once, even when a release comes without a name', () => {
    // Main can't report a nameless download, so the next Check for Updates
    // starts another check: the one way a second download follows the first.
    updater.setupAutoUpdater();
    autoUpdater.emit('checking-for-update');
    const first = fakePage();
    checkFrom(first);
    autoUpdater.emit('update-available');
    autoUpdater.emit('update-downloaded', {}, null, '');
    const second = fakePage();
    expect(checkFrom(second)).toEqual({ status: 'checking' });
    autoUpdater.emit('checking-for-update');
    autoUpdater.emit('update-available');
    autoUpdater.emit('update-downloaded', {}, null, '');
    expect(sentOn(first, 'update:ready')).toHaveLength(1);
    expect(sentOn(second, 'update:ready')).toHaveLength(1);
  });
});

describe('the 4-hour check', () => {
  it('runs only when no check is running and no update is waiting', () => {
    updater.setupAutoUpdater();
    const checks = () => autoUpdater.checkForUpdates.mock.calls.length;
    expect(checks()).toBe(1);
    // The launch check runs, then downloads.
    autoUpdater.emit('checking-for-update');
    fourHoursPass();
    expect(checks()).toBe(1);
    autoUpdater.emit('update-available');
    fourHoursPass();
    expect(checks()).toBe(1);
    // It fails, so the next tick tries again.
    autoUpdater.emit('error', new Error('offline'));
    fourHoursPass();
    expect(checks()).toBe(2);
    // That check finds nothing, and the tick after it checks again.
    autoUpdater.emit('checking-for-update');
    autoUpdater.emit('update-not-available');
    fourHoursPass();
    expect(checks()).toBe(3);
    // This one downloads an update, which then waits to be installed.
    autoUpdater.emit('checking-for-update');
    downloadUpdate();
    fourHoursPass();
    expect(checks()).toBe(3);
  });
});

describe('a downloaded update', () => {
  it('is announced to every window, so an open About can show it', () => {
    windows.push(fakeWindow(), fakeWindow());
    updater.setupAutoUpdater();
    autoUpdater.emit('checking-for-update');
    downloadUpdate();
    for (const { webContents } of windows) {
      expect(sentOn(webContents, 'update:status')).toEqual([
        ['update:status', 'checking'],
        ['update:status', 'available'],
        ['update:status', 'downloaded'],
      ]);
    }
  });

  it('pops up in one window when nobody asked, through its ready queue', () => {
    windows.push(fakeWindow(), fakeWindow());
    updater.setupAutoUpdater();
    autoUpdater.emit('checking-for-update');
    downloadUpdate();
    expect(sendWhenReadyTo).toHaveBeenCalledTimes(1);
    expect(sendWhenReadyTo).toHaveBeenCalledWith(windows[0].webContents, 'update:ready', READY);
    expect(sentOn(windows[1].webContents, 'update:ready')).toEqual([]);
  });
});

describe('update:get-status', () => {
  it('says up to date only while the last check has found nothing newer', () => {
    updater.setupAutoUpdater();
    const status = () => handlers.get('update:get-status')?.({ sender: fakePage() });
    // The launch check hasn't reported yet.
    expect(status()).toEqual({ status: 'idle', upToDate: false });
    autoUpdater.emit('checking-for-update');
    expect(status()).toEqual({ status: 'checking', upToDate: false });
    autoUpdater.emit('update-not-available');
    expect(status()).toEqual({ status: 'idle', upToDate: true });
    autoUpdater.emit('checking-for-update');
    expect(status()).toEqual({ status: 'checking', upToDate: false });
    autoUpdater.emit('error', new Error('offline'));
    expect(status()).toEqual({ status: 'error', error: 'offline' });
  });
});

describe('update:install', () => {
  it('installs only a downloaded update, and says whether it did', () => {
    updater.setupAutoUpdater();
    const install = () => handlers.get('update:install')?.({ sender: fakePage() });
    expect(install()).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    autoUpdater.emit('checking-for-update');
    downloadUpdate();
    expect(install()).toBe(true);
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
