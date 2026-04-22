export function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    const hasScrollOverflow = overflowY === 'auto' || overflowY === 'scroll';
    if (hasScrollOverflow && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}
