import { ipcMain, BrowserWindow } from 'electron';
import chokidar, { type FSWatcher } from 'chokidar';
import { isPathAllowed } from './allowed-paths';
import { scanDirectory } from './ipc-handlers';

let fileWatcher: FSWatcher | null = null;
let dirWatcher: FSWatcher | null = null;
let dirRescanTimer: ReturnType<typeof setTimeout> | null = null;
let watchedDirPath: string | null = null;

const IGNORED_DIRS = /(^|[/\\])(node_modules|dist|build|out|\.vite|__pycache__|vendor|\.git|\.svn|coverage|\.next|\.nuxt)([/\\]|$)/;
const MD_EXT = /\.(md|markdown)$/i;
const RESCAN_DEBOUNCE_MS = 300;

export function registerFileWatcher() {
  ipcMain.handle('file:watch', (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !isPathAllowed(filePath)) return;
    stopFileWatcher();

    fileWatcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
    });

    fileWatcher.on('change', () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((win) => win.webContents.send('file:changed', filePath));
    });

    fileWatcher.on('unlink', () => {
      const wins = BrowserWindow.getAllWindows();
      wins.forEach((win) => win.webContents.send('file:deleted', filePath));
    });
  });

  ipcMain.handle('file:unwatch', () => {
    stopFileWatcher();
  });

  ipcMain.handle('dir:watch', (_event, dirPath: string) => {
    if (typeof dirPath !== 'string' || !isPathAllowed(dirPath)) return;
    stopDirWatcher();

    watchedDirPath = dirPath;

    dirWatcher = chokidar.watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: IGNORED_DIRS,
      ignorePermissionErrors: true,
    });

    const scheduleRescan = () => {
      if (dirRescanTimer) clearTimeout(dirRescanTimer);
      dirRescanTimer = setTimeout(async () => {
        dirRescanTimer = null;
        if (!watchedDirPath) return;
        try {
          const entries = await scanDirectory(watchedDirPath);
          const wins = BrowserWindow.getAllWindows();
          wins.forEach((win) => win.webContents.send('dir:entries-updated', entries));
        } catch {
          // Directory may have been removed
        }
      }, RESCAN_DEBOUNCE_MS);
    };

    // Only track structural changes (add/remove) for sidebar updates.
    // File content changes are handled by the per-file watcher (file:watch)
    // to avoid cross-contamination between files.
    dirWatcher.on('add', (addedPath) => {
      if (MD_EXT.test(addedPath)) {
        scheduleRescan();
      }
    });

    dirWatcher.on('unlink', (removedPath) => {
      if (MD_EXT.test(removedPath)) {
        scheduleRescan();
      }
    });
  });

  ipcMain.handle('dir:unwatch', () => {
    stopDirWatcher();
  });
}

function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}

function stopDirWatcher() {
  if (dirRescanTimer) {
    clearTimeout(dirRescanTimer);
    dirRescanTimer = null;
  }
  if (dirWatcher) {
    dirWatcher.close();
    dirWatcher = null;
  }
  watchedDirPath = null;
}
