import fs from 'node:fs';
import path from 'node:path';
import { ipcMain, webContents } from 'electron';
import { watch, type FSWatcher } from 'chokidar';
import { isPathAllowed } from './allowed-paths';
import { scanDirectory } from './scan-directory';

interface RootWatcher {
  watcher: FSWatcher;
  subscribers: Set<number>;
  rescanTimer: ReturnType<typeof setTimeout> | null;
}

const fileWatchers = new Map<number, FSWatcher>();
// One watcher per opened folder, shared by every window showing it.
const rootWatchers = new Map<string, RootWatcher>();
const rootByWc = new Map<number, string>();
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
  const root = rootByWc.get(wcId);
  if (!root) return;
  rootByWc.delete(wcId);
  const entry = rootWatchers.get(root);
  if (!entry) return;
  entry.subscribers.delete(wcId);
  if (entry.subscribers.size === 0) {
    if (entry.rescanTimer) clearTimeout(entry.rescanTimer);
    entry.watcher.close();
    rootWatchers.delete(root);
  }
}

// Watch folders only, plus Markdown files. Below the root, dot folders and
// build output are skipped the way the sidebar skips them. The root itself
// never is, so a folder like ~/.claude, or one inside build/, is still watched.
function ignoredBelow(root: string) {
  const prefix = path.join(root, '/');
  return (p: string, stats?: { isFile(): boolean }): boolean => {
    if (!p.startsWith(prefix)) return false;
    const below = p.slice(prefix.length);
    if (IGNORED_DIRS.test(below) || below.split('/').some((name) => name.startsWith('.'))) return true;
    return Boolean(stats?.isFile()) && !MD_EXT.test(p);
  };
}

function watchRoot(dirPath: string): RootWatcher {
  const existing = rootWatchers.get(dirPath);
  if (existing) return existing;
  // With followSymlinks off, chokidar doesn't look inside a root that is
  // itself a symlink, so watch the folder the path leads to. Rescans still
  // read dirPath, so windows get paths under the folder they opened.
  let realRoot = dirPath;
  try {
    realRoot = fs.realpathSync(dirPath);
  } catch {
    // Folder is gone or unreadable; chokidar finds nothing there either
  }
  const watcher = watch(realRoot, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    ignorePermissionErrors: true,
    ignored: ignoredBelow(realRoot),
  });
  const entry: RootWatcher = { watcher, subscribers: new Set(), rescanTimer: null };
  const scheduleRescan = () => {
    if (entry.rescanTimer) clearTimeout(entry.rescanTimer);
    entry.rescanTimer = setTimeout(async () => {
      entry.rescanTimer = null;
      try {
        const entries = await scanDirectory(dirPath);
        for (const id of entry.subscribers) {
          const wc = webContents.fromId(id);
          if (wc && !wc.isDestroyed()) wc.send('dir:entries-updated', entries);
        }
      } catch {
        // Directory may have been removed
      }
    }, RESCAN_DEBOUNCE_MS);
  };
  // Only structural changes (add/remove) matter for the sidebar; content
  // changes are handled by the per-file watcher.
  watcher.on('add', scheduleRescan);
  watcher.on('unlink', scheduleRescan);
  watcher.on('addDir', scheduleRescan);
  watcher.on('unlinkDir', scheduleRescan);
  // An error with no listener (say, too many open files) would throw out of
  // main, so log it and keep watching.
  watcher.on('error', (error) => {
    console.error('Watching folder failed:', dirPath, error);
  });
  rootWatchers.set(dirPath, entry);
  return entry;
}

export function registerFileWatcher() {
  ipcMain.handle('file:watch', (event, filePath: string) => {
    if (typeof filePath !== 'string' || !isPathAllowed(filePath)) return;
    const wc = event.sender;
    ensureCleanup(wc);
    cleanupFileWatcher(wc.id);

    const watcher = watch(filePath, {
      persistent: true,
      ignoreInitial: true,
    });
    fileWatchers.set(wc.id, watcher);

    watcher.on('change', () => {
      if (!wc.isDestroyed()) wc.send('file:changed', filePath);
    });
    // The file came back after a delete (git checkout, Put Back from Trash).
    watcher.on('add', () => {
      if (!wc.isDestroyed()) wc.send('file:changed', filePath);
    });
    watcher.on('unlink', () => {
      if (!wc.isDestroyed()) wc.send('file:deleted', filePath);
    });
    watcher.on('error', (error) => {
      console.error('Watching file failed:', filePath, error);
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
    watchRoot(dirPath).subscribers.add(wc.id);
    rootByWc.set(wc.id, dirPath);
  });

  ipcMain.handle('dir:unwatch', (event) => {
    cleanupDirWatcher(event.sender.id);
  });
}
