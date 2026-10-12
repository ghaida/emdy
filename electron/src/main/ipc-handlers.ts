import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nudgeTrackFileOpen } from './settings-store';
import { addAllowedRoot, isPathAllowed } from './allowed-paths';
import { noteRecent } from './recents';
import { IGNORED_DIRS, scanDirectory } from './scan-directory';
import { openPathInNewWindow } from './windows';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
      addAllowedRoot(selected);
      noteRecent(selected);
      return { type: 'directory' as const, dirPath: selected, entries: await scanDirectory(selected) };
    }
    const content = await fs.readFile(selected, 'utf-8');
    addAllowedRoot(path.dirname(selected));
    noteRecent(selected);
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
    addAllowedRoot(path.dirname(filePath));
    noteRecent(filePath);
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

  ipcMain.handle('open:dialog-in-new-window', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    await openPathInNewWindow(result.filePaths[0]);
    noteRecent(result.filePaths[0]);
    return { opened: true };
  });

  ipcMain.handle('search:everything', async (_event, query: string, rootPath: string) => {
    if (typeof query !== 'string' || !query.trim()) return [];
    if (typeof rootPath !== 'string' || !isPathAllowed(rootPath)) return [];
    return searchEverything(rootPath, query.toLowerCase());
  });
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
