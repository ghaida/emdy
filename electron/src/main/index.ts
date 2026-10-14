import { app, autoUpdater, BrowserWindow, ipcMain, protocol, net, session, systemPreferences, shell } from 'electron';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { registerFileHandlers } from './ipc-handlers';
import { registerSettingsHandlers, registerNudgeHandlers, nudgeTrackAppLaunch } from './settings-store';
import { registerFileWatcher } from './file-watcher';
import { registerExportHandlers } from './pdf-export';
import { buildMenu } from './menu';
import { isPathAllowed } from './allowed-paths';
import { localFilePathFromUrl } from './local-file';
import { setupAutoUpdater, registerAutoUpdaterIPC } from './auto-updater';
import {
  registerWindowHandlers,
  startWindows,
  openFromOutside,
  handleActivate,
  lastFocusedWindow,
  prepareForQuit,
  prepareForUpdateRestart,
  cancelQuit,
  sendMenuEventWithoutWindow,
  sendWhenReadyTo,
  focusedWindowHasFile,
  onWindowFocus,
  setWindowHasFile,
} from './windows';
import { clearRecents, forgetRecent, onRecentsChange, recentPaths } from './recents';

if (started) {
  app.quit();
}

// Prevent macOS Keychain "confidential information" dialog on first launch.
// Emdy stores nothing sensitive in web storage, so encrypted storage is unnecessary.
app.commandLine.appendSwitch('use-mock-keychain');

// Files and folders Emdy was launched with (double-click, Dock drop, Open
// With) arrive before ready and wait here for startWindows.
const launchPaths: string[] = [];

ipcMain.handle('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

registerFileHandlers();
registerWindowHandlers();
registerSettingsHandlers();
registerFileWatcher();
registerExportHandlers();
registerNudgeHandlers();
registerAutoUpdaterIPC();

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
      shell.openExternal(parsed.href);
    }
  } catch {
    // Invalid URL — ignore
  }
});

// Register protocol to serve local files for markdown images
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { supportFetchAPI: true, standard: true } },
]);

app.on('ready', () => {
  // Electron would approve every permission a page asks for. Emdy's pages need
  // one: clipboard-sanitized-write, which navigator.clipboard.writeText uses
  // for the Copy buttons on code blocks and diagrams. Camera, microphone,
  // location, notifications and the rest are refused.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(permission === 'clipboard-sanitized-write'),
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write');

  // Images next to an open file. The renderer builds these URLs (image-url.ts);
  // anything else, or anything outside an opened folder, is refused.
  protocol.handle('local-file', (request) => {
    const filePath = localFilePathFromUrl(request.url);
    if (!filePath || !isPathAllowed(filePath)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).href);
  });

  // Content Security Policy — only applied in production (Vite HMR needs looser policy)
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' local-file: data: https:; font-src 'self'; connect-src 'self' https://emdyapp.com; object-src 'none'; base-uri 'self'; form-action 'none'",
          ],
        },
      });
    });
  }

  void startWindows(launchPaths);
  nudgeTrackAppLaunch();
  rebuildMenu();
  onRecentsChange(rebuildMenu);
  onWindowFocus(rebuildMenu);
  setupAutoUpdater();

  // Forward system accent color changes to renderer (macOS)
  systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', () => {
    const color = '#' + systemPreferences.getAccentColor().slice(0, 6);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('system:accent-color-changed', color);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', handleActivate);

// Save the open windows before quitting. An update restart closes the windows
// before before-quit fires, so it needs its own hook. If Squirrel then fails
// to install the update, Emdy keeps running and the restart is called off.
// Electron retries a failed install the next time the last window closes, so
// ⌘W can restart Emdy into the update, and cancelQuit must be safe to run again.
app.on('before-quit', prepareForQuit);
autoUpdater.on('before-quit-for-update', prepareForUpdateRestart);
autoUpdater.on('error', cancelQuit);

// Opening files and folders from outside Emdy: double-click, Dock drop, Open
// With, the Dock icon's recent list.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!app.isReady()) {
    launchPaths.push(filePath);
    return;
  }
  openFromOutside(filePath).catch(() => {
    // File/directory can't be read
  });
});

ipcMain.handle('menu:set-has-file', (event, hasFile: unknown) => {
  setWindowHasFile(event.sender, Boolean(hasFile));
  rebuildMenu();
});

// The menu describes the focused window, so it's rebuilt when focus moves or a
// window closes.
let lastMenuSignature = '';
function rebuildMenu() {
  const hasFile = focusedWindowHasFile();
  const paths = recentPaths();
  const signature = `${hasFile}|${paths.join('\n')}`;
  if (signature === lastMenuSignature) return;
  lastMenuSignature = signature;
  buildMenu(sendMenuEvent, hasFile, { paths, open: openRecent, clear: clearRecents });
}

// An entry that no longer opens (moved, deleted, unreadable) drops off the list.
function openRecent(filePath: string) {
  openFromOutside(filePath).catch(() => forgetRecent(filePath));
}

function sendMenuEvent(event: string) {
  const win = BrowserWindow.getFocusedWindow() ?? lastFocusedWindow();
  if (win && !win.isDestroyed()) {
    sendWhenReadyTo(win.webContents, 'menu:event', event);
  } else {
    sendMenuEventWithoutWindow(event);
  }
}
