// Transforms rendered design.md styleguide markup into RTF-safe HTML for
// "Copy as formatted HTML". macOS converts clipboard HTML to RTF via WebKit for
// paste targets like TextEdit, Word, and Mail. That path is unforgiving: it
// drops CSS grid, class stylesheets, sized/styled <span>s and <div>s, and turns
// container backgrounds into ragged paragraph shading and div margins/borders
// into empty bands. What survives cleanly is a narrow set of primitives — plain
// text runs with inline font styles, and <table> cells with background shading
// and explicit widths. So this module rebuilds every construct out of only
// those primitives:
//   - never reads getComputedStyle (which would leak the live theme's colors),
//   - takes neutral, print-friendly values from DESIGN_PRINT_STYLES (the same
//     source the PDF export uses) so copy and PDF can't drift, and
//   - drops the .design-block container tint entirely (the PDF keeps it; RTF
//     can't render it without ugly shading bands), replaces the swatch grid,
//     spacing scale, radius scale, and component tables with <table>s whose
//     cells carry shading and explicit widths, and strips the sized <span>/<div>
//     primitives (mini-swatches, radius squares, bar divs) that RTF discards.
//
// For plain (non-design) markdown, this is a no-op that returns the source
// innerHTML unchanged, preserving the exact pre-feature clipboard behavior.

import {
  DESIGN_PRINT_STYLES,
  DESIGN_COMPONENT_TD_CSS,
  DESIGN_COMPONENT_TD_FIRST_WIDTH,
} from '../../shared/design-print-styles';
import { isValidCssColor } from './design-md';

// Neutral bar/chip colors and column widths for the rebuilt tables. All literal
// print values — never `var(--…)`, never viewer-computed.
const COPY_BAR_COLOR = '#2C2C2C'; // matches design-spacing-bar background
const COPY_BAR_MAX_PX = 300; // cap bar width so long bars don't blow up the paste
const COPY_SWATCH_WIDTH = '40px';
const COPY_CHIP_WIDTH = '16px';
const COPY_CHIP_BORDER = '1px solid #DDDDDD';
const COPY_NAME_WIDTH = '200px';
const COPY_VALUE_WIDTH = '80px';
// Specimen rows in copy: no border (div borders convert to empty bands), just
// modest spacing. The PDF keeps its 1px separators via DESIGN_PRINT_STYLES.
const COPY_SPECIMEN_ROW_CSS = 'padding-bottom: 8px;';

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

/** Swatch grid → a table with one row per color: a fixed-width swatch cell (the
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
    swatchTd.style.setProperty('width', COPY_SWATCH_WIDTH);
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

/** Parse an inline width string (e.g. "8px") to a pixel number, or null. */
function pxFromWidth(width: string | undefined): number | null {
  if (!width) return null;
  const n = parseFloat(width);
  return Number.isNaN(n) ? null : n;
}

/** Spacing scale → a table: name (200px) | value (80px) | bar. The bar is a
 * SHADED <td> whose own width is the original bar's inline width (capped at
 * COPY_BAR_MAX_PX) and whose background is the neutral bar color — no inner div,
 * since RTF drops sized divs. */
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
    nameTd.style.setProperty('width', COPY_NAME_WIDTH);
    nameTd.style.setProperty('padding', '4px 12px 4px 0');
    tr.appendChild(nameTd);

    const valueTd = doc.createElement('td');
    valueTd.className = 'design-token-value';
    valueTd.textContent = value;
    valueTd.style.setProperty('width', COPY_VALUE_WIDTH);
    valueTd.style.setProperty('padding', '4px 12px 4px 0');
    tr.appendChild(valueTd);

    const barTd = doc.createElement('td');
    const px = pxFromWidth(bar?.style.width);
    if (px !== null) {
      const capped = Math.min(px, COPY_BAR_MAX_PX);
      barTd.style.setProperty('width', `${capped}px`);
      barTd.style.setProperty('background', COPY_BAR_COLOR);
    }
    tr.appendChild(barTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.replaceWith(table);
}

/** Radius scale → a plain [name (200px) | value] table, left-aligned. The sized
 * radius squares are dropped (RTF discards them, leaving orphaned centered text
 * lines), and there is no text-align anywhere. */
