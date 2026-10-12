import { describe, it, expect } from 'vitest';
import { fontFamilies, isFontAvailable, withFallback } from './font-availability';

// Text set in a missing family falls through to the generic, so it measures the same.
const INSTALLED = new Set(['Inter']);
function measure(font: string): number {
  const [family, generic] = font.replace(/^72px /, '').split(', ');
  const used = generic && INSTALLED.has(family.replace(/"/g, '')) ? family : generic ?? family;
  return [...used].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

describe('fontFamilies', () => {
  it('lists the families in a font-family value, unquoted', () => {
    expect(fontFamilies(`'ABCfavorit Book', ui-sans-serif, "Segoe UI", sans-serif`)).toEqual([
      'ABCfavorit Book',
      'ui-sans-serif',
      'Segoe UI',
      'sans-serif',
    ]);
    expect(fontFamilies('Public Sans')).toEqual(['Public Sans']);
  });
});

describe('isFontAvailable', () => {
  it('tells an installed family from a missing one', () => {
    expect(isFontAvailable('Inter', measure)).toBe(true);
    expect(isFontAvailable('Public Sans', measure)).toBe(false);
  });

  it('treats generic families as available', () => {
    expect(isFontAvailable('sans-serif', measure)).toBe(true);
    expect(isFontAvailable('system-ui', measure)).toBe(true);
  });

  it('assumes a family is available when nothing can measure it', () => {
    expect(isFontAvailable('Public Sans', null)).toBe(true);
  });
});

describe('withFallback', () => {
  it("adds Emdy's sans after a list with no generic family", () => {
    expect(withFallback('Public Sans')).toBe("Public Sans, 'IBM Plex Sans', -apple-system, sans-serif");
  });

  it('keeps a list that already ends in its own fallback', () => {
    expect(withFallback("'Fraunces', Georgia, serif")).toBe("'Fraunces', Georgia, serif");
  });
});
