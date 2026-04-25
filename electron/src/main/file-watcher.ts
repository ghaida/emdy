import { ipcMain } from 'electron';
import chokidar, { type FSWatcher } from 'chokidar';
import { isPathAllowed } from './allowed-paths';
import { scanDirectory } from './ipc-handlers';

interface DirWatcherEntry {
  watcher: FSWatcher;
  path: string;
  rescanTimer: ReturnType<typeof setTimeout> | null;
}

const fileWatchers = new Map<number, FSWatcher>();
const dirWatchers = new Map<number, DirWatcherEntry>();
const cleanupRegistered = new Set<number>();

const IGNORED_DIRS = /(^|[/\\])(node_modules|dist|build|out|\.vite|__pycache__|vendor|\.git|\.svn|coverage|\.next|\.nuxt)([/\\]|$)/;
const MD_EXT = /\.(md|markdown)$/i;
const RESCAN_DEBOUNCE_MS = 300;

function ensureCleanup(wc: Electron.WebContents) {
  const wcId = wc.id;
  if (cleanupRegistered.has(wcId)) return;
  cleanupRegistered.add(wcId);
  wc.once('destroyed', () => {
    cleanupFileWatcher(wcId);
    cleanupDirWatcher(wcId);
    cleanupRegistered.delete(wcId);
  });
}

function cleanupFileWatcher(wcId: number) {
  const watcher = fileWatchers.get(wcId);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(wcId);
  }
}

function cleanupDirWatcher(wcId: number) {
  const entry = dirWatchers.get(wcId);
  if (entry) {
    if (entry.rescanTimer) clearTimeout(entry.rescanTimer);
    entry.watcher.close();
    dirWatchers.delete(wcId);
  }
}

export function registerFileWatcher() {
  ipcMain.handle('file:watch', (event, filePath: string) => {
    if (typeof filePath !== 'string' || !isPathAllowed(filePath)) return;
    const wc = event.sender;
    ensureCleanup(wc);
    cleanupFileWatcher(wc.id);

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
    });
    fileWatchers.set(wc.id, watcher);

    watcher.on('change', () => {
      if (!wc.isDestroyed()) wc.send('file:changed', filePath);
    });
    watcher.on('unlink', () => {
      if (!wc.isDestroyed()) wc.send('file:deleted', filePath);
    });
  });

  ipcMain.handle('file:unwatch', (event) => {
    cleanupFileWatcher(event.sender.id);
  });

  ipcMain.handle('dir:watch', (event, dirPath: string) => {
    if (typeof dirPath !== 'string' || !isPathAllowed(dirPath)) return;
    const wc = event.sender;
    ensureCleanup(wc);
    cleanupDirWatcher(wc.id);

    const watcher = chokidar.watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      ignored: IGNORED_DIRS,
      ignorePermissionErrors: true,
    });

    const entry: DirWatcherEntry = { watcher, path: dirPath, rescanTimer: null };
    dirWatchers.set(wc.id, entry);

    const scheduleRescan = () => {
      if (entry.rescanTimer) clearTimeout(entry.rescanTimer);
      entry.rescanTimer = setTimeout(async () => {
        entry.rescanTimer = null;
        try {
          const entries = await scanDirectory(entry.path);
          if (!wc.isDestroyed()) wc.send('dir:entries-updated', entries);
        } catch {
          // Directory may have been removed
        }
      }, RESCAN_DEBOUNCE_MS);
    };

    // Only track structural changes (add/remove) for sidebar updates.
    // File content changes are handled by the per-file watcher (file:watch)
    // to avoid cross-contamination between files.
    watcher.on('add', (addedPath) => {
      if (MD_EXT.test(addedPath)) scheduleRescan();
    });
    watcher.on('unlink', (removedPath) => {
      if (MD_EXT.test(removedPath)) scheduleRescan();
    });
  });

  ipcMain.handle('dir:unwatch', (event) => {
    cleanupDirWatcher(event.sender.id);
  });
}
