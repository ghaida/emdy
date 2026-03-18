import { ipcMain, BrowserWindow } from 'electron';
import chokidar, { type FSWatcher } from 'chokidar';

let watcher: FSWatcher | null = null;

export function registerFileWatcher() {
  ipcMain.handle('file:watch', (_event, filePath: string) => {
    stopWatcher();

    watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((win) => win.webContents.send('file:changed', filePath));
    });

    watcher.on('unlink', () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((win) => win.webContents.send('file:deleted', filePath));
    });
  });

  ipcMain.handle('file:unwatch', () => {
    stopWatcher();
  });
}

function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
