// Pure rules for paths that reach Emdy from outside a window: the Dock,
// Finder, Open Recent and drops. Kept free of Electron imports so they can be
// unit-tested in isolation.

export interface RoutingWindow {
  id: number;
  /** True when the window shows no folder and no file (the welcome screen). */
  empty: boolean;
  lastFocusedAt: number;
}

const OPENABLE_FILE = /\.(md|markdown|txt)$/i;

/** Folders and Markdown or plain-text files can be dropped on a window. */
export function isOpenableDrop(filePath: string, isDirectory: boolean): boolean {
  return isDirectory || OPENABLE_FILE.test(filePath);
}

/**
 * The window a path from outside Emdy opens in: the focused window if it's
 * empty, otherwise the most recently focused empty window. Null means open a
 * new window.
 */
export function pickWindowForPath(windows: RoutingWindow[], focusedId: number | null): number | null {
  const empty = windows.filter((w) => w.empty);
  const focused = empty.find((w) => w.id === focusedId);
  if (focused) return focused.id;
  if (empty.length === 0) return null;
  return empty.reduce((latest, w) => (w.lastFocusedAt > latest.lastFocusedAt ? w : latest)).id;
}
