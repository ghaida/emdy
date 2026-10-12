// Maps Emdy's color palettes onto Mermaid's `base` theme so diagrams match the
// active color theme in light and dark. Mermaid derives most of its colors
// from a handful of inputs, but several diagram types (gantt, pie, ER rows,
// architecture, git labels) fall back to hard-coded light-mode values like
// "lightgrey", "red", "black", or "#eeeeee". Those are set explicitly here so
// nothing turns up as a white box on a dark theme.
//
// Mermaid's color math (khroma) only understands opaque sRGB colors, and some
// themes use translucent borders (#RRGGBBAA), so every color is flattened over
// the diagram background before it goes in.

import type { ColorScale } from './color-themes';
import { parseRgba, toHex } from './color';

/** Diagram labels always use the bundled IBM Plex Sans, whatever the reading
 * font — the same way code blocks are always mono. */
export const DIAGRAM_FONT_FAMILY = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif';

/** System fonts only, for diagrams rendered to leave the app (print, PDF,
 * pasted images): the bundled font isn't available there, and a system font
 * lays out the same in the app (where Mermaid measures the text) and outside. */
export const SYSTEM_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Label size in px at zoom 100%, matching body text. */
export const DIAGRAM_FONT_SIZE = 16;

export type ThemeVariableValue = string | boolean | Record<string, string | number>;

export interface DiagramTheme {
  /** Stable identity for caching: equal inputs produce equal keys. */
  key: string;
  /** Opaque surface the diagram is drawn on (the code-block background). */
  background: string;
  fontFamily: string;
  variables: Record<string, ThemeVariableValue>;
}

/** Composite a (possibly translucent) color over an opaque backdrop, as hex.
 * Colors parseRgba can't read fall back to the backdrop. */
export function flatten(color: string, backdrop: string): string {
  const fg = parseRgba(color);
  const bg = parseRgba(backdrop) ?? { r: 255, g: 255, b: 255, a: 1 };
  if (!fg) return toHex(bg.r, bg.g, bg.b);
  const blend = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return toHex(blend(fg.r, bg.r), blend(fg.g, bg.g), blend(fg.b, bg.b));
}

/** Mix two opaque colors; `amount` is the share of `a` (0..1). */
export function mix(a: string, b: string, amount: number): string {
  const x = parseRgba(a);
  const y = parseRgba(b);
  if (!x || !y) return a;
  const m = (p: number, q: number) => p * amount + q * (1 - amount);
  return toHex(m(x.r, y.r), m(x.g, y.g), m(x.b, y.b));
}

function luminance(color: string): number {
  const c = parseRgba(color);
  if (!c) return 1;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The candidate with the highest contrast against `background`. */
function readable(background: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrast(c, background) > contrast(best, background) ? c : best));
}

/** Distinct accent colors from the palette, for categorical series (pie
 * slices, git branches, mindmap sections). Ordered so the theme accent leads
 * and error red comes last. */
function seriesColors(c: ColorScale, backdrop: string): string[] {
  const candidates = [
    c.accent, c.info, c.success, c.codeNumber, c.codeKeyword, c.codeString, c.codeFunction,
    c.minimapUl, c.minimapBlockquote, c.minimapTableHeader, c.minimapText, c.error,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    const flat = flatten(candidate, backdrop);
    if (seen.has(flat)) continue;
    seen.add(flat);
    out.push(flat);
  }
  return out;
}

const SERIES_SLOTS = 12;

