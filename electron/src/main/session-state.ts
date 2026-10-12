// Pure rules for session.json: which windows are saved, how the file is read
// back, and where a restored window goes. Kept free of Electron imports so
// they can be unit-tested in isolation.
import path from 'node:path';

export const SESSION_VERSION = 1;
export const MIN_WINDOW_WIDTH = 600;
export const MIN_WINDOW_HEIGHT = 400;

// A restored window stays where it was only if a strip this big along its top
// edge is on some screen, so its title bar can still be grabbed.
const GRAB_WIDTH = 100;
const GRAB_HEIGHT = 32;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SavedWindow {
  dirPath: string | null;
  filePath: string | null;
  scrollTop: number;
  bounds: Rect | null;
}

export interface LiveWindow extends SavedWindow {
  lastFocusedAt: number;
}

/** The windows worth saving (they show a folder or file), least recently focused first. */
export function buildSession(windows: LiveWindow[]): SavedWindow[] {
  return windows
    .filter((w) => w.dirPath !== null || w.filePath !== null)
    .sort((a, b) => a.lastFocusedAt - b.lastFocusedAt)
    .map(({ dirPath, filePath, scrollTop, bounds }) => ({ dirPath, filePath, scrollTop, bounds }));
}

export function serializeSession(windows: SavedWindow[]): string {
  return JSON.stringify({ version: SESSION_VERSION, windows }, null, 2);
}

/** Reads session.json's parsed JSON. Anything malformed is dropped, not trusted. */
export function parseSession(raw: unknown): SavedWindow[] {
  if (!isRecord(raw) || raw.version !== SESSION_VERSION || !Array.isArray(raw.windows)) return [];
  const windows: SavedWindow[] = [];
  for (const entry of raw.windows) {
    if (!isRecord(entry)) continue;
    const dirPath = readPath(entry.dirPath);
    const filePath = readPath(entry.filePath);
    if (dirPath === undefined || filePath === undefined) continue;
    if (dirPath === null && filePath === null) continue;
    const { scrollTop } = entry;
    windows.push({
      dirPath,
      filePath,
      scrollTop: isFiniteNumber(scrollTop) && scrollTop >= 0 ? scrollTop : 0,
      bounds: readRect(entry.bounds),
    });
  }
  return windows;
}

/**
 * Where a restored window goes: its saved bounds if its title bar is still on
 * a screen, otherwise its saved size (no bigger than the main screen) centered
 * on the main screen. Null means there are no saved bounds; use the default.
 */
export function fitBounds(saved: Rect | null, workAreas: Rect[], primary: Rect): Rect | null {
  if (!saved) return null;
  const x = Math.round(saved.x);
  const y = Math.round(saved.y);
  const width = Math.max(MIN_WINDOW_WIDTH, Math.round(saved.width));
  const height = Math.max(MIN_WINDOW_HEIGHT, Math.round(saved.height));
  const titleBar: Rect = { x, y, width, height: GRAB_HEIGHT };
  const onScreen = workAreas.some((area) => {
    const overlap = intersection(titleBar, area);
    return overlap.width >= GRAB_WIDTH && overlap.height >= GRAB_HEIGHT;
  });
  if (onScreen) return { x, y, width, height };
  const fittedWidth = Math.min(width, primary.width);
  const fittedHeight = Math.min(height, primary.height);
  return {
    x: primary.x + Math.round((primary.width - fittedWidth) / 2),
    y: primary.y + Math.round((primary.height - fittedHeight) / 2),
    width: fittedWidth,
    height: fittedHeight,
  };
}

function intersection(a: Rect, b: Rect): { width: number; height: number } {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// null when absent; undefined when present but not an absolute path.
function readPath(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' && path.isAbsolute(value) ? value : undefined;
}

function readRect(value: unknown): Rect | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}
