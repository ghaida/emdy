// After a restart, a window's saved scroll position only lands in the right
// place once the diagrams and images above it have finished drawing, so hold
// the position while the content settles and let go the moment the user
// scrolls.

export interface HoldScrollOptions {
  /** How long to keep the position while the content settles. */
  ms: number;
  /** Called once when holding stops, for any reason. */
  onDone?: () => void;
}

const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'mousedown', 'keydown'] as const;

/**
 * Scrolls scrollEl to `top` and keeps it there whenever contentEl changes
 * size, until the user scrolls or `ms` passes. Returns a function that stops
 * holding early.
 */
export function holdScrollPosition(
  scrollEl: HTMLElement,
  contentEl: HTMLElement,
  top: number,
  { ms, onDone }: HoldScrollOptions,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    if (!stopped) scrollEl.scrollTop = top;
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    if (timer) clearTimeout(timer);
    for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop, true);
    onDone?.();
  };

  scrollEl.scrollTop = top;
  observer.observe(contentEl);
  timer = setTimeout(stop, ms);
  for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, true);
  return stop;
}
