import path from 'node:path';
import fs from 'node:fs';
import type { BrowserWindow } from 'electron';

/**
 * Tracks which directories the user has explicitly opened, so that
 * IPC handlers and the local-file:// protocol can restrict file access
 * to those directories only.
 */
const allowedRoots = new Set<string>();

/** Register a directory tree as accessible. */
export function addAllowedRoot(dirPath: string) {
  allowedRoots.add(path.resolve(dirPath) + path.sep);
}

/** Check whether a file path falls inside any allowed root. */
export function isPathAllowed(filePath: string): boolean {
  let resolved: string;
  try {
    // Resolve symlinks so a link inside an allowed dir can't escape it
    resolved = fs.realpathSync(path.resolve(filePath));
  } catch {
    // File doesn't exist yet or is inaccessible — fall back to logical path
    resolved = path.resolve(filePath);
  }
  for (const root of allowedRoots) {
    if (resolved === root.slice(0, -1) || resolved.startsWith(root)) {
      return true;
    }
  }
  return false;
}

/** Block navigation and window.open on a BrowserWindow. */
export function hardenWindow(win: BrowserWindow) {
  win.webContents.on('will-navigate', (event) => { event.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/** Escape a string for safe inclusion in HTML. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
