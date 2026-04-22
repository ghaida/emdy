import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findScrollParent } from './find-scroller';

function setOverflowY(el: HTMLElement, value: string) {
  el.style.overflowY = value;
}

function setScrollSize(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
}

function makeElement(tag: string, className?: string): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function nestChain(root: HTMLElement, chain: Array<{ tag: string; className?: string }>): HTMLElement {
  let parent: HTMLElement = root;
  for (const step of chain) {
    const child = makeElement(step.tag, step.className);
    parent.appendChild(child);
    parent = child;
  }
  return parent;
}

describe('findScrollParent', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('returns null when the node has no parent elements', () => {
    const detached = document.createElement('span');
    expect(findScrollParent(detached)).toBeNull();
  });

  it('returns null when no ancestor has scroll overflow', () => {
    const mark = nestChain(root, [
      { tag: 'div', className: 'outer' },
      { tag: 'p' },
      { tag: 'mark' },
    ]);
    expect(findScrollParent(mark)).toBeNull();
  });

  it('returns the nearest ancestor with overflow-y: auto that actually scrolls', () => {
    const mark = nestChain(root, [
      { tag: 'div', className: 'scroller' },
      { tag: 'p' },
      { tag: 'mark' },
    ]);
    const scroller = root.querySelector('.scroller') as HTMLElement;
    setOverflowY(scroller, 'auto');
    setScrollSize(scroller, 1000, 400);
    expect(findScrollParent(mark)).toBe(scroller);
  });

  it('returns the ancestor when it declares overflow-y: scroll', () => {
    const mark = nestChain(root, [
      { tag: 'div', className: 'scroller' },
      { tag: 'p' },
      { tag: 'mark' },
    ]);
    const scroller = root.querySelector('.scroller') as HTMLElement;
    setOverflowY(scroller, 'scroll');
    setScrollSize(scroller, 1000, 400);
    expect(findScrollParent(mark)).toBe(scroller);
  });

  it('skips an ancestor with overflow-y: auto but no actual scroll overflow', () => {
    // Reproduces the bug: .markdown-body reports overflow-y: auto
    // (Chrome resolves visible→auto when overflow-x is hidden) but is not a
    // real scroll container because scrollHeight === clientHeight. The walker
    // must keep climbing to the real .content-area.
    const mark = nestChain(root, [
      { tag: 'div', className: 'content-area' },
      { tag: 'div', className: 'markdown-view' },
      { tag: 'article', className: 'markdown-body' },
      { tag: 'p' },
      { tag: 'mark' },
    ]);
    const contentArea = root.querySelector('.content-area') as HTMLElement;
    const markdownBody = root.querySelector('.markdown-body') as HTMLElement;

    setOverflowY(markdownBody, 'auto');
    setScrollSize(markdownBody, 800, 800);

    setOverflowY(contentArea, 'auto');
    setScrollSize(contentArea, 1200, 600);

    expect(findScrollParent(mark)).toBe(contentArea);
  });

  it('walks past non-scrollable intermediates to reach the real scroller', () => {
    const mark = nestChain(root, [
      { tag: 'div', className: 'scroller' },
      { tag: 'div', className: 'middle' },
      { tag: 'p' },
      { tag: 'mark' },
    ]);
    const scroller = root.querySelector('.scroller') as HTMLElement;
    setOverflowY(scroller, 'auto');
    setScrollSize(scroller, 1500, 600);
    expect(findScrollParent(mark)).toBe(scroller);
  });
});
