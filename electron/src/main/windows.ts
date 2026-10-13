// Every Emdy window is created and tracked here, along with what each one
// shows: a file from the Dock, Finder or Open Recent goes to a window that's
// still on the welcome screen, and the windows open at quit come back at the
// next launch.
import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, WindowRestoreState } from '../renderer/lib/types';
import { isInsideFolder } from '../shared/paths';
import { addAllowedRoot, isPathAllowed, hardenWindow } from './allowed-paths';
import { isOpenableDrop, pickWindowForPath, type RoutingWindow } from './open-routing';
import { scanDirectory } from './scan-directory';
import {
  buildSession,
  fitBounds,
  parseSession,
  serializeSession,
  type LiveWindow,
  type Rect,
  type SavedWindow,
} from './session-state';
import { getWindowBackgroundColor } from './window-theme';
import { cascadeBounds } from './window-placement';
import { noteRecent } from './recents';

interface WindowRecord {
  win: BrowserWindow;
  dirPath: string | null;
  filePath: string | null;
  scrollTop: number;
  /** Shows the loading spinner until its first folder or file arrives. */
  pending: boolean;
  /**
   * False until the page says its listeners are registered (window:ready).
   * A message sent before then would be lost, so it waits in queued.
   */
  ready: boolean;
  queued: { channel: string; args: unknown[] }[];
  /** A file from outside is loading into it, so it no longer counts as empty. */
  claimed: boolean;
  lastFocusedAt: number;
}

type OpenPayload =
  | { kind: 'dir'; dirPath: string; entries: FileEntry[] }
  | { kind: 'file'; filePath: string; content: string }
  | { kind: 'restore'; state: WindowRestoreState };

const SHOW_FALLBACK_MS = 2000;
const SAVE_DELAY_MS = 1000;

// Keyed by webContents id, which is what IPC handlers see as event.sender.
const records = new Map<number, WindowRecord>();

// Until the first windows are open, a Dock click mustn't add a stray welcome
// window, and session.json still describes the last session.
let startupDone = false;
// Once quitting starts, windows closing must not remove themselves from the
// saved session.
let quitting = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
// The window a new one steps out from: the one opened or focused last.
let previousWindow: BrowserWindow | null = null;

