import { fontFamily } from './design-tokens';

// Whether a design.md's font is installed, so its type specimens can say when
// they're shown in a fallback. document.fonts.check() can't tell: it reports
// true for a family that no font matches at all. A family that's present
// changes the width of text set in it, compared with a generic family alone.

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'blinkmacsystemfont',
]);

type Measure = (font: string) => number;

const SAMPLE = 'mmmmmmmmmwwwwwwwlli10OQ@';

/** The families in a font-family value, unquoted, in order. */
export function fontFamilies(value: string): string[] {
  return value
    .split(',')
    .map((family) => family.trim().replace(/^(['"])(.*)\1$/, '$2').trim())
    .filter(Boolean);
}

function isGeneric(family: string): boolean {
  return GENERIC_FAMILIES.has(family.toLowerCase());
}

let canvasMeasure: Measure | null | undefined;

function measureWithCanvas(): Measure | null {
  if (canvasMeasure !== undefined) return canvasMeasure;
  canvasMeasure = null;
  try {
    const context = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
    if (context) {
      canvasMeasure = (font) => {
        context.font = font;
        return context.measureText(SAMPLE).width;
      };
    }
  } catch {
    // No canvas to measure with: every family counts as available.
  }
  return canvasMeasure;
}

/** Whether one family renders as itself. When nothing can measure it, it's assumed to. */
export function isFontAvailable(family: string, measure: Measure | null = measureWithCanvas()): boolean {
  if (isGeneric(family) || !measure) return true;
  const quoted = `"${family.replace(/["\\]/g, '\\$&')}"`;
  return ['monospace', 'serif'].some((generic) => measure(`72px ${quoted}, ${generic}`) !== measure(`72px ${generic}`));
}

/** A font-family value that falls back to Emdy's sans rather than the browser's
 * default serif, unless the file already lists a generic family of its own. */
export function withFallback(value: string): string {
  return fontFamilies(value).some(isGeneric) ? value : `${value}, ${fontFamily.sans}`;
}
