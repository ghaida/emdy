// Pure rules for Emdy's Open Recent list. Kept free of Electron imports so
// they can be unit-tested in isolation.
import path from 'node:path';

export const MAX_RECENTS = 10;

/** The list with `added` first, without an earlier copy of it, capped at ten. */
export function withRecent(list: string[], added: string): string[] {
  return [added, ...list.filter((p) => p !== added)].slice(0, MAX_RECENTS);
}

/** Reads recents.json's parsed JSON; anything that isn't an absolute path is dropped. */
export function parseRecents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const paths = raw.filter((p): p is string => typeof p === 'string' && path.isAbsolute(p));
  return [...new Set(paths)].slice(0, MAX_RECENTS);
}

/** The path as Open Recent shows it, with the home folder written as ~. */
export function recentLabel(filePath: string, home: string): string {
  if (filePath === home) return '~';
  return filePath.startsWith(`${home}/`) ? `~${filePath.slice(home.length)}` : filePath;
}
