// Transforms rendered design.md styleguide markup into RTF-safe HTML for
// "Copy as formatted HTML". macOS converts clipboard HTML to RTF via WebKit for
// paste targets like TextEdit, Word, and Mail — that path honors <table>s and
// inline styles but NOT CSS grid or class stylesheets. So this module:
//   - never reads getComputedStyle (which would leak the live theme's colors),
//   - takes all neutral, print-friendly values from DESIGN_PRINT_STYLES (the
//     same source the PDF export uses), so copy and PDF can't drift, and
//   - rebuilds grid-based constructs (swatch grid, spacing scale) as tables so
//     cell shading and column alignment survive the RTF conversion.
//
// For plain (non-design) markdown, this is a no-op that returns the source
// innerHTML unchanged, preserving the exact pre-feature clipboard behavior.

import {
  DESIGN_PRINT_STYLES,
  DESIGN_COMPONENT_TD_CSS,
  DESIGN_COMPONENT_TD_FIRST_WIDTH,
} from '../../shared/design-print-styles';

/** Parse a CSS declaration string and apply it via setProperty, preserving any
 * inline styles already on the element (e.g. a swatch's background-color). */
function applyDecls(el: HTMLElement, decls: string | undefined): void {
  if (!decls) return;
  for (const chunk of decls.split(';')) {
    const idx = chunk.indexOf(':');
    if (idx === -1) continue;
    const prop = chunk.slice(0, idx).trim();
    let value = chunk.slice(idx + 1).trim();
    if (!prop || !value) continue;
    let priority = '';
    if (/!important$/i.test(value)) {
      value = value.replace(/!important$/i, '').trim();
      priority = 'important';
    }
    el.style.setProperty(prop, value, priority);
  }
}

/** Swatch grid → a table with one row per color: a fixed 40px swatch cell (the
 * token's inline background-color carried over; empty/unshaded for invalid
 * colors), a name cell, and a value cell. */
function rebuildSwatches(container: Element, doc: Document): void {
  const table = doc.createElement('table');
  table.style.cssText = 'border-collapse: collapse; margin-bottom: 1em;';
  const tbody = doc.createElement('tbody');

  container.querySelectorAll('.design-swatch-item').forEach((item) => {
    const swatch = item.querySelector<HTMLElement>('.design-swatch');
    const name = item.querySelector('.design-token-name')?.textContent ?? '';
    const value = item.querySelector('.design-token-value')?.textContent ?? '';
    const tr = doc.createElement('tr');

    const swatchTd = doc.createElement('td');
    swatchTd.style.setProperty('width', '40px');
    swatchTd.style.setProperty('border', '1px solid #DDDDDD');
    const bg = swatch?.style.backgroundColor;
    if (bg) swatchTd.style.setProperty('background-color', bg);
    tr.appendChild(swatchTd);

    const nameTd = doc.createElement('td');
    nameTd.className = 'design-token-name';
    nameTd.textContent = name;
    nameTd.style.setProperty('padding', '4px 12px');
    tr.appendChild(nameTd);

    const valueTd = doc.createElement('td');
    valueTd.className = 'design-token-value';
    valueTd.textContent = value;
    valueTd.style.setProperty('padding', '4px 0');
    tr.appendChild(valueTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.replaceWith(table);
}

/** Spacing scale → a table: name | value | bar. The bar cell holds a div that
 * carries over the original inline width plus a neutral height/background, so
 * name and value stay aligned even if a paste target drops the bar div. */
function rebuildScale(container: Element, doc: Document): void {
  const table = doc.createElement('table');
  table.style.cssText = 'border-collapse: collapse; margin-bottom: 1em;';
  const tbody = doc.createElement('tbody');

  container.querySelectorAll('.design-scale-row').forEach((row) => {
    const name = row.querySelector('.design-token-name')?.textContent ?? '';
    const value = row.querySelector('.design-token-value')?.textContent ?? '';
    const bar = row.querySelector<HTMLElement>('.design-spacing-bar');
    const tr = doc.createElement('tr');

    const nameTd = doc.createElement('td');
    nameTd.className = 'design-token-name';
    nameTd.textContent = name;
    nameTd.style.setProperty('width', '200px');
    nameTd.style.setProperty('padding', '4px 12px 4px 0');
    tr.appendChild(nameTd);

    const valueTd = doc.createElement('td');
    valueTd.className = 'design-token-value';
    valueTd.textContent = value;
    valueTd.style.setProperty('width', '80px');
    valueTd.style.setProperty('padding', '4px 12px 4px 0');
    tr.appendChild(valueTd);

    const barTd = doc.createElement('td');
    if (bar) {
      const barDiv = doc.createElement('div');
      const width = bar.style.width;
      if (width) barDiv.style.setProperty('width', width);
      barDiv.style.setProperty('height', '12px');
      barDiv.style.setProperty('background', '#2C2C2C');
      barTd.appendChild(barDiv);
    }
    tr.appendChild(barTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.replaceWith(table);
}

/**
 * Given the live content element, return HTML for the clipboard. Plain markdown
 * returns `source.innerHTML` unchanged; design.md content is cloned and its
 * constructs transformed into RTF-safe markup with inline neutral print styles.
 */
export function buildCopyHtml(source: HTMLElement): string {
  const hasDesignContent =
    source.querySelector('.design-block') !== null ||
    source.querySelector('.design-header') !== null;

  if (!hasDesignContent) {
    return source.innerHTML;
  }

  const clone = source.cloneNode(true) as HTMLElement;
  const doc = clone.ownerDocument;

  // Drop viewer chrome that shouldn't reach the paste target.
  clone.querySelectorAll('.design-fallback-note').forEach((el) => el.remove());

  // Rebuild grid-based constructs as tables (must run before the generic pass
  // so the removed originals don't get styled). The radius scale keeps its
  // divs, so only the plain spacing scale is rebuilt.
  clone.querySelectorAll('.design-swatches').forEach((el) => rebuildSwatches(el, doc));
  clone
    .querySelectorAll('.design-scale:not(.design-scale--radius)')
    .forEach((el) => rebuildScale(el, doc));

  // Inline the neutral print declarations onto every surviving design element.
  // Classes belonging to the rebuilt constructs no longer match, so this is a
  // no-op for them and styles the in-place elements (header, specimens, radius,
  // component tables, token name/value, mini-swatch).
  for (const [className, decls] of Object.entries(DESIGN_PRINT_STYLES)) {
    clone
      .querySelectorAll<HTMLElement>(`.${className}`)
      .forEach((el) => applyDecls(el, decls));
  }

  // Component-table cells: compound selector, so styled separately. Every td
  // gets the neutral border/padding; the first column gets a fixed width.
  clone.querySelectorAll('.design-component-table tr').forEach((tr) => {
    tr.querySelectorAll<HTMLElement>('td').forEach((td, i) => {
      applyDecls(td, DESIGN_COMPONENT_TD_CSS);
      if (i === 0) td.style.setProperty('width', DESIGN_COMPONENT_TD_FIRST_WIDTH);
    });
  });

  return clone.innerHTML;
}
