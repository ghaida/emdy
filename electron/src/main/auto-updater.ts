import { app, autoUpdater, ipcMain, BrowserWindow } from 'electron';
import fsSync from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './atomic-write';
import { RECHECK_INTERVAL_MS, shouldCheckOnFocus } from './update-schedule';
import { sendWhenReadyTo } from './windows';

const isDev = !app.isPackaged;

// Skip-version persistence
const statePath = path.join(app.getPath('userData'), 'update-state.json');

interface UpdateState {
  skippedVersion: string | null;
}

function loadState(): UpdateState {
  try {
    const data = fsSync.readFileSync(statePath, 'utf-8');
    return { skippedVersion: null, ...JSON.parse(data) };
  } catch {
    // Migrate from old update-check.json if it exists
    const oldPath = path.join(app.getPath('userData'), 'update-check.json');
    try {
      const oldData = JSON.parse(fsSync.readFileSync(oldPath, 'utf-8'));
      const migrated: UpdateState = { skippedVersion: oldData.skippedVersion || null };
      saveState(migrated);
      fsSync.unlinkSync(oldPath);
      return migrated;
    } catch {
      return { skippedVersion: null };
    }
  }
}

function saveState(state: UpdateState) {
  writeJsonAtomic(statePath, state);
}

// Track update state for renderer queries
let isSetUp = false;
let updateStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'error' = 'idle';
let downloadedVersion: string | null = null;
let downloadedNotes: string | null = null;
let updateError: string | null = null;
// About says "Up to date" only when the last check found nothing newer.
let lastCheckFoundNothing = false;

let lastFocusedWindow: BrowserWindow | null = null;

// Timestamp of the most recent checkForUpdates() invocation, used to decide
// whether a window-focus event should trigger a fresh (stale) check.
let lastCheckAt: number | null = null;

// When users click "Check for Updates" before autoUpdater has finished
// downloading, we hold each asking window's webContents here so the eventual
// download result can be delivered to every one of them — even if the user
// previously skipped the version. Emptied when the check ends.
const manualCheckSenders = new Set<Electron.WebContents>();

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

// For update:ready, send to one window only (the user's current context)
// rather than fanning out to every open window. Manual "Check for Updates"
// from any window's menu still works — the dialog calls update:check via IPC
// and main returns the downloaded state regardless of which window asked.
function targetWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) return focused;
  if (lastFocusedWindow && !lastFocusedWindow.isDestroyed()) return lastFocusedWindow;
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) return win;
  }
  return null;
}

// Single entry point for kicking off a check — records the timestamp so
// the on-focus staleness logic has an accurate "last checked" reference.
function triggerCheck() {
  lastCheckAt = Date.now();
  autoUpdater.checkForUpdates();
}

