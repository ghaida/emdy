// Single source of truth for the neutral, light, print-friendly styling of
// design.md styleguide constructs. Imported by BOTH the main process
// (pdf-export.ts, to build the PDF/print stylesheet) and the renderer
// (copy-html.ts, to inline styles for "Copy as formatted HTML"). This keeps
// the PDF export and the clipboard copy from ever drifting apart.
//
// Plain data + pure string functions only — no Electron and no DOM APIs — so
// it is safe to bundle into either the main or the renderer build.

/**
 * className (without the leading dot) → CSS declaration string.
 * These are the neutral print values: no `var(--…)`, no theme colors.
 */
export const DESIGN_PRINT_STYLES: Record<string, string> = {
  'design-block':
    'background: #F0F0F0; border-radius: 6px; padding: 16px; margin-bottom: 1em; break-inside: avoid !important;',
  'design-header': 'margin-bottom: 1.5em;',
  'design-header-desc': 'color: #666666;',
  'design-token-name':
    "font-family: 'IBM Plex Mono', monospace; font-size: 0.85em; color: #2C2C2C;",
  'design-token-value':
    "font-family: 'IBM Plex Mono', monospace; font-size: 0.8em; color: #666666;",
  'design-swatch-item':
    'display: inline-block !important; width: 120px; margin: 0 12px 12px 0; vertical-align: top;',
  'design-swatch':
    'height: 40px !important; border-radius: 4px; border: 1px solid #DDDDDD; margin-bottom: 8px;',
  'design-specimen-row': 'padding: 12px 0; border-bottom: 1px solid #DDDDDD;',
  'design-specimen': 'margin-bottom: 4px;',
  'design-fallback-note': 'display: none !important;',
  'design-scale-row':
    'display: grid !important; grid-template-columns: 200px 80px minmax(0, 1fr); column-gap: 12px; align-items: center; padding: 4px 0;',
  'design-spacing-track': 'container-type: inline-size;',
  'design-spacing-bar':
    'position: relative; height: 12px !important; max-width: 100%; background: #2C2C2C; border-radius: 4px;',
  'design-scale--radius': 'display: flex !important; gap: 24px; flex-wrap: wrap;',
  'design-radius-item': 'text-align: center;',
  'design-radius-square':
    'width: 48px; height: 48px !important; background: #E4E4E4; border: 1px solid #DDDDDD; margin: 0 auto 8px;',
  'design-component': 'margin-bottom: 20px;',
  'design-component-name':
    "font-family: 'IBM Plex Mono', monospace; font-size: 0.85em; font-weight: 600; margin-bottom: 8px;",
  'design-component-table': 'width: 100%; table-layout: fixed;',
  'design-mini-swatch':
    'display: inline-block !important; width: 12px; height: 12px !important; border-radius: 2px; border: 1px solid #DDDDDD; margin-right: 8px; vertical-align: baseline;',
};

// Declarations for every `<td>` inside a `.design-component-table`. Kept out of
// the flat map because the selector is compound (`… td`), not a single class.
// Used by copy-html.ts to inline onto each cell, and by the extra-CSS builder.
export const DESIGN_COMPONENT_TD_CSS = 'border: none; padding: 4px 16px 4px 0;';

// Fixed width of the first column in a `.design-component-table`.
export const DESIGN_COMPONENT_TD_FIRST_WIDTH = '200px';

// Rules whose selectors are not a single class (pseudo-classes, descendant
// combinators) and so cannot live in the flat map. Appended verbatim by the
// builder so the generated stylesheet matches the hand-written original.
const DESIGN_PRINT_EXTRA_CSS = [
  '.design-specimen-row:last-child { border-bottom: none; }',
  // A bar wider than its track fades out at the end, as on screen. --bar-width
  // is the bar's own inline value, not a theme variable.
  '.design-spacing-bar::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: clamp(0px, (var(--bar-width, 0px) - 100cqw) * 1000, 32px); background: linear-gradient(to right, transparent, #F0F0F0); }',
  `.design-component-table td:first-child { width: ${DESIGN_COMPONENT_TD_FIRST_WIDTH}; }`,
  `.design-component-table td { ${DESIGN_COMPONENT_TD_CSS} }`,
].join('\n');

/**
 * Render the design section of the print stylesheet: one rule per flat-map
 * entry, followed by the compound-selector extras. Interpolated into
 * PRINT_CSS in pdf-export.ts so the PDF and the clipboard copy share one source.
 */
export function buildDesignPrintCss(): string {
  const mapRules = Object.entries(DESIGN_PRINT_STYLES)
    .map(([className, decls]) => `.${className} { ${decls} }`)
    .join('\n');
  return `${mapRules}\n${DESIGN_PRINT_EXTRA_CSS}`;
}
