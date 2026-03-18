import { ipcMain, dialog, BrowserWindow, app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../renderer/lib/types';

let currentDirPath: string | null = null;

export function registerFileHandlers() {
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
    app.addRecentDocument(filePath);
    return { filePath, content };
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
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
    return { dirPath, entries: await scanDirectory(dirPath) };
  });

  ipcMain.handle('dir:scan', async (_event, dirPath: string) => {
    return scanDirectory(dirPath);
  });

  ipcMain.handle('file:show-in-folder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('file:open-new-window', async (_event, filePath: string) => {
    const { BrowserWindow } = await import('electron');
    const pathMod = await import('node:path');
    const fsMod = await import('node:fs/promises');
    const content = await fsMod.readFile(filePath, 'utf-8');
    const win = new BrowserWindow({
      width: 900,
      height: 650,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        preload: pathMod.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      win.loadFile(pathMod.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('file:open', filePath, content);
    });
  });

  ipcMain.handle('search:everything', async (_event, query: string) => {
    if (!currentDirPath || !query.trim()) return [];
    return searchEverything(currentDirPath, query.toLowerCase());
  });
}

async function scanDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.')) continue;
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
      if (item.name.startsWith('.')) continue;
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