/** The one place Emdy windows are created. */
export function createAppWindow(options: { bounds?: Rect | null; pending?: boolean } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    ...(options.bounds ?? nextWindowBounds() ?? {}),
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: getWindowBackgroundColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Read the id now: win.webContents throws once the window is destroyed.
  const wcId = win.webContents.id;
  const record: WindowRecord = {
    win,
    dirPath: null,
    filePath: null,
    scrollTop: 0,
    pending: options.pending ?? false,
    ready: false,
    queued: [],
    claimed: false,
    lastFocusedAt: Date.now(),
  };
  records.set(wcId, record);

  let shown = false;
  const showOnce = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
  };
  win.once('ready-to-show', showOnce);
  setTimeout(showOnce, SHOW_FALLBACK_MS);

  // A reload drops the page's listeners; it says it's ready again once they're back.
  win.webContents.on('did-start-loading', () => {
    record.ready = false;
  });
  previousWindow = win;
  win.on('focus', () => {
    record.lastFocusedAt = Date.now();
    previousWindow = win;
    scheduleSave();
  });
  win.on('moved', scheduleSave);
  win.on('resized', scheduleSave);
  win.on('closed', () => {
    if (quitting) return;
    records.delete(wcId);
    scheduleSave();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  hardenWindow(win);
  return win;
}

// A step down and to the right of the previous window, at its size, so new
// windows don't hide each other. Null (centered, default size) when no other
// window is open.
function nextWindowBounds(): Rect | null {
  const previous = previousWindow && !previousWindow.isDestroyed() ? previousWindow : lastFocusedWindow();
  if (!previous) return null;
  const bounds = previous.getNormalBounds();
  const taken = [...records.values()].filter((r) => !r.win.isDestroyed()).map((r) => r.win.getNormalBounds());
  return cascadeBounds(bounds, screen.getDisplayMatching(bounds).workArea, taken);
}

function recordFor(win: BrowserWindow): WindowRecord | undefined {
  return win.isDestroyed() ? undefined : records.get(win.webContents.id);
}

// A message that reaches the page before its listeners are registered is lost.
// In a packaged build they're registered after the page's load event, so
// messages wait until the page says it's listening.
function sendWhenReady(record: WindowRecord, channel: string, ...args: unknown[]) {
  if (!record.ready) record.queued.push({ channel, args });
  else if (!record.win.isDestroyed()) record.win.webContents.send(channel, ...args);
}

// Reads a folder or file before any window is touched, so a path that can't
// be read never leaves a window stuck on its spinner.
async function loadPath(pathToOpen: string): Promise<OpenPayload> {
  const stat = await fs.stat(pathToOpen);
  if (stat.isDirectory()) {
    addAllowedRoot(pathToOpen);
    return { kind: 'dir', dirPath: pathToOpen, entries: await scanDirectory(pathToOpen) };
  }
  const content = await fs.readFile(pathToOpen, 'utf-8');
  if (!isPathAllowed(pathToOpen)) addAllowedRoot(path.dirname(pathToOpen));
  return { kind: 'file', filePath: pathToOpen, content };
}

// Records what the window shows right away, so it stops counting as empty
// before its page has even loaded, then sends it to the page.
function showPayload(win: BrowserWindow, payload: OpenPayload) {
  const record = recordFor(win);
  if (!record) return;
  if (payload.kind === 'dir') {
    record.dirPath = payload.dirPath;
    record.filePath = null;
    record.scrollTop = 0;
    sendWhenReady(record, 'dir:open', payload.dirPath, payload.entries);
  } else if (payload.kind === 'file') {
    // Same rule as the renderer: a file from outside the open folder closes it.
    if (record.dirPath !== null && !isInsideFolder(payload.filePath, record.dirPath)) record.dirPath = null;
    record.filePath = payload.filePath;
    record.scrollTop = 0;
    sendWhenReady(record, 'file:open', payload.filePath, payload.content);
  } else {
    record.dirPath = payload.state.dirPath;
    record.filePath = payload.state.filePath;
    record.scrollTop = payload.state.scrollTop;
    sendWhenReady(record, 'window:restore', payload.state);
  }
  scheduleSave();
}

export async function openPathInNewWindow(pathToOpen: string): Promise<void> {
  const payload = await loadPath(pathToOpen);
  showPayload(createAppWindow({ pending: true }), payload);
}

/**
 * Double-click, Dock drop, Open With and Open Recent: use a window that's
 * still on the welcome screen if there is one, otherwise open a new window.
 * The window is claimed the moment the path arrives, so several files keep
 * their order and a slow one doesn't hold up the rest.
 */
export async function openFromOutside(pathToOpen: string): Promise<void> {
  const targetId = pickWindowForPath(routingWindows(), focusedId());
  const reused = targetId === null ? undefined : records.get(targetId);
  const record = reused ?? recordFor(createAppWindow({ pending: true }));
  if (!record) return;
  const { win } = record;
  if (reused) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  record.claimed = true;
  try {
    const payload = await loadPath(pathToOpen);
    showPayload(win, payload);
    noteRecent(pathToOpen);
  } catch (error) {
    // A welcome window goes back to being empty; a window opened for this path closes.
    if (!reused) closeUnloadedWindow(win);
    throw error;
  } finally {
    record.claimed = false;
  }
}

// A window whose folder or file couldn't be loaded closes. If that leaves no
// windows once launch is done, a welcome window takes its place.
function closeUnloadedWindow(win: BrowserWindow) {
  if (win.isDestroyed()) return;
  win.close();
  const othersOpen = [...records.values()].some((r) => r.win !== win && !r.win.isDestroyed());
  if (startupDone && !quitting && !othersOpen) createAppWindow();
}

function routingWindows(): RoutingWindow[] {
  const windows: RoutingWindow[] = [];
  for (const [id, record] of records) {
    if (record.win.isDestroyed()) continue;
    windows.push({
      id,
      empty: record.dirPath === null && record.filePath === null && !record.claimed,
      lastFocusedAt: record.lastFocusedAt,
    });
  }
  return windows;
}

function focusedId(): number | null {
  const focused = BrowserWindow.getFocusedWindow();
  return focused && !focused.isDestroyed() ? focused.webContents.id : null;
}

/**
 * Opens the first windows at launch. Launched by opening files: just those.
 * Plain launch: the windows open at the last quit. Either way, a welcome
 * window if nothing could be opened.
 */
export async function startWindows(launchPaths: string[]): Promise<void> {
  try {
    if (launchPaths.length === 0) await restoreSession();
    // Each path claims its window straight away; launch doesn't wait for files to load.
    for (const pathToOpen of launchPaths) {
      openFromOutside(pathToOpen).catch(() => {
        // Can't be read; its window has closed.
      });
    }
  } finally {
    if (records.size === 0) createAppWindow();
    startupDone = true;
    scheduleSave();
  }
}

/** Clicking the Dock icon with no windows open: a fresh welcome window. */
export function handleActivate() {
  if (startupDone && records.size === 0) createAppWindow();
}

// The menu items that still make sense with no window open. The others act on
// a document, and the menu can still list them after the last window closes.
const NO_WINDOW_MENU_EVENTS = new Set(['open', 'show-about', 'check-for-updates']);

/**
 * Open…, About and Check for Updates… chosen with no window open (⌘W closes
 * the last one): a welcome window opens, as for a Dock click, and gets the
 * event once it's on screen and its page is listening. Other items do nothing.
 */
export function sendMenuEventWithoutWindow(event: string) {
  if (!NO_WINDOW_MENU_EVENTS.has(event) || !startupDone || quitting || records.size > 0) return;
  const win = createAppWindow();
  // Open… shows its dialog as a sheet on this window, so wait until it's on screen.
  void whenShown(win).then(() => {
    const record = recordFor(win);
    if (record) sendWhenReady(record, 'menu:event', event);
  });
}

/** Where menu events go when no window has focus. */
export function lastFocusedWindow(): BrowserWindow | null {
  let latest: WindowRecord | null = null;
  for (const record of records.values()) {
    if (record.win.isDestroyed()) continue;
    if (!latest || record.lastFocusedAt > latest.lastFocusedAt) latest = record;
  }
  return latest ? latest.win : null;
}

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json');
}

