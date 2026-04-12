import { app, autoUpdater, ipcMain, BrowserWindow } from 'electron';
import fsSync from 'node:fs';
import path from 'node:path';

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
  fsSync.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// Track update state for renderer queries
let isSetUp = false;
let updateStatus: 'idle' | 'checking' | 'available' | 'downloaded' | 'error' = 'idle';
let downloadedVersion: string | null = null;
let downloadedNotes: string | null = null;
let updateError: string | null = null;

const RECHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

export function setupAutoUpdater() {
  if (isDev) return; // autoUpdater throws when app is not packaged

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
    broadcast('update:status', 'not-available');
  });

  autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
    const version = releaseName?.replace(/^v/, '') || null;

    // Respect skipped version
    const state = loadState();
    if (version && state.skippedVersion === version) {
      updateStatus = 'idle';
      return;
    }

    updateStatus = 'downloaded';
    downloadedVersion = version;
    downloadedNotes = releaseNotes || null;
    broadcast('update:ready', { version: downloadedVersion, notes: downloadedNotes });
  });

  autoUpdater.on('error', (err) => {
    updateStatus = 'error';
    updateError = err?.message || 'Unknown error';
    broadcast('update:status', 'error');
  });

  isSetUp = true;

  // Check on launch, then periodically
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), RECHECK_INTERVAL_MS);
}

export function registerAutoUpdaterIPC() {
  // Manual check (from menu "Check for Updates")
  ipcMain.handle('update:check', () => {
    if (isDev || !isSetUp) return { status: 'error', error: 'Auto-updates not available in dev mode' };

    // If already downloaded, return that immediately
    if (updateStatus === 'downloaded' && downloadedVersion) {
      return { status: 'downloaded', version: downloadedVersion, notes: downloadedNotes };
    }

    updateError = null;
    autoUpdater.checkForUpdates();
    return { status: 'checking' };
  });

  // Get current update state (for renderer init)
  ipcMain.handle('update:get-status', () => {
    if (updateStatus === 'downloaded') {
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

  // Skip this version
  ipcMain.handle('update:skip', (_event, version: string) => {
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return;
    const state = loadState();
    state.skippedVersion = version;
    saveState(state);
    updateStatus = 'idle';
    downloadedVersion = null;
    downloadedNotes = null;
  });
}