export function setupAutoUpdater() {
  if (isDev) return; // autoUpdater throws when app is not packaged

  // Track the most recently focused window so we can route the
  // update:ready notification to the right place even if the app
  // is unfocused at the moment the download finishes. Also opportunistically
  // trigger a stale check on focus, which catches machines waking from sleep
  // where the setInterval timer may not have fired.
  app.on('browser-window-focus', (_event, win) => {
    lastFocusedWindow = win;

    // Only check when we're idle (or recovering from an error) — never while a
    // check/download is already in flight ('checking'/'available') or when an
    // update is already downloaded and waiting to install ('downloaded').
    const canCheck = updateStatus === 'idle' || updateStatus === 'error';
    if (canCheck && shouldCheckOnFocus(lastCheckAt, Date.now())) {
      triggerCheck();
    }
  });

  const feedURL = `https://update.electronjs.org/ghaida/emdy/${process.platform}-${process.arch}/${app.getVersion()}`;

  try {
    autoUpdater.setFeedURL({ url: feedURL });
  } catch {
    // Feed URL setup can fail in some environments
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    updateStatus = 'checking';
    lastCheckFoundNothing = false;
    broadcast('update:status', 'checking');
  });

  autoUpdater.on('update-available', () => {
    updateStatus = 'available';
    broadcast('update:status', 'available');
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = 'idle';
    lastCheckFoundNothing = true;
    manualCheckSenders.clear();
    broadcast('update:status', 'not-available');
  });

  autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
    const version = releaseName?.replace(/^v/, '') || null;

    updateStatus = 'downloaded';
    downloadedVersion = version;
    downloadedNotes = releaseNotes || null;
    // An open About asks again on any status; a skipped version still reads as idle.
    broadcast('update:status', 'downloaded');

    // If manual "Check for Updates" requests are awaiting a result, deliver
    // it straight to each of those windows — the user explicitly asked, so
    // the skip filter shouldn't silence them.
    const askers = [...manualCheckSenders].filter((sender) => !sender.isDestroyed());
    manualCheckSenders.clear();
    if (askers.length > 0) {
      for (const sender of askers) {
        sendWhenReadyTo(sender, 'update:ready', {
          version: downloadedVersion,
          notes: downloadedNotes,
        });
      }
      return;
    }

    // Auto-broadcast respects skip: when the user previously chose
    // "Skip this version", don't pop the dialog for that version again.
    const state = loadState();
    if (version && state.skippedVersion === version) return;

    const target = targetWindow();
    if (target) {
      sendWhenReadyTo(target.webContents, 'update:ready', {
        version: downloadedVersion,
        notes: downloadedNotes,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    updateStatus = 'error';
    updateError = err?.message || 'Unknown error';
    manualCheckSenders.clear();
    broadcast('update:status', 'error');
  });

  isSetUp = true;

  // Check on launch, then periodically
  triggerCheck();
  setInterval(() => {
    // Not while a check or download is in flight, and not once an update is waiting.
    if (updateStatus === 'idle' || updateStatus === 'error') triggerCheck();
  }, RECHECK_INTERVAL_MS);
}

export function registerAutoUpdaterIPC() {
  // Manual check (from menu "Check for Updates"). Returns the downloaded
  // state regardless of skip — the user explicitly invoked the check.
  ipcMain.handle('update:check', (event) => {
    if (isDev || !isSetUp) return { status: 'error', error: 'Auto-updates not available in dev mode' };

    if (updateStatus === 'downloaded' && downloadedVersion) {
      return { status: 'downloaded', version: downloadedVersion, notes: downloadedNotes };
    }

    // Squirrel refuses a second concurrent check and reports it as an error, so
    // join the one in flight instead.
    if (updateStatus === 'checking' || updateStatus === 'available') {
      manualCheckSenders.add(event.sender);
      return { status: 'checking' };
    }

    updateError = null;
    manualCheckSenders.add(event.sender);
    triggerCheck();
    return { status: 'checking' };
  });

  // Renderer mount-time query. Auto-pop respects skip — return idle if
  // the user already skipped this version. The version is still
  // surfaceable via the manual update:check path.
  ipcMain.handle('update:get-status', () => {
    if (updateStatus === 'downloaded' && downloadedVersion) {
      const state = loadState();
      if (state.skippedVersion === downloadedVersion) {
        return { status: 'idle' };
      }
      return { status: 'downloaded', version: downloadedVersion, notes: downloadedNotes };
    }
    if (updateStatus === 'error') {
      return { status: 'error', error: updateError };
    }
    return { status: updateStatus, upToDate: updateStatus === 'idle' && lastCheckFoundNothing };
  });

  // Restart and install. False when there's no downloaded update to install,
  // so the dialog can say so.
  ipcMain.handle('update:install', () => {
    if (updateStatus !== 'downloaded') return false;
    autoUpdater.quitAndInstall();
    return true;
  });

  // Skip this version. Suppresses the auto-pop on mount and the auto-
  // broadcast for this specific version — but state is preserved so a
  // manual "Check for Updates" can still surface it on demand.
  ipcMain.handle('update:skip', (_event, version: string) => {
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return;
    const state = loadState();
    state.skippedVersion = version;
    saveState(state);
  });

  // Lets the dialog hide the "Skip this version" button when the
  // shown version is already skipped (e.g. user invoked manual check
  // after previously skipping).
  ipcMain.handle('update:get-skipped-version', () => loadState().skippedVersion);
}
