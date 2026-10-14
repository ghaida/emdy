// Emdy's Open Recent list: the last files and folders opened from outside a
// window, kept in userData so the menu can show full paths (macOS's own list
// only shows names). macOS is still told about each one, so the Dock icon's
// right-click list keeps working.
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './atomic-write';
import { parseRecents, withRecent } from './recent-list';

let recents: string[] | null = null;
const listeners: Array<() => void> = [];

function recentsPath(): string {
  return path.join(app.getPath('userData'), 'recents.json');
}

function load(): string[] {
  if (recents === null) {
    try {
      recents = parseRecents(JSON.parse(fs.readFileSync(recentsPath(), 'utf-8')));
    } catch {
      recents = []; // No file yet, or one that isn't JSON.
    }
  }
  return recents;
}

function save(list: string[]) {
  recents = list;
  try {
    writeJsonAtomic(recentsPath(), list);
  } catch {
    // userData isn't writable; the list still works until Emdy quits.
  }
  for (const listener of listeners) listener();
}

/** Puts a file or folder opened from outside at the top of the list. */
export function noteRecent(filePath: string) {
  app.addRecentDocument(filePath);
  save(withRecent(load(), filePath));
}

/** Drops a path that turned out not to open. */
export function forgetRecent(filePath: string) {
  save(load().filter((p) => p !== filePath));
}

export function clearRecents() {
  app.clearRecentDocuments();
  save([]);
}

/** The list for the menu, newest first, leaving out anything moved or deleted since. */
export function recentPaths(): string[] {
  return load().filter((p) => fs.existsSync(p));
}

export function onRecentsChange(listener: () => void) {
  listeners.push(listener);
}
