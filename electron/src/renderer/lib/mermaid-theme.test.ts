import { describe, it, expect } from 'vitest';
import { themes } from './color-themes';
import {
  buildDiagramTheme,
  contrast,
  DIAGRAM_FONT_FAMILY,
  flatten,
  mix,
  SYSTEM_FONT_FAMILY,
} from './mermaid-theme';
import { PRINT_PALETTE } from './print-palette';

const HEX6 = /^#[0-9a-f]{6}$/;
const NON_COLOR_KEYS = new Set(['fontFamily', 'fontSize', 'dropShadow', 'pieStrokeWidth', 'pieOuterStrokeWidth', 'pieOpacity']);

const combos = Object.entries(themes).flatMap(([name, theme]) =>
  (['light', 'dark'] as const).map((appearance) => ({
    label: `${name} ${appearance}`,
    colors: theme[appearance],
    dark: appearance === 'dark',
  }))
);

describe('flatten', () => {
  it('composites translucent colors over the backdrop', () => {
    expect(flatten('#00000080', '#ffffff')).toBe('#7f7f7f');
  });

  it('passes opaque colors through as lowercase 6-digit hex', () => {
    expect(flatten('#D47418', '#000000')).toBe('#d47418');
    expect(flatten('#fff', '#000000')).toBe('#ffffff');
  });

  it('flattens rgb()/rgba() colors, not just hex', () => {
    expect(flatten('rgba(0, 0, 0, 0.5)', '#ffffff')).toBe('#808080');
    expect(flatten('rgb(1 2 3)', '#ffffff')).toBe('#010203');
  });

  it('falls back to the backdrop for colors it cannot parse', () => {
    expect(flatten('hsl(10 20% 30%)', '#123456')).toBe('#123456');
  });
});

describe('mix', () => {
  it('weights the first color by the given share', () => {
    expect(mix('#000000', '#ffffff', 0.25)).toBe('#bfbfbf');
    expect(mix('#d47418', '#ffffff', 1)).toBe('#d47418');
  });
});

describe('buildDiagramTheme', () => {
  it.each(combos)('$label: every color is opaque 6-digit hex', ({ colors }) => {
    const { variables } = buildDiagramTheme(colors);
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value !== 'string' || NON_COLOR_KEYS.has(key)) continue;
      expect(value, key).toMatch(HEX6);
    }
    const palette = String((variables.xyChart as Record<string, string>).plotColorPalette).split(',');
    palette.forEach((color) => expect(color).toMatch(HEX6));
  });

  it.each(combos)('$label: darkMode follows the code-block surface', ({ colors, dark }) => {
    expect(buildDiagramTheme(colors).variables.darkMode).toBe(dark);
  });

  it.each(combos)('$label: node, note, and branch label text stays readable', ({ colors }) => {
    const v = buildDiagramTheme(colors).variables as Record<string, string>;
    expect(contrast(v.primaryTextColor, v.primaryColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v.noteTextColor, v.noteBkgColor)).toBeGreaterThanOrEqual(4.5);
    for (let i = 0; i < 8; i++) {
      expect(contrast(v[`gitBranchLabel${i}`], v[`git${i}`]), `git${i}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('draws diagrams on the code-block background', () => {
    const theme = buildDiagramTheme(themes.warm.light);
    expect(theme.background).toBe('#eceae5');
    expect(theme.variables.background).toBe('#eceae5');
    expect(theme.variables.edgeLabelBackground).toBe('#eceae5');
  });

  it('flattens translucent theme borders over the background', () => {
    const { variables } = buildDiagramTheme(themes.neon.dark);
    expect(variables.nodeBorder).toBe(flatten(themes.neon.dark.border, themes.neon.dark.bgCode));
  });

  it('gives equal inputs equal cache keys and different inputs different keys', () => {
    const key = buildDiagramTheme(themes.warm.light).key;
    expect(buildDiagramTheme({ ...themes.warm.light }).key).toBe(key);
    expect(buildDiagramTheme(themes.warm.dark).key).not.toBe(key);
    expect(buildDiagramTheme(themes.warm.light, SYSTEM_FONT_FAMILY).key).not.toBe(key);
  });

  it('uses the bundled font unless told otherwise', () => {
    expect(buildDiagramTheme(themes.cool.light).fontFamily).toBe(DIAGRAM_FONT_FAMILY);
    expect(buildDiagramTheme(themes.cool.light).variables.fontFamily).toBe(DIAGRAM_FONT_FAMILY);
  });

  it('builds a light, neutral print theme', () => {
    const theme = buildDiagramTheme(PRINT_PALETTE, SYSTEM_FONT_FAMILY);
    expect(theme.variables.darkMode).toBe(false);
    expect(theme.variables.primaryColor).toBe('#ffffff');
    expect(theme.variables.primaryTextColor).toBe('#2c2c2c');
    expect(theme.fontFamily).toBe(SYSTEM_FONT_FAMILY);
  });
});
