import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import { registerFileHandlers } from './ipc-handlers';
import { registerSettingsHandlers } from './settings-store';
import { registerFileWatcher } from './file-watcher';
import { registerExportHandlers } from './pdf-export';
import { buildMenu } from './menu';

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

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

  // Open DevTools in dev mode
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // Handle drag-and-drop
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
};

registerFileHandlers();
registerSettingsHandlers();
registerFileWatcher();
registerExportHandlers();

app.on('ready', () => {
  createWindow();
  buildMenu(sendMenuEvent);
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

// Handle opening files via OS (double-click, Open Recent, etc.)
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const win = mainWindow || BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('file:open', filePath, content);
      app.addRecentDocument(filePath);
    }
  } catch {
    // File can't be read
  }
});

function sendMenuEvent(event: string) {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win) {
    win.webContents.send('menu:event', event);
  }
}