export function buildDiagramTheme(c: ColorScale, fontFamily: string = DIAGRAM_FONT_FAMILY): DiagramTheme {
  const background = flatten(c.bgCode, '#ffffff');
  const dark = luminance(background) < 0.2;
  const over = (color: string) => flatten(color, background);

  // Light themes: white cards on the code surface, clusters a step darker.
  // Dark themes: cards a step lighter than the surface, clusters in between.
  const node = over(dark ? c.bgTertiary : c.bgContent);
  const cluster = over(dark ? c.bgSecondary : c.bgTertiary);
  const border = over(c.border);
  const borderSubtle = over(c.borderSubtle);
  const text = over(c.textPrimary);
  const textSecondary = over(c.textSecondary);
  const muted = over(c.textMuted);
  const heading = over(c.textHeading);
  const accent = over(c.accent);
  const info = over(c.info);
  const error = over(c.error);
  const note = over(c.highlightSubtle);
  const tint = (color: string, amount: number) => mix(color, node, amount);

  const series = seriesColors(c, background);
  // Repeat the series with lighter tints once the distinct colors run out.
  const slot = (i: number) => {
    const base = series[i % series.length];
    const round = Math.floor(i / series.length);
    return round === 0 ? base : tint(base, Math.max(0.35, 1 - round * 0.3));
  };

  const variables: Record<string, ThemeVariableValue> = {
    darkMode: dark,
    background,
    fontFamily,
    fontSize: `${DIAGRAM_FONT_SIZE}px`,
    useGradient: false,
    dropShadow: 'none',

    // Shared roles: flowchart, class, state, ER, requirement, C4.
    primaryColor: node,
    primaryTextColor: text,
    primaryBorderColor: border,
    secondaryColor: cluster,
    secondaryTextColor: text,
    secondaryBorderColor: border,
    tertiaryColor: cluster,
    tertiaryTextColor: textSecondary,
    tertiaryBorderColor: borderSubtle,
    mainBkg: node,
    nodeBkg: node,
    nodeBorder: border,
    nodeTextColor: text,
    clusterBkg: cluster,
    clusterBorder: borderSubtle,
    titleColor: heading,
    textColor: text,
    lineColor: muted,
    arrowheadColor: muted,
    defaultLinkColor: muted,
    edgeLabelBackground: background,
    noteBkgColor: note,
    noteTextColor: readable(note, [text, heading]),
    noteBorderColor: over(c.highlightStrong),
    errorBkgColor: tint(error, 0.2),
    errorTextColor: text,

    // Sequence
    actorBkg: node,
    actorBorder: border,
    actorTextColor: text,
    actorLineColor: borderSubtle,
    signalColor: textSecondary,
    signalTextColor: text,
    labelBoxBkgColor: cluster,
    labelBoxBorderColor: border,
    labelTextColor: text,
    loopTextColor: text,
    activationBkgColor: cluster,
    activationBorderColor: border,
    sequenceNumberColor: readable(muted, [node, text]),

    // State
    stateBkg: node,
    stateLabelColor: text,
    labelBackgroundColor: background,
    compositeBackground: cluster,
    compositeTitleBackground: node,
    compositeBorder: border,
    altBackground: cluster,
    transitionColor: muted,
    transitionLabelColor: textSecondary,
    specialStateColor: muted,
    innerEndBackground: border,

    // Class, ER, requirement
    classText: text,
    attributeBackgroundColorOdd: node,
    attributeBackgroundColorEven: mix(cluster, node, 0.5),
    rowOdd: node,
    rowEven: mix(cluster, node, 0.5),
    requirementBackground: node,
    requirementBorderColor: border,
    requirementTextColor: text,
    relationColor: muted,
    relationLabelBackground: background,
    relationLabelColor: textSecondary,

    // Gantt
    gridColor: borderSubtle,
    sectionBkgColor: cluster,
    altSectionBkgColor: background,
    sectionBkgColor2: mix(cluster, background, 0.5),
    taskBkgColor: tint(accent, 0.3),
    taskBorderColor: accent,
    taskTextColor: text,
    taskTextLightColor: text,
    taskTextDarkColor: text,
    taskTextOutsideColor: text,
    taskTextClickableColor: accent,
    activeTaskBkgColor: tint(info, 0.3),
    activeTaskBorderColor: info,
    doneTaskBkgColor: cluster,
    doneTaskBorderColor: border,
    critBkgColor: tint(error, 0.3),
    critBorderColor: error,
    todayLineColor: error,
    excludeBkgColor: cluster,
    vertLineColor: info,

    // Pie
    pieTitleTextColor: heading,
    pieSectionTextColor: text,
    pieLegendTextColor: text,
    pieStrokeColor: background,
    pieStrokeWidth: '2px',
    pieOuterStrokeColor: border,
    pieOuterStrokeWidth: '1px',
    pieOpacity: '1',

    // Git
    commitLabelColor: text,
    commitLabelBackground: cluster,
    tagLabelColor: text,
    tagLabelBackground: node,
    tagLabelBorder: border,

    // Quadrant
    quadrant1Fill: tint(accent, 0.16),
    quadrant2Fill: tint(info, 0.16),
    quadrant3Fill: cluster,
    quadrant4Fill: tint(series[2 % series.length], 0.16),
    quadrant1TextFill: text,
    quadrant2TextFill: text,
    quadrant3TextFill: text,
    quadrant4TextFill: text,
    quadrantPointFill: accent,
    quadrantPointTextFill: text,
    quadrantXAxisTextFill: textSecondary,
    quadrantYAxisTextFill: textSecondary,
    quadrantInternalBorderStrokeFill: borderSubtle,
    quadrantExternalBorderStrokeFill: border,
    quadrantTitleFill: heading,

    // Architecture
    archEdgeColor: muted,
    archEdgeArrowColor: muted,
    archGroupBorderColor: border,

    xyChart: {
      backgroundColor: background,
      titleColor: heading,
      dataLabelColor: text,
      legendTextColor: text,
      xAxisTitleColor: textSecondary,
      xAxisLabelColor: textSecondary,
      xAxisTickColor: muted,
      xAxisLineColor: muted,
      yAxisTitleColor: textSecondary,
      yAxisLabelColor: textSecondary,
      yAxisTickColor: muted,
      yAxisLineColor: muted,
      plotColorPalette: series.join(','),
    },
    radar: {
      axisColor: muted,
      graticuleColor: borderSubtle,
    },
  };

  for (let i = 0; i < SERIES_SLOTS; i++) {
    const color = slot(i);
    const fill = tint(color, 0.3);
    // Pie slices and mindmap/timeline/kanban sections carry text, so they get
    // tints; git branches are lines and keep the full color.
    variables[`pie${i + 1}`] = tint(color, 0.55);
    variables[`cScale${i}`] = fill;
    variables[`cScalePeer${i}`] = color;
    variables[`cScaleLabel${i}`] = text;
    variables[`cScaleInv${i}`] = text;
    if (i < 8) {
      variables[`git${i}`] = color;
      variables[`gitInv${i}`] = node;
      variables[`gitBranchLabel${i}`] = readable(color, [heading, node]);
      variables[`fillType${i}`] = fill;
      variables[`venn${i + 1}`] = color;
    }
  }

  return { key: JSON.stringify([fontFamily, variables]), background, fontFamily, variables };
}
