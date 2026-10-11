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
// The one exception is Mermaid diagrams: RTF drops SVG entirely, so they're
// swapped for PNG images (see renderCopyImages).

import {
  DESIGN_PRINT_STYLES,
  DESIGN_COMPONENT_TD_CSS,
  DESIGN_COMPONENT_TD_FIRST_WIDTH,
} from '../../shared/design-print-styles';
import { isValidCssColor } from './design-md';
import { parseRgba, toHex, type Rgba } from './color';
import {
  DIAGRAM_BLOCK_SELECTOR,
  DIAGRAM_ERROR_SELECTOR,
  inlineDiagramsForCopy,
  renderCopyImages,
  type DiagramImage,
} from './diagram-export';

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

// WebKit's HTML→RTF conversion only honors OPAQUE cell shading — an alpha color
// gets dropped and the cell pastes blank white. So every FILE color that lands
// as a chip/swatch background is flattened first: translucent tokens are
// composited over a dark neutral (#333333) so glass/overlay tokens still read
// the way they do against the app's dark surface, and opaque colors pass through.
const NEUTRAL_BACKDROP = 51; // #333333 per channel

/** Minimal 2D-context surface this module needs. A real
 * `CanvasRenderingContext2D` satisfies it; tests inject a fake. */
interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  getImageData(
    x: number,
    y: number,
    w: number,
    h: number,
  ): { data: Uint8ClampedArray | number[] };
}

/** Factory for a 2D context. Returns null when none is available (jsdom). */
export type CtxFactory = () => Ctx2D | null;

const realCtxFactory: CtxFactory = () => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  return (canvas.getContext('2d') as unknown as Ctx2D | null) ?? null;
};

// Two DISTINCT sentinel colors. Assigning an invalid color to `fillStyle` is
// ignored per spec, so it keeps its prior value. Setting the value after two
// different sentinels yields equal readbacks only when the assignment actually
// took (valid). Using two sentinels — rather than one — also correctly accepts a
// value that happens to equal a single sentinel's own color.
const SENTINEL_A = '#010203';
const SENTINEL_B = '#fdfcfb';

/** Use a real 2D canvas as the AUTHORITY for both a color's validity and its
 * value. Validity: the double-sentinel readback test above (invalid → null, so
 * no chip — this kills the former solid-black chip from ignored assignments).
 * Value: draw the color into a 1×1 surface and read straight rgba back, which
 * resolves EVERY form Chromium supports (oklch/lab/hsl/named/space-syntax)
 * uniformly, alpha included, without parsing the normalized string. Returns null
 * when no context is available (jsdom) so the parseRgba fallback runs. */
function normalizeViaCanvas(value: string, ctxFactory: CtxFactory): Rgba | null {
  try {
    const ctx = ctxFactory();
    if (!ctx) return null;

    ctx.fillStyle = SENTINEL_A;
    ctx.fillStyle = value;
    const readA = ctx.fillStyle;
    ctx.fillStyle = SENTINEL_B;
    ctx.fillStyle = value;
    const readB = ctx.fillStyle;
    if (readA !== readB) return null; // assignment ignored → invalid → no chip

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    // getImageData alpha is 0-255 and un-premultiplied for these fills.
    return { r: data[0], g: data[1], b: data[2], a: data[3] / 255 };
  } catch {
    return null;
  }
}

/**
 * Flatten any CSS color to an opaque `#rrggbb` string safe for RTF cell shading.
 * Opaque colors are returned as-is (in hex); translucent colors are composited
 * over the dark neutral backdrop (#333333). Returns null if the color can't be
 * parsed (exported for tests). The canvas factory is injectable for tests;
 * production uses a real 2D context.
 */
export function flattenColor(value: string, ctxFactory: CtxFactory = realCtxFactory): string | null {
  const rgba = normalizeViaCanvas(value, ctxFactory) ?? parseRgba(value);
  if (!rgba) return null;
  const { r, g, b, a } = rgba;
  if (a >= 1) return toHex(r, g, b);
  const composite = (c: number) => c * a + NEUTRAL_BACKDROP * (1 - a);
  return toHex(composite(r), composite(g), composite(b));
}

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
 * token's inline background-color flattened to an opaque shade — translucent
 * tokens composited over the dark neutral; empty/unshaded for missing/invalid
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
    const flat = bg ? flattenColor(bg) : null;
    if (flat) swatchTd.style.setProperty('background-color', flat);
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

