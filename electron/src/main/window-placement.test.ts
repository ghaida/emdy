import { describe, it, expect } from 'vitest';
import { cascadeBounds, CASCADE_STEP } from './window-placement';
import type { Rect } from './session-state';

// A 1440×900 main screen with a 25 px menu bar.
const workArea: Rect = { x: 0, y: 25, width: 1440, height: 875 };

describe('cascadeBounds', () => {
  it('steps down and to the right of the previous window, at its size', () => {
    const previous = { x: 100, y: 100, width: 1100, height: 760 };
    expect(cascadeBounds(previous, workArea, [previous]))
      .toEqual({ x: 100 + CASCADE_STEP, y: 100 + CASCADE_STEP, width: 1100, height: 760 });
  });

  it('steps again when another window already starts at that spot', () => {
    const previous = { x: 100, y: 100, width: 1000, height: 700 };
    expect(cascadeBounds(previous, workArea, [previous, { x: 124, y: 124 }]))
      .toEqual({ x: 148, y: 148, width: 1000, height: 700 });
  });

  it('starts again at the top-left of the screen when it would run off the bottom or right', () => {
    expect(cascadeBounds({ x: 300, y: 190, width: 1000, height: 700 }, workArea, []))
      .toEqual({ x: 0, y: 25, width: 1000, height: 700 });
    expect(cascadeBounds({ x: 460, y: 100, width: 1000, height: 700 }, workArea, []))
      .toEqual({ x: 0, y: 25, width: 1000, height: 700 });
  });

  it('steps past a window that already sits at the top-left after starting again', () => {
    expect(cascadeBounds({ x: 300, y: 190, width: 1000, height: 700 }, workArea, [{ x: 0, y: 25 }]))
      .toEqual({ x: 24, y: 49, width: 1000, height: 700 });
  });

  it('shrinks a copy of a screen-sized window so it can still step', () => {
    expect(cascadeBounds({ x: 0, y: 25, width: 1440, height: 875 }, workArea, [{ x: 0, y: 25 }]))
      .toEqual({ x: 24, y: 49, width: 1416, height: 851 });
  });
});
