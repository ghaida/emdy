import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { holdScrollPosition } from './scroll-restore';

class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  observed: Element[] = [];
  disconnected = false;
  constructor(private callback: () => void) {
    FakeResizeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((o) => o !== el);
  }
  disconnect() {
    this.disconnected = true;
  }
  /** Simulates the content changing size. */
  resize() {
    this.callback();
  }
}

// jsdom doesn't lay anything out, so give the element a plain scrollTop.
function scrollableElement(): HTMLElement {
  const el = document.createElement('div');
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = value;
    },
  });
  return el;
}

describe('holdScrollPosition', () => {
  let scrollEl: HTMLElement;
  let contentEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    scrollEl = scrollableElement();
    contentEl = document.createElement('div');
    scrollEl.appendChild(contentEl);
    document.body.appendChild(scrollEl);
  });

  afterEach(() => {
    scrollEl.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('scrolls to the saved position right away', () => {
    holdScrollPosition(scrollEl, contentEl, 900, { ms: 3000 });
    expect(scrollEl.scrollTop).toBe(900);
  });

  it('scrolls back when the content changes size while it settles', () => {
    holdScrollPosition(scrollEl, contentEl, 900, { ms: 3000 });
    expect(FakeResizeObserver.last?.observed).toEqual([contentEl]);
    scrollEl.scrollTop = 400;
    FakeResizeObserver.last?.resize();
    expect(scrollEl.scrollTop).toBe(900);
  });

  it('lets go as soon as the user scrolls with the wheel or the keyboard', () => {
    for (const input of [new WheelEvent('wheel'), new KeyboardEvent('keydown', { key: 'ArrowDown' })]) {
      const onDone = vi.fn();
      holdScrollPosition(scrollEl, contentEl, 900, { ms: 3000, onDone });
      scrollEl.dispatchEvent(input);
      scrollEl.scrollTop = 400;
      FakeResizeObserver.last?.resize();
      expect(scrollEl.scrollTop).toBe(400);
      expect(onDone).toHaveBeenCalledTimes(1);
    }
  });

  it('lets go after the time limit', () => {
    const onDone = vi.fn();
    holdScrollPosition(scrollEl, contentEl, 900, { ms: 3000, onDone });
    vi.advanceTimersByTime(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(FakeResizeObserver.last?.disconnected).toBe(true);
  });

  it('can be stopped early, and reports done only once', () => {
    const onDone = vi.fn();
    const stop = holdScrollPosition(scrollEl, contentEl, 900, { ms: 3000, onDone });
    stop();
    stop();
    vi.advanceTimersByTime(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
