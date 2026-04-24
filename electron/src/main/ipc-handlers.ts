import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../renderer/lib/types';
import { nudgeTrackFileOpen } from './settings-store';
import { addAllowedRoot, isPathAllowed, hardenWindow } from './allowed-paths';
import { getWindowBackgroundColor } from './window-theme';

let currentDirPath: string | null = null;
let currentFilePath: string | null = null;
const pendingWindowIds = new Set<number>();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function setCurrentPaths(opts: { dirPath?: string; filePath?: string }) {
  if (opts.dirPath !== undefined) currentDirPath = opts.dirPath;
  if (opts.filePath !== undefined) currentFilePath = opts.filePath;
}

export function registerFileHandlers() {
  // Combined open dialog — allows selecting either a file or a directory
  ipcMain.handle('open:dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = result.filePaths[0];
    const stat = await fs.stat(selected);
    if (stat.isDirectory()) {
      currentDirPath = selected;
      addAllowedRoot(selected);
      return { type: 'directory' as const, dirPath: selected, entries: await scanDirectory(selected) };
    }
    const content = await fs.readFile(selected, 'utf-8');
    currentFilePath = selected;
    addAllowedRoot(path.dirname(selected));
    app.addRecentDocument(selected);
    return { type: 'file' as const, filePath: selected, content };
  });

  ipcMain.handle('file:open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    currentFilePath = filePath;
    addAllowedRoot(path.dirname(filePath));
    app.addRecentDocument(filePath);
    return { filePath, content };
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    if (typeof filePath !== 'string') throw new Error('Invalid argument');
    if (!isPathAllowed(filePath)) throw new Error('Access denied');
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_SIZE) throw new Error('File too large (>10 MB)');
    nudgeTrackFileOpen();
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('dir:open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dirPath = result.filePaths[0];
    currentDirPath = dirPath;
    addAllowedRoot(dirPath);
    return { dirPath, entries: await scanDirectory(dirPath) };
  });

  ipcMain.handle('dir:scan', async (_event, dirPath: string) => {
    if (typeof dirPath !== 'string') throw new Error('Invalid argument');
    if (!isPathAllowed(dirPath)) throw new Error('Access denied');
    return scanDirectory(dirPath);
  });

  ipcMain.handle('file:show-in-folder', (_event, filePath: string) => {
    if (typeof filePath !== 'string') return;
    if (!isPathAllowed(filePath)) return;
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('file:open-new-window', async (_event, pathToOpen: string) => {
    if (typeof pathToOpen !== 'string') throw new Error('Invalid argument');
    if (!isPathAllowed(pathToOpen)) throw new Error('Access denied');
    await openPathInNewWindow(pathToOpen);
  });

  ipcMain.handle('window:is-pending-open', (event) => {
    // Do NOT delete on read — React StrictMode invokes this twice in dev.
    // Renderer clears its own pending state when file:open or dir:open arrives.
    // The set entry is removed when the window closes.
    return pendingWindowIds.has(event.sender.id);
  });

  ipcMain.handle('open:dialog-in-new-window', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    await openPathInNewWindow(result.filePaths[0]);
    return { opened: true };
  });

  ipcMain.handle('search:everything', async (_event, query: string) => {
    if (typeof query !== 'string' || !query.trim()) return [];
    const searchDir = currentDirPath || (currentFilePath ? path.dirname(currentFilePath) : null);
    if (!searchDir) return [];
    return searchEverything(searchDir, query.toLowerCase());
  });
}

export async function openPathInNewWindow(pathToOpen: string): Promise<void> {
  const stat = await fs.stat(pathToOpen);
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: getWindowBackgroundColor(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  pendingWindowIds.add(win.webContents.id);
  win.on('closed', () => pendingWindowIds.delete(win.webContents.id));
  let shown = false;
  const showOnce = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
  };
  win.once('ready-to-show', showOnce);
  setTimeout(showOnce, 2000);

  const loadWithPendingFlag = () => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
  };

  if (stat.isDirectory()) {
    addAllowedRoot(pathToOpen);
    currentDirPath = pathToOpen;
    const entries = await scanDirectory(pathToOpen);
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('dir:open', pathToOpen, entries);
    });
    loadWithPendingFlag();
  } else {
    if (!isPathAllowed(pathToOpen)) addAllowedRoot(path.dirname(pathToOpen));
    const content = await fs.readFile(pathToOpen, 'utf-8');
    currentFilePath = pathToOpen;
    app.addRecentDocument(pathToOpen);
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('file:open', pathToOpen, content);
    });
    loadWithPendingFlag();
  }
  hardenWindow(win);
}

const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.vite', '__pycache__',
  'vendor', '.git', '.svn', 'coverage', '.next', '.nuxt',
]);

export async function scanDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || IGNORED_DIRS.has(item.name)) continue;
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const children = await scanDirectory(fullPath);
        if (children.length > 0) {
          entries.push({ name: item.name, path: fullPath, isDirectory: true, children });
        }
      } else if (/\.(md|markdown)$/i.test(item.name)) {
        entries.push({ name: item.name, path: fullPath, isDirectory: false });
      }
    }
  } catch {
    // Permission denied or similar
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

interface SearchResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
}

async function searchEverything(dirPath: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const files = await collectAllFiles(dirPath);

  for (const file of files) {
    const fileName = path.basename(file);

    // File name match
    if (fileName.toLowerCase().includes(query)) {
      results.push({ filePath: file, fileName, type: 'file' });
    }

    // Content search
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query)) {
          results.push({
            filePath: file,
            fileName,
            matchLine: lines[i].substring(0, 120),
            lineNumber: i + 1,
            type: 'content',
          });
          // Limit content matches per file
          if (results.filter((r) => r.filePath === file && r.type === 'content').length >= 3) break;
        }
      }
    } catch {
      // Can't read file
    }

    // Limit total results
    if (results.length >= 50) break;
  }

  // Sort: file name matches first, then content matches
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'file' ? -1 : 1;
    return a.fileName.localeCompare(b.fileName);
  });

  return results;
}

async function collectAllFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || IGNORED_DIRS.has(item.name)) continue;
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        files.push(...await collectAllFiles(fullPath));
      } else if (/\.(md|markdown)$/i.test(item.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // skip
  }
  return files;
}
