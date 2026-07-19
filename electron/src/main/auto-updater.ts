import { app, autoUpdater, ipcMain, BrowserWindow } from 'electron';
import fsSync from 'node:fs';
import path from 'node:path';
import { RECHECK_INTERVAL_MS, shouldCheckOnFocus } from './update-schedule';

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
  fsSync.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
}

// Track update state for renderer queries
let isSetUp = false;
let updateStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'error' = 'idle';
let downloadedVersion: string | null = null;
let downloadedNotes: string | null = null;
let updateError: string | null = null;

let lastFocusedWindow: BrowserWindow | null = null;

// Timestamp of the most recent checkForUpdates() invocation, used to decide
// whether a window-focus event should trigger a fresh (stale) check.
let lastCheckAt: number | null = null;

// When a user clicks "Check for Updates" before autoUpdater has finished
// downloading, we hold their webContents here so the eventual download
// result can be delivered to that specific window — even if the user
// previously skipped the version.
let manualCheckSender: Electron.WebContents | null = null;

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
    broadcast('update:status', 'checking');
  });

  autoUpdater.on('update-available', () => {
    updateStatus = 'available';
    broadcast('update:status', 'available');
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = 'idle';
    manualCheckSender = null;
    broadcast('update:status', 'not-available');
  });

  autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
    const version = releaseName?.replace(/^v/, '') || null;

    updateStatus = 'downloaded';
    downloadedVersion = version;
    downloadedNotes = releaseNotes || null;

    // If a manual "Check for Updates" is awaiting a result, deliver it
    // straight to that window — the user explicitly asked, so the skip
    // filter shouldn't silence them.
    if (manualCheckSender && !manualCheckSender.isDestroyed()) {
      manualCheckSender.send('update:ready', {
        version: downloadedVersion,
        notes: downloadedNotes,
      });
      manualCheckSender = null;
      return;
    }

    // Auto-broadcast respects skip: when the user previously chose
    // "Skip this version", don't pop the dialog for that version again.
    const state = loadState();
    if (version && state.skippedVersion === version) return;

    targetWindow()?.webContents.send('update:ready', {
      version: downloadedVersion,
      notes: downloadedNotes,
    });
  });

  autoUpdater.on('error', (err) => {
    updateStatus = 'error';
    updateError = err?.message || 'Unknown error';
    manualCheckSender = null;
    broadcast('update:status', 'error');
  });

  isSetUp = true;

  // Check on launch, then periodically
  triggerCheck();
  setInterval(() => triggerCheck(), RECHECK_INTERVAL_MS);
}

export function registerAutoUpdaterIPC() {
  // Manual check (from menu "Check for Updates"). Returns the downloaded
  // state regardless of skip — the user explicitly invoked the check.
  ipcMain.handle('update:check', (event) => {
    if (isDev || !isSetUp) return { status: 'error', error: 'Auto-updates not available in dev mode' };

    if (updateStatus === 'downloaded' && downloadedVersion) {
      return { status: 'downloaded', version: downloadedVersion, notes: downloadedNotes };
    }

    updateError = null;
    manualCheckSender = event.sender;
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
    return { status: updateStatus };
  });

  // Restart and install
  ipcMain.handle('update:install', () => {
    if (updateStatus === 'downloaded') {
      autoUpdater.quitAndInstall();
    }
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
