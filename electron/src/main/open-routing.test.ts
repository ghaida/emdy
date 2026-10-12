import { describe, it, expect } from 'vitest';
import { isOpenableDrop, pickWindowForPath, type RoutingWindow } from './open-routing';

describe('isOpenableDrop', () => {
  it('accepts Markdown and plain-text files in any case', () => {
    expect(isOpenableDrop('/notes/readme.md', false)).toBe(true);
    expect(isOpenableDrop('/notes/README.MD', false)).toBe(true);
    expect(isOpenableDrop('/notes/guide.markdown', false)).toBe(true);
    expect(isOpenableDrop('/notes/todo.txt', false)).toBe(true);
  });

  it('rejects other files, including ones that only look close', () => {
    expect(isOpenableDrop('/notes/page.mdx', false)).toBe(false);
    expect(isOpenableDrop('/notes/photo.png', false)).toBe(false);
    expect(isOpenableDrop('/notes/Makefile', false)).toBe(false);
    expect(isOpenableDrop('/notes/md', false)).toBe(false);
  });

  it('accepts any folder, whatever its name', () => {
    expect(isOpenableDrop('/notes', true)).toBe(true);
    expect(isOpenableDrop('/exports/site.png', true)).toBe(true);
  });
});

describe('pickWindowForPath', () => {
  const win = (id: number, empty: boolean, lastFocusedAt: number): RoutingWindow => ({ id, empty, lastFocusedAt });

  it('uses the focused window when it is empty', () => {
    expect(pickWindowForPath([win(1, true, 100), win(2, true, 300)], 1)).toBe(1);
  });

  it('falls back to the most recently focused empty window', () => {
    expect(pickWindowForPath([win(1, true, 100), win(2, false, 500), win(3, true, 300)], 2)).toBe(3);
  });

  it('returns null when every window shows something', () => {
    expect(pickWindowForPath([win(1, false, 100), win(2, false, 200)], 1)).toBeNull();
  });

  it('returns null when there are no windows', () => {
    expect(pickWindowForPath([], null)).toBeNull();
  });
});