/**
 * Spacing scale → ONE single-row table PER token (not one shared table).
 *
 * A single shared table can't work: a column has one width, but each bar cell
 * needs a *different* width. WebKit's RTF converter normalizes all cells in a
 * column to one width, so shared-table bars collapse to a uniform slab pushed to
 * the right edge. Emitting a separate one-row table per token gives every bar
 * cell its own width, while fixed name/value column widths keep the values
 * vertically aligned across the sibling tables.
 *
 * Per row-table columns: name (200px) | value (80px) | bar (shaded, explicit
 * width = the token's pixel value capped at COPY_BAR_MAX_PX) | filler (no width,
 * no shading — absorbs leftover space so the bar cell isn't stretched). The
 * table itself is NOT width:100%; the filler cell does that job. The bar cell's
 * height follows its line box, so it gets a 12px line-height / 4px font-size /
 * zero padding and a non-breaking-space so RTF renders a ~12px-tall bar rather
 * than a full-row slab. Tokens with an unparseable value (no bar element, e.g.
 * `auto`) keep the name + value cells and get an empty unshaded cell instead of
 * a shaded bar. */
function rebuildScale(container: Element, doc: Document): void {
  const tables: HTMLTableElement[] = [];

  container.querySelectorAll('.design-scale-row').forEach((row) => {
    const name = row.querySelector('.design-token-name')?.textContent ?? '';
    const value = row.querySelector('.design-token-value')?.textContent ?? '';
    const bar = row.querySelector<HTMLElement>('.design-spacing-bar');

    const table = doc.createElement('table');
    table.style.cssText = 'border-collapse: collapse; margin: 0;';
    const tbody = doc.createElement('tbody');
    const tr = doc.createElement('tr');

    const nameTd = doc.createElement('td');
    nameTd.className = 'design-token-name';
    nameTd.textContent = name;
    nameTd.style.setProperty('width', COPY_NAME_WIDTH);
    nameTd.style.setProperty('padding', '2px 8px 2px 0');
    tr.appendChild(nameTd);

    const valueTd = doc.createElement('td');
    valueTd.className = 'design-token-value';
    valueTd.textContent = value;
    valueTd.style.setProperty('width', COPY_VALUE_WIDTH);
    valueTd.style.setProperty('padding', '2px 8px 2px 0');
    tr.appendChild(valueTd);

    const barTd = doc.createElement('td');
    const px = pxFromWidth(bar?.style.width);
    if (px !== null) {
      const capped = Math.min(px, COPY_BAR_MAX_PX);
      barTd.style.setProperty('width', `${capped}px`);
      barTd.style.setProperty('background', COPY_BAR_COLOR);
      barTd.style.setProperty('height', '12px');
      barTd.style.setProperty('line-height', '12px');
      barTd.style.setProperty('font-size', '4px');
      barTd.style.setProperty('padding', '0');
      barTd.textContent = ' '; // &nbsp; — gives the bar cell a line box
    }
    tr.appendChild(barTd);

    // Trailing filler: no width, no shading. Absorbs leftover width so the bar
    // cell keeps its explicit width instead of stretching across the table.
    const fillerTd = doc.createElement('td');
    tr.appendChild(fillerTd);

    tbody.appendChild(tr);
    table.appendChild(tbody);
    tables.push(table);
  });

  container.replaceWith(...tables);
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
 * with the value's flattened color only when it's a valid CSS color) | value.
 * Translucent colors are composited over the dark neutral so they stay visible
 * through the RTF conversion. The color
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
    const chipColor = isValidCssColor(value) ? flattenColor(value) : null;
    if (chipColor) {
      chipTd.style.setProperty('background-color', chipColor);
      chipTd.style.setProperty('border', COPY_CHIP_BORDER);
    }

    applyDecls(valueTd, DESIGN_COMPONENT_TD_CSS);
    valueTd.style.setProperty('padding-left', '8px');

    tr.insertBefore(chipTd, valueTd);
  });
}

/**
 * Given the live content element, return HTML for the clipboard. Plain markdown
 * returns `source.innerHTML` unchanged; diagrams become the PNGs in
 * `diagramImages` (or their source, when missing); design.md content is cloned
 * and its constructs transformed into RTF-safe markup with inline neutral print
 * styles.
 */
export function buildCopyHtml(
  source: HTMLElement,
  diagramImages: Map<string, DiagramImage | null> = new Map()
): string {
  const hasDesignContent =
    source.querySelector('.design-block') !== null ||
    source.querySelector('.design-header') !== null;
  const hasDiagrams = source.querySelector(`${DIAGRAM_BLOCK_SELECTOR}, ${DIAGRAM_ERROR_SELECTOR}`) !== null;

  if (!hasDesignContent && !hasDiagrams) {
    return source.innerHTML;
  }

  const clone = source.cloneNode(true) as HTMLElement;
  inlineDiagramsForCopy(clone, diagramImages);
  if (!hasDesignContent) {
    return clone.innerHTML;
  }

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

/**
 * Clipboard HTML with diagrams rendered to PNGs. The content is snapshotted
 * before rendering starts, so a file opened meanwhile can't be what's copied.
 */
export async function prepareCopyHtml(source: HTMLElement): Promise<string> {
  const snapshot = source.cloneNode(true) as HTMLElement;
  return buildCopyHtml(snapshot, await renderCopyImages(snapshot));
}
