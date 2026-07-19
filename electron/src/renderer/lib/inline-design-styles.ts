// Inlines computed styles for design.md styleguide elements so that
// "Copy as formatted HTML" carries the visualization rendering into paste
// targets that have no access to the app stylesheet. For non-design content
// this is a no-op that returns the source innerHTML unchanged.

const COPIED_PROPERTIES = [
  'display',
  'grid-template-columns',
  'column-gap',
  'gap',
  'table-layout',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'padding',
  'margin',
  'border',
  'border-bottom',
  'border-radius',
  'width',
  'min-width',
  'height',
  'text-align',
  'vertical-align',
] as const;

// Block-level containers that should stay fluid in the paste target — copying
// a fixed pixel width would freeze their layout, so `width` is skipped for these.
const SKIP_WIDTH_SELECTOR =
  '.design-block, .design-specimen-row, .design-scale-row, .design-components';

/**
 * Given a live (attached) content element, return HTML with computed design
 * styles inlined onto every `[class*="design-"]` element. If the content holds
 * no design.md visualization, returns `source.innerHTML` unchanged.
 */
export function inlineDesignStyles(source: HTMLElement): string {
  const hasDesignContent =
    source.querySelector('.design-block') !== null ||
    source.querySelector('.design-header') !== null;

  if (!hasDesignContent) {
    return source.innerHTML;
  }

  const clone = source.cloneNode(true) as HTMLElement;

  // The clone is a deep copy of source, so querySelectorAll('*') yields
  // parallel node lists in identical order. getComputedStyle only works on
  // attached elements, so read from the original and write to the clone.
  const originals = source.querySelectorAll<HTMLElement>('*');
  const clones = clone.querySelectorAll<HTMLElement>('*');

  const view = source.ownerDocument.defaultView;
  const getComputed = view ? view.getComputedStyle.bind(view) : null;

  for (let i = 0; i < originals.length; i++) {
    const original = originals[i];
    const target = clones[i];
    if (!original.matches('[class*="design-"]')) continue;

    const computed = getComputed ? getComputed(original) : null;
    if (!computed) continue;

    const skipWidth = original.matches(SKIP_WIDTH_SELECTOR);

    for (const prop of COPIED_PROPERTIES) {
      if (prop === 'width' && skipWidth) continue;
      const value = computed.getPropertyValue(prop);
      if (value) target.style.setProperty(prop, value);
    }
  }

  return clone.innerHTML;
}
