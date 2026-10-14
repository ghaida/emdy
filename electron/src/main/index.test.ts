// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// index.ts wires the app together as it loads. Everything it wires is played
// here, so its menu rebuild runs as written: windows that show a file or
// don't, the menus it builds, and recent paths whose checks answer when a test
// says so.
const h = vi.hoisted(() => ({
  appOn: new Map<string, (...args: unknown[]) => unknown>(),
  ipc: new Map<string, (...args: unknown[]) => unknown>(),
  focusListeners: [] as Array<() => unknown>,
  hasFile: false,
  checks: [] as Array<(paths: string[]) => void>,
  built: [] as Array<{ hasFile: boolean; paths: string[] }>,
}));

vi.mock('electron', () => ({
  app: {
    on: (event: string, handler: (...args: unknown[]) => unknown) => void h.appOn.set(event, handler),
    commandLine: { appendSwitch: () => undefined },
    quit: () => undefined,
    isReady: () => true,
    getVersion: () => '0.0.0',
  },
  autoUpdater: { on: () => undefined },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null, fromWebContents: () => null },
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => void h.ipc.set(channel, handler) },
  protocol: { registerSchemesAsPrivileged: () => undefined, handle: () => undefined },
  net: { fetch: () => undefined },
  session: {
    defaultSession: {
      setPermissionRequestHandler: () => undefined,
      setPermissionCheckHandler: () => undefined,
      webRequest: { onHeadersReceived: () => undefined },
    },
  },
  systemPreferences: { getAccentColor: () => 'ffffffff', subscribeNotification: () => undefined },
  shell: { openExternal: () => undefined },
}));
vi.mock('electron-squirrel-startup', () => ({ default: false }));
vi.mock('./ipc-handlers', () => ({ registerFileHandlers: () => undefined }));
vi.mock('./settings-store', () => ({
  registerSettingsHandlers: () => undefined,
  registerNudgeHandlers: () => undefined,
  nudgeTrackAppLaunch: () => undefined,
}));
vi.mock('./file-watcher', () => ({ registerFileWatcher: () => undefined }));
vi.mock('./pdf-export', () => ({ registerExportHandlers: () => undefined }));
vi.mock('./auto-updater', () => ({ setupAutoUpdater: () => undefined, registerAutoUpdaterIPC: () => undefined }));
vi.mock('./menu', () => ({
  buildMenu: (_send: unknown, hasFile: boolean, recent: { paths: string[] }) =>
    void h.built.push({ hasFile, paths: recent.paths }),
}));
vi.mock('./windows', () => ({
  registerWindowHandlers: () => undefined,
  startWindows: async () => undefined,
  openFromOutside: async () => undefined,
  handleActivate: () => undefined,
  lastFocusedWindow: () => null,
  prepareForQuit: () => undefined,
  prepareForUpdateRestart: () => undefined,
  cancelQuit: () => undefined,
  sendMenuEventWithoutWindow: () => undefined,
  sendWhenReadyTo: () => undefined,
  focusedWindowHasFile: () => h.hasFile,
  onWindowFocus: (listener: () => unknown) => void h.focusListeners.push(listener),
  setWindowHasFile: (_sender: unknown, hasFile: boolean) => {
    h.hasFile = hasFile;
  },
}));
vi.mock('./recents', () => ({
  clearRecents: () => undefined,
  forgetRecent: () => undefined,
  onRecentsChange: () => undefined,
  recentPaths: () => new Promise<string[]>((resolve) => h.checks.push(resolve)),
}));

// Lets the rebuilds whose checks have answered run to the end.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Another window takes focus, showing a file or not.
function focus(hasFile: boolean) {
  h.hasFile = hasFile;
  for (const listener of h.focusListeners) void listener();
}

const ready = () => h.appOn.get('ready')?.();

beforeEach(async () => {
  h.appOn.clear();
  h.ipc.clear();
  h.focusListeners.length = 0;
  h.hasFile = false;
  h.checks.length = 0;
  h.built.length = 0;
  vi.resetModules();
  // A dev build's global, so the production-only CSP header is left out.
  vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');
  await import('./index');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the menu at launch', () => {
  it("is Emdy's as soon as main is ready, before the recent paths have been checked", async () => {
    // Until Emdy sets its menu, Electron's default one is up, with Reload and
    // Toggle Developer Tools.
    ready();
    expect(h.built).toEqual([{ hasFile: false, paths: [] }]);

    h.checks.shift()?.(['/notes/a.md']);
    await settle();
    expect(h.built).toEqual([
      { hasFile: false, paths: [] },
      { hasFile: false, paths: ['/notes/a.md'] },
    ]);
  });
});

describe('the menu after focus moves or a window reports its file', () => {
  // Launched, with the first check answered and its menu built.
  beforeEach(async () => {
    ready();
    h.checks.shift()?.(['/notes/a.md']);
    await settle();
    h.built.length = 0;
  });

  it('describes the window focused last when the checks answer out of order', async () => {
    focus(true); // B, showing a file
    focus(false); // then A, on the welcome screen
    const [forB, forA] = h.checks.splice(0);
    forA(['/notes/a.md', '/notes/b.md']);
    await settle();
    forB(['/notes/a.md']); // B's older list, answering last
    await settle();
    expect(h.built).toEqual([{ hasFile: false, paths: ['/notes/a.md', '/notes/b.md'] }]);
  });

  it('drops a rebuild that a later one overtook, also when the checks answer in order', async () => {
    focus(false);
    focus(true);
    const [first, second] = h.checks.splice(0);
    first(['/notes/a.md', '/notes/b.md']);
    await settle();
    expect(h.built).toEqual([]);
    second(['/notes/a.md', '/notes/b.md']);
    await settle();
    expect(h.built).toEqual([{ hasFile: true, paths: ['/notes/a.md', '/notes/b.md'] }]);
  });

  it('reads whether the window shows a file once the check answers, not when it started', async () => {
    void h.ipc.get('menu:set-has-file')?.({ sender: {} }, false);
    // What main knows of the window by the time the check answers.
    h.hasFile = true;
    h.checks.shift()?.(['/notes/a.md']);
    await settle();
    expect(h.built).toEqual([{ hasFile: true, paths: ['/notes/a.md'] }]);
  });
});