function scheduleSave() {
  if (quitting) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSession();
  }, SAVE_DELAY_MS);
}

function saveSession() {
  // Quitting before launch has opened its windows must not replace the last
  // session with an empty one.
  if (!startupDone) return;
  const windows: LiveWindow[] = [];
  for (const record of records.values()) {
    if (record.win.isDestroyed()) continue;
    windows.push({
      dirPath: record.dirPath,
      filePath: record.filePath,
      scrollTop: record.scrollTop,
      bounds: record.win.getNormalBounds(),
      lastFocusedAt: record.lastFocusedAt,
    });
  }
  try {
    writeFileSync(sessionPath(), serializeSession(buildSession(windows)), { mode: 0o600 });
  } catch {
    // userData isn't writable; the next launch just won't restore anything.
  }
}

/**
 * Saves the session now and keeps windows closing during the quit from
 * changing it. Runs on before-quit, and on before-quit-for-update, which fires
 * before an update restart closes the windows (before-quit only comes after,
 * in that case).
 */
export function prepareForQuit() {
  if (quitting) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveSession();
  quitting = true;
}

function readSession(): SavedWindow[] {
  try {
    return parseSession(JSON.parse(readFileSync(sessionPath(), 'utf-8')));
  } catch {
    return []; // No file yet, or one that isn't JSON.
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

/**
 * What a saved window shows now: its folder and file as they were, its folder
 * alone (opened like any folder) when the file can't come back, or null when
 * the window can't come back at all.
 */
async function loadSavedWindow(saved: SavedWindow): Promise<OpenPayload | null> {
  const { dirPath, filePath, scrollTop } = saved;
  if (dirPath !== null && !(await isDirectory(dirPath))) return null;
  let entries: FileEntry[] | null = null;
  if (dirPath !== null) {
    addAllowedRoot(dirPath);
    entries = await scanDirectory(dirPath);
  }
  const folderOnly: OpenPayload | null =
    dirPath !== null && entries !== null ? { kind: 'dir', dirPath, entries } : null;
  if (filePath === null || (dirPath !== null && !isInsideFolder(filePath, dirPath)) || !(await isFile(filePath))) {
    return folderOnly;
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!isPathAllowed(filePath)) addAllowedRoot(path.dirname(filePath));
    return { kind: 'restore', state: { dirPath, entries, filePath, content, scrollTop } };
  } catch {
    return folderOnly;
  }
}

function whenShown(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    if (win.isDestroyed() || win.isVisible()) {
      resolve();
      return;
    }
    win.once('show', () => resolve());
    win.once('closed', () => resolve());
  });
}

