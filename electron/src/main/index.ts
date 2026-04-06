import { app, BrowserWindow, ipcMain, protocol, net, systemPreferences, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { registerFileHandlers } from './ipc-handlers';
import { registerSettingsHandlers, registerNudgeHandlers, nudgeTrackAppLaunch } from './settings-store';
import { registerFileWatcher } from './file-watcher';
import { registerExportHandlers } from './pdf-export';
import { buildMenu } from './menu';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Handle drag-and-drop
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // Send pending file from dock drop / double-click during launch
  mainWindow.webContents.once('did-finish-load', async () => {
    if (pendingFilePath) {
      try {
        const content = await fs.readFile(pendingFilePath, 'utf-8');
        mainWindow?.webContents.send('file:open', pendingFilePath, content);
        app.addRecentDocument(pendingFilePath);
      } catch {
        // File can't be read
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
  shell.openExternal(url);
});

// Register protocol to serve local files for markdown images
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, supportFetchAPI: true, standard: true } },
]);

app.on('ready', () => {
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    return net.fetch(pathToFileURL(filePath).href);
  });
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

// Handle opening files via OS (double-click, drag to dock, Open Recent)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  const win = mainWindow || BrowserWindow.getAllWindows()[0];
  if (win && win.webContents && !win.webContents.isLoading()) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      win.webContents.send('file:open', filePath, content);
      app.addRecentDocument(filePath);
    } catch {
      // File can't be read
    }
  } else {
    // App is still launching — queue the file for when the window is ready
    pendingFilePath = filePath;
  }
});

function sendMenuEvent(event: string) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:event', event);
  }
}