function rebuildRadius(container: Element, doc: Document): void {
  const table = doc.createElement('table');
  table.style.cssText = 'border-collapse: collapse; margin-bottom: 1em;';
  const tbody = doc.createElement('tbody');

  container.querySelectorAll('.design-radius-item').forEach((item) => {
    const name = item.querySelector('.design-token-name')?.textContent ?? '';
    const value = item.querySelector('.design-token-value')?.textContent ?? '';
    const tr = doc.createElement('tr');

    const nameTd = doc.createElement('td');
    nameTd.className = 'design-token-name';
    nameTd.textContent = name;
    nameTd.style.setProperty('width', COPY_NAME_WIDTH);
    nameTd.style.setProperty('padding', '4px 12px 4px 0');
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

/** Component table → 3 columns per row: property (200px) | chip (16px, shaded
 * with the value's color only when it's a valid CSS color) | value. The color
 * indicator moves from a sized <span> (which RTF drops) into a shaded cell, and
 * the fixed 200px/16px columns are identical across every component so values
 * align document-wide. */
function rebuildComponentTable(table: Element, doc: Document): void {
  table.querySelectorAll('tr').forEach((tr) => {
    const nameTd = tr.querySelector<HTMLElement>('.design-token-name');
    const valueTd = tr.querySelector<HTMLElement>('.design-token-value');
    if (!valueTd) return;

    // The value string is the cell text; the mini-swatch span (if any) is empty.
    const value = (valueTd.textContent ?? '').trim();
    valueTd.querySelectorAll('.design-mini-swatch').forEach((s) => s.remove());

    if (nameTd) {
      applyDecls(nameTd, DESIGN_COMPONENT_TD_CSS);
      nameTd.style.setProperty('width', DESIGN_COMPONENT_TD_FIRST_WIDTH);
    }

    const chipTd = doc.createElement('td');
    chipTd.style.setProperty('width', COPY_CHIP_WIDTH);
    chipTd.style.setProperty('padding', '0');
    if (isValidCssColor(value)) {
      chipTd.style.setProperty('background-color', value);
      chipTd.style.setProperty('border', COPY_CHIP_BORDER);
    }

    applyDecls(valueTd, DESIGN_COMPONENT_TD_CSS);
    valueTd.style.setProperty('padding-left', '8px');

    tr.insertBefore(chipTd, valueTd);
  });
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

  // Block wrapper: strip any container tint / radius (RTF renders a div
  // background as ragged shading bands) and keep only modest bottom spacing.
  // Remove the shorthands and their longhands — removing a shorthand alone can
  // leave reset longhands behind.
  const BLOCK_STRIP_PROPS = [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'background-attachment',
    'border-radius',
  ];
  clone.querySelectorAll<HTMLElement>('.design-block').forEach((el) => {
    for (const prop of BLOCK_STRIP_PROPS) el.style.removeProperty(prop);
    el.style.setProperty('margin-bottom', '1em');
  });

  // Rebuild grid/flex constructs as tables (must run before the generic pass so
  // the removed originals don't get styled). Swatch grid, spacing scale, radius
  // scale, and component tables all become tables of shaded/sized cells.
  clone.querySelectorAll('.design-swatches').forEach((el) => rebuildSwatches(el, doc));
  clone
    .querySelectorAll('.design-scale:not(.design-scale--radius)')
    .forEach((el) => rebuildScale(el, doc));
  clone.querySelectorAll('.design-scale--radius').forEach((el) => rebuildRadius(el, doc));
  clone
    .querySelectorAll('.design-component-table')
    .forEach((el) => rebuildComponentTable(el, doc));

  // Inline the neutral print declarations onto every surviving design element.
  // Classes belonging to the rebuilt constructs no longer match, so this styles
  // only in-place elements (header, specimens, token name/value cells, the
  // component name and table wrapper). The block wrapper is handled above and
  // specimen rows drop their divider (borders convert to empty bands).
  for (const [className, decls] of Object.entries(DESIGN_PRINT_STYLES)) {
    if (className === 'design-block') continue;
    const css = className === 'design-specimen-row' ? COPY_SPECIMEN_ROW_CSS : decls;
    clone.querySelectorAll<HTMLElement>(`.${className}`).forEach((el) => applyDecls(el, css));
  }

  return clone.innerHTML;
}
