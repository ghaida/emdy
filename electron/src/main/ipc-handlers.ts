import { app, ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nudgeTrackFileOpen } from './settings-store';
import { addAllowedRoot, isPathAllowed } from './allowed-paths';
import { noteRecent, recentPaths } from './recents';
import { readTextFile } from './read-text';
import { scanDirectory } from './scan-directory';
import { registerSearch, searchFiles } from './search';
import { isTextDocument } from '../shared/paths';
import type { SearchScope } from '../renderer/lib/types';
import { loadedFilePath, openPathInNewWindow, recordLoadedFile, windowPaths } from './windows';

// Where Open… starts: the window's folder, else its file's folder. A window
// that shows nothing starts at the newest Open Recent entry (in it when it's a
// folder, else in its folder), else at home. With no defaultPath, Electron (43
// and later) would start in Downloads.
async function openDialogStart(sender: Electron.WebContents): Promise<string> {
  const { dirPath, filePath } = windowPaths(sender);
  if (dirPath) return dirPath;
  if (filePath) return path.dirname(filePath);
  const [newest] = await recentPaths();
  if (newest) {
    try {
      return (await fs.stat(newest)).isDirectory() ? newest : path.dirname(newest);
    } catch {
      // Gone since the list was checked.
    }
  }
  return app.getPath('home');
}

export function registerFileHandlers() {
  // Combined open dialog — allows selecting either a file or a directory
  ipcMain.handle('open:dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      defaultPath: await openDialogStart(event.sender),
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const selected = result.filePaths[0];
    const stat = await fs.stat(selected);
    if (stat.isDirectory()) {
      addAllowedRoot(selected);
      noteRecent(selected);
      const entries = await scanDirectory(selected);
      // The window's file now comes from the folder, through the allowlist.
      recordLoadedFile(event.sender, null);
      return { type: 'directory' as const, dirPath: selected, entries };
    }
    const content = await readTextFile(selected);
    addAllowedRoot(path.dirname(selected));
    noteRecent(selected);
    // Main hands the file to this window, so live reload may read it again.
    recordLoadedFile(event.sender, selected);
    return { type: 'file' as const, filePath: selected, content };
  });

  ipcMain.handle('file:open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      defaultPath: await openDialogStart(event.sender),
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await readTextFile(filePath);
    addAllowedRoot(path.dirname(filePath));
    noteRecent(filePath);
    recordLoadedFile(event.sender, filePath);
    return { filePath, content };
  });

  ipcMain.handle('file:read', async (event, filePath: string) => {
    if (typeof filePath !== 'string') throw new Error('Invalid argument');
    // A link is checked and read where it leads, so a setup.md that links to
    // .env is refused.
    let realPath: string;
    try {
      realPath = realpathSync(filePath);
    } catch {
      throw new Error('File not found');
    }
    if (!isPathAllowed(realPath)) throw new Error('Access denied');
    // Markdown and plain text, or the very file main sent this window, which
    // can be a .mkd or a .log from Finder or the Open dialog: live reload
    // reads it again.
    if (!isTextDocument(realPath) && filePath !== loadedFilePath(event.sender)) throw new Error('Access denied');
    nudgeTrackFileOpen();
    return readTextFile(realPath);
  });

  ipcMain.handle('dir:open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      defaultPath: await openDialogStart(event.sender),
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
      defaultPath: await openDialogStart(event.sender),
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    await openPathInNewWindow(result.filePaths[0]);
    noteRecent(result.filePaths[0]);
    return { opened: true };
  });

  // Each window's newest query wins: an older one stops between files. The
  // generation is registered before anything else, so an empty query (a
  // cleared field or a closed palette) stops the search in flight and reads
  // nothing.
  ipcMain.handle('search:everything', async (event, query: unknown, scope: unknown, generation: unknown) => {
    if (typeof generation !== 'number') return [];
    const isStale = registerSearch(event.sender.id, generation);
    if (typeof query !== 'string' || !query.trim()) return [];
    if (typeof scope !== 'object' || scope === null) return [];
    const { rootPath, filePath } = scope as Record<string, unknown>;
    const checked: SearchScope = {
      rootPath: typeof rootPath === 'string' && isPathAllowed(rootPath) ? rootPath : null,
      filePath: typeof filePath === 'string' && isPathAllowed(filePath) ? filePath : null,
    };
    if (!checked.rootPath && !checked.filePath) return [];
    return searchFiles(checked, query, isStale);
  });
}
