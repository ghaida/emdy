// Where a new window goes when other windows are already open. Kept free of
// Electron imports so it can be unit-tested in isolation.
import type { Rect } from './session-state';

/** How far each new window steps down and to the right, in points. */
export const CASCADE_STEP = 24;

// Enough to step past every other window on any realistic screen.
const MAX_STEPS = 64;

/**
 * One step down and to the right of the previous window, at its size. A spot
 * another window already starts at is skipped, and a window that would run
 * off the screen starts again from the work area's top-left corner.
 */
export function cascadeBounds(previous: Rect, workArea: Rect, taken: Array<{ x: number; y: number }>): Rect {
  // Leave room for one step, so a copy of a screen-sized window still shows as new.
  const width = Math.min(previous.width, workArea.width - CASCADE_STEP);
  const height = Math.min(previous.height, workArea.height - CASCADE_STEP);
  const fits = (x: number, y: number) =>
    x + width <= workArea.x + workArea.width && y + height <= workArea.y + workArea.height;
  const isTaken = (x: number, y: number) => taken.some((spot) => spot.x === x && spot.y === y);

  let x = previous.x + CASCADE_STEP;
  let y = previous.y + CASCADE_STEP;
  for (let step = 0; step < MAX_STEPS; step++) {
    if (!fits(x, y)) {
      x = workArea.x;
      y = workArea.y;
    }
    if (!isTaken(x, y)) return { x, y, width, height };
    x += CASCADE_STEP;
    y += CASCADE_STEP;
  }
  return { x: workArea.x, y: workArea.y, width, height };
}
