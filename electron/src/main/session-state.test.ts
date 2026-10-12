import { describe, it, expect } from 'vitest';
import {
  buildSession,
  fitBounds,
  parseSession,
  serializeSession,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type LiveWindow,
  type Rect,
  type SavedWindow,
} from './session-state';

const bounds: Rect = { x: 80, y: 60, width: 1000, height: 700 };

function live(overrides: Partial<LiveWindow>): LiveWindow {
  return { dirPath: null, filePath: null, scrollTop: 0, bounds, lastFocusedAt: 0, ...overrides };
}

describe('buildSession', () => {
  it('leaves out windows that show nothing', () => {
    const saved = buildSession([live({ filePath: '/a/one.md' }), live({}), live({ dirPath: '/b' })]);
    expect(saved.map((w) => w.filePath ?? w.dirPath)).toEqual(['/a/one.md', '/b']);
  });

  it('orders windows from least to most recently focused and drops the focus time', () => {
    const saved = buildSession([
      live({ filePath: '/late.md', lastFocusedAt: 300 }),
      live({ filePath: '/early.md', lastFocusedAt: 100 }),
    ]);
    expect(saved).toEqual([
      { dirPath: null, filePath: '/early.md', scrollTop: 0, bounds },
      { dirPath: null, filePath: '/late.md', scrollTop: 0, bounds },
    ]);
  });
});

describe('parseSession', () => {
  const docs: SavedWindow = { dirPath: '/docs', filePath: '/docs/intro.md', scrollTop: 1240, bounds };
  const todo: SavedWindow = { dirPath: null, filePath: '/notes/todo.md', scrollTop: 0, bounds: null };

  it('reads back what serializeSession writes', () => {
    expect(parseSession(JSON.parse(serializeSession([docs, todo])))).toEqual([docs, todo]);
  });

  it('returns nothing for junk or a version it does not know', () => {
    expect(parseSession(null)).toEqual([]);
    expect(parseSession('session')).toEqual([]);
    expect(parseSession([docs])).toEqual([]);
    expect(parseSession({ version: 1 })).toEqual([]);
    expect(parseSession({ version: 2, windows: [docs] })).toEqual([]);
  });

  it('drops entries with no path, a relative path or a path that is not a string', () => {
    const parsed = parseSession({
      version: 1,
      windows: [
        { dirPath: null, filePath: null, scrollTop: 0, bounds },
        { dirPath: 'docs', filePath: null, scrollTop: 0, bounds },
        { dirPath: null, filePath: 42, scrollTop: 0, bounds },
        'not a window',
        docs,
      ],
    });
    expect(parsed).toEqual([docs]);
  });

  it('falls back to the top and the default placement for bad scroll or bounds values', () => {
    const parsed = parseSession({
      version: 1,
      windows: [
        { dirPath: null, filePath: '/a.md', scrollTop: -5, bounds: { x: 0, y: 0, width: 0, height: 700 } },
        { dirPath: null, filePath: '/b.md', scrollTop: 'far', bounds: { x: 'left' } },
      ],
    });
    expect(parsed).toEqual([
      { dirPath: null, filePath: '/a.md', scrollTop: 0, bounds: null },
      { dirPath: null, filePath: '/b.md', scrollTop: 0, bounds: null },
    ]);
  });
});

describe('fitBounds', () => {
  // A 1440×900 main screen with a 25 px menu bar, and an external screen to its right.
  const primary: Rect = { x: 0, y: 25, width: 1440, height: 875 };
  const external: Rect = { x: 1440, y: 0, width: 1920, height: 1080 };

  it('keeps bounds whose title bar is on a screen', () => {
    expect(fitBounds({ x: 100, y: 100, width: 1000, height: 700 }, [primary], primary))
      .toEqual({ x: 100, y: 100, width: 1000, height: 700 });
    expect(fitBounds({ x: 1600, y: 100, width: 1200, height: 800 }, [primary, external], primary))
      .toEqual({ x: 1600, y: 100, width: 1200, height: 800 });
  });

  it('moves a window from a disconnected screen to the middle of the main screen', () => {
    expect(fitBounds({ x: 1600, y: 100, width: 1200, height: 800 }, [primary], primary))
      .toEqual({ x: 120, y: 63, width: 1200, height: 800 });
  });

  it('moves a window whose title bar is almost entirely off screen', () => {
    expect(fitBounds({ x: 1400, y: 100, width: 1000, height: 700 }, [primary], primary))
      .toEqual({ x: 220, y: 113, width: 1000, height: 700 });
  });

  it('shrinks an oversized window to the main screen when it moves it', () => {
    expect(fitBounds({ x: 4000, y: 0, width: 2560, height: 1400 }, [primary], primary))
      .toEqual({ x: 0, y: 25, width: 1440, height: 875 });
  });

  it('enforces the minimum window size', () => {
    expect(fitBounds({ x: 100, y: 100, width: 300, height: 200 }, [primary], primary))
      .toEqual({ x: 100, y: 100, width: MIN_WINDOW_WIDTH, height: MIN_WINDOW_HEIGHT });
  });

  it('returns null when there are no saved bounds', () => {
    expect(fitBounds(null, [primary], primary)).toBeNull();
  });
});