/**
 * Reopens the windows that were open at the last quit. Each one opens right
 * away with its spinner and fills in when its own folder and file have loaded,
 * so a slow drive only holds up its own window.
 */
async function restoreSession(): Promise<void> {
  const saved = readSession();
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  const primary = screen.getPrimaryDisplay().workArea;
  const created = saved.map((entry) => {
    const win = createAppWindow({ bounds: fitBounds(entry.bounds, workAreas, primary), pending: true });
    // Recorded now, so quitting before it has loaded still saves it.
    const record = recordFor(win);
    if (record) {
      record.dirPath = entry.dirPath;
      record.filePath = entry.filePath;
      record.scrollTop = entry.scrollTop;
    }
    void fillRestoredWindow(win, entry);
    return win;
  });
  // Windows show themselves as their pages load, in no particular order; once
  // they're all up, put the one used last in front.
  const front = created[created.length - 1];
  if (!front) return;
  await Promise.all(created.map(whenShown));
  if (!front.isDestroyed()) {
    front.moveTop();
    front.focus();
  }
}

async function fillRestoredWindow(win: BrowserWindow, saved: SavedWindow) {
  const payload = await loadSavedWindow(saved).catch(() => null);
  if (win.isDestroyed()) return;
  if (payload) showPayload(win, payload);
  else closeUnloadedWindow(win);
}

// Only paths the user opened (inside an allowed root) are accepted, so page
// script can't plant a path for Emdy to open later.
function isReportedPath(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && path.isAbsolute(value) && isPathAllowed(value));
}

export function registerWindowHandlers() {
  // Not cleared on read: React StrictMode asks twice in dev. The renderer
  // clears its own spinner when its folder or file arrives.
  ipcMain.handle('window:is-pending-open', (event) => records.get(event.sender.id)?.pending ?? false);

  // The page's listeners are registered (App.tsx): send what waited for them,
  // in order. The page says so again each time it re-registers them, which
  // finds nothing left to send.
  ipcMain.on('window:ready', (event) => {
    const record = records.get(event.sender.id);
    if (!record) return;
    record.ready = true;
    for (const { channel, args } of record.queued.splice(0)) event.sender.send(channel, ...args);
  });

  ipcMain.on('window:report-state', (event, state: unknown) => {
    const record = records.get(event.sender.id);
    if (!record || typeof state !== 'object' || state === null) return;
    const { dirPath, filePath, scrollTop } = state as Record<string, unknown>;
    if (!isReportedPath(dirPath) || !isReportedPath(filePath)) return;
    if (typeof scrollTop !== 'number' || !Number.isFinite(scrollTop) || scrollTop < 0) return;
    record.dirPath = dirPath;
    record.filePath = filePath;
    record.scrollTop = scrollTop;
    scheduleSave();
  });

  // Paths come from the preload's drop listener (webUtils.getPathForFile),
  // which page script can't reach. The first one opens in the window it was
  // dropped on and the rest in new windows.
  ipcMain.handle('drop:open', async (event, paths: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || !Array.isArray(paths)) return;
    let openedHere = false;
    let skipped = 0;
    for (const dropped of paths) {
      if (typeof dropped !== 'string' || !path.isAbsolute(dropped)) {
        skipped++;
        continue;
      }
      try {
        const stat = await fs.stat(dropped);
        if (!isOpenableDrop(dropped, stat.isDirectory())) {
          skipped++;
          continue;
        }
        const payload = await loadPath(dropped);
        if (!openedHere && !win.isDestroyed()) {
          showPayload(win, payload);
          openedHere = true;
        } else {
          showPayload(createAppWindow({ pending: true }), payload);
        }
        noteRecent(dropped);
      } catch {
        skipped++;
      }
    }
    if (skipped > 0 && !win.isDestroyed()) win.webContents.send('drop:rejected');
  });
}
