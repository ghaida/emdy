import { app, BrowserWindow, ipcMain, nativeTheme, protocol, net, session, systemPreferences, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { registerFileHandlers, scanDirectory } from './ipc-handlers';
import { registerSettingsHandlers, registerNudgeHandlers, nudgeTrackAppLaunch, getSettings } from './settings-store';
import { registerFileWatcher } from './file-watcher';
import { registerExportHandlers } from './pdf-export';
import { buildMenu } from './menu';
import { addAllowedRoot, isPathAllowed, hardenWindow } from './allowed-paths';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

// Background colors per theme to avoid white flash on launch
const BG_COLORS: Record<string, { light: string; dark: string }> = {
  warm:    { light: '#F5F3EF', dark: '#1C1A16' },
  cool:    { light: '#F5F5F4', dark: '#1A1A19' },
  neutral: { light: '#F0F0F0', dark: '#1C1C1E' },
  fresh:   { light: '#FFFBF0', dark: '#0A1628' },
  neon:    { light: '#F4F2F8', dark: '#050510' },
};

const createWindow = () => {
  const settings = getSettings();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors);
  const palette = BG_COLORS[settings.colorTheme] || BG_COLORS.warm;

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: isDark ? palette.dark : palette.light,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  hardenWindow(mainWindow);

  // Send pending file/directory from dock drop / double-click during launch
  mainWindow.webContents.once('did-finish-load', async () => {
    if (pendingFilePath) {
      try {
        const stat = await fs.stat(pendingFilePath);
        if (stat.isDirectory()) {
          addAllowedRoot(pendingFilePath);
          const entries = await scanDirectory(pendingFilePath);
          mainWindow?.webContents.send('dir:open', pendingFilePath, entries);
        } else {
          addAllowedRoot(path.dirname(pendingFilePath));
          const content = await fs.readFile(pendingFilePath, 'utf-8');
          mainWindow?.webContents.send('file:open', pendingFilePath, content);
          app.addRecentDocument(pendingFilePath);
        }
      } catch {
        // File/directory can't be read
      }
      pendingFilePath = null;
    }
  });
};

ipcMain.handle('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

registerFileHandlers();
registerSettingsHandlers();
registerFileWatcher();
registerExportHandlers();
registerNudgeHandlers();

// System accent color
ipcMain.handle('system:accent-color', () => {
  return '#' + systemPreferences.getAccentColor().slice(0, 6);
});

ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('app:open-external', (_event, url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url);
    }
  } catch {
    // Invalid URL — ignore
  }
});

// Update check state
const updateStatePath = path.join(app.getPath('userData'), 'update-check.json');

interface UpdateCheckState {
  lastChecked: string | null;
  skippedVersion: string | null;
}

function loadUpdateState(): UpdateCheckState {
  try {
    const data = fsSync.readFileSync(updateStatePath, 'utf-8');
    return { lastChecked: null, skippedVersion: null, ...JSON.parse(data) };
  } catch {
    return { lastChecked: null, skippedVersion: null };
  }
}

function saveUpdateState(state: UpdateCheckState) {
  fsSync.writeFileSync(updateStatePath, JSON.stringify(state, null, 2));
}

// Returns update info, null if up to date, or throws on network error
async function fetchLatestVersion(): Promise<{ version: string; url: string; notes?: string[] } | null> {
  const res = await net.fetch('https://emdyapp.com/version.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { version: string; notes?: string[] };
  if (!/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error('Invalid version format');
  const current = app.getVersion();
  const isNewer = data.version.localeCompare(current, undefined, { numeric: true }) > 0;
  if (!isNewer) return null;
  const url = `https://github.com/ghaida/emdy/releases/download/v${data.version}/Emdy-${data.version}-arm64.dmg`;
  return { version: data.version, url, notes: data.notes };
}

// Manual check — always fetches, ignores cooldown and skipped version
ipcMain.handle('app:check-update', async () => {
  try {
    const result = await fetchLatestVersion();
    const state = loadUpdateState();
    state.lastChecked = new Date().toISOString();
    saveUpdateState(state);
    return { ok: true, update: result };
  } catch {
    return { ok: false, update: null };
  }
});

// Proactive check — respects 24h cooldown and skipped version
ipcMain.handle('app:check-update-proactive', async () => {
  const state = loadUpdateState();
  if (state.lastChecked) {
    const hoursSince = (Date.now() - new Date(state.lastChecked).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return null;
  }
  try {
    const result = await fetchLatestVersion();
    state.lastChecked = new Date().toISOString();
    saveUpdateState(state);
    if (result && state.skippedVersion === result.version) return null;
    return result;
  } catch {
    return null;
  }
});

ipcMain.handle('app:skip-update', (_event, version: string) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) return;
  const state = loadUpdateState();
  state.skippedVersion = version;
  saveUpdateState(state);
});

// Register protocol to serve local files for markdown images
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { supportFetchAPI: true, standard: true } },
]);

app.on('ready', () => {
  protocol.handle('local-file', (request) => {
    const resolved = path.resolve(decodeURIComponent(request.url.replace('local-file://', '')));
    if (!isPathAllowed(resolved)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(resolved).href);
  });

  // Content Security Policy — only applied in production (Vite HMR needs looser policy)
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' local-file: data:; font-src 'self'; connect-src 'self' https://emdyapp.com",
          ],
        },
      });
    });
  }

  createWindow();
  nudgeTrackAppLaunch();
  buildMenu(sendMenuEvent);

  // Forward system accent color changes to renderer (macOS)
  systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', () => {
    const color = '#' + systemPreferences.getAccentColor().slice(0, 6);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('system:accent-color-changed', color);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle opening files/directories via OS (double-click, drag to dock, Open Recent)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  const win = mainWindow || BrowserWindow.getAllWindows()[0];
  if (win && win.webContents && !win.webContents.isLoading()) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        addAllowedRoot(filePath);
        const entries = await scanDirectory(filePath);
        win.webContents.send('dir:open', filePath, entries);
      } else {
        addAllowedRoot(path.dirname(filePath));
        const content = await fs.readFile(filePath, 'utf-8');
        win.webContents.send('file:open', filePath, content);
        app.addRecentDocument(filePath);
      }
    } catch {
      // File/directory can't be read
    }
  } else {
    // App is still launching — queue the path for when the window is ready
    pendingFilePath = filePath;
  }
});

let hasFileOpen = false;

ipcMain.handle('menu:set-has-file', (_event, hasFile: unknown) => {
  const value = Boolean(hasFile);
  if (value !== hasFileOpen) {
    hasFileOpen = value;
    buildMenu(sendMenuEvent, hasFileOpen);
  }
});

function sendMenuEvent(event: string) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:event', event);
  }
}
