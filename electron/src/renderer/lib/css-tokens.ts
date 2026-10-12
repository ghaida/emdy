import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { cssLength, isValidCssColor, type DesignTokens, type ParsedDesignMd, type TypographyToken } from './design-md';
import { stripFrontMatter } from './front-matter';

// Not every tool writes design.md tokens as YAML front matter. Some keep them
// as CSS custom properties in a code block. For a file named DESIGN.md with no
// front-matter tokens, those properties feed the same styleguide: colors are
// read by their value, and spacing, radii and type sizes by their names.

// DESIGN.md, or a copy of it: DESIGN-2.md, DESIGN (1).md, DESIGN-v2.md.
const DESIGN_FILE_NAME = /^design(?:[ _-]?(?:v?\d+|\(\d+\)))?\.(?:md|markdown)$/i;

const CSS_LANGUAGES = new Set(['css', 'scss', 'less', 'postcss']);
// The opening fence of a CSS code block, found without parsing the document.
const CSS_FENCE = /^ {0,3}(?:`{3,}|~{3,})[ \t]*(?:css|scss|less|postcss)(?=\s|$)/im;
// A custom property declaration at the start of a block, a statement or a line,
// so BEM selectors like `.button--primary:hover` don't read as one.
const DECLARATION = /(?:^|[\s{;])(--[\w-]+)\s*:\s*([^;{}]+)/g;
const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g;
const MAX_VAR_HOPS = 8;

const CSS_WIDE_KEYWORD = /^(?:inherit|initial|unset|revert|revert-layer)$/i;
const NOT_A_SWATCH = /^(?:currentcolor|transparent)$/i;
const SPACING_NAME = /^--(?:spacing|space)(?:-|$)/;
const RADIUS_NAME = /^--(?:radius|radii|rounded|border-radius)(?:-|$)/;
const TYPE_SIZE_NAME = /^--(?:text|font-size|fs)-(.+)$/;

interface MdNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MdNode[];
}

const processor = unified().use(remarkParse).use(remarkGfm);

export function isDesignFileName(filePath: string | null | undefined): boolean {
  return !!filePath && DESIGN_FILE_NAME.test(filePath.split(/[\\/]/).pop() ?? '');
}

/** Whether the document has a CSS code block, checked cheaply before parsing it. */
export function hasCssBlock(markdown: string): boolean {
  return CSS_FENCE.test(markdown);
}

// Custom properties in the document's CSS code blocks, in order. A property
// declared again (a dark-mode override, a Tailwind copy) keeps its first value.
function customProperties(markdown: string): Map<string, string> {
  const properties = new Map<string, string>();
  const visit = (node: MdNode): void => {
    if (node.type === 'code' && node.lang && CSS_LANGUAGES.has(node.lang.toLowerCase())) {
      const css = (node.value ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, name, declared] of css.matchAll(DECLARATION)) {
        const value = declared.replace(/\s*!important\s*$/i, '').replace(/\s+/g, ' ').trim();
        if (value && !properties.has(name)) properties.set(name, value);
      }
    }
    node.children?.forEach(visit);
  };
  visit(processor.parse(markdown) as unknown as MdNode);
  return properties;
}

// Swap each var() for the property it names, or its fallback. A reference that
// leads nowhere, or around in a circle, stays as written.
function resolveVars(value: string, properties: Map<string, string>, hops = 0): string {
  if (hops >= MAX_VAR_HOPS || !value.includes('var(')) return value;
  return value.replace(VAR_REFERENCE, (reference, name: string, fallback?: string) => {
    const target = properties.get(name) ?? fallback?.trim();
    return target === undefined ? reference : resolveVars(target, properties, hops + 1);
  });
}

function supports(property: string, value: string, fallback: () => boolean): boolean {
  if (CSS_WIDE_KEYWORD.test(value)) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') return CSS.supports(property, value);
  return fallback();
}

// Bare numbers aren't lengths in CSS, so a unit is required.
function isLength(value: string): boolean {
  return /[a-z]$/i.test(value) && cssLength(value) !== null;
}

function companion(properties: Map<string, string>, names: string[]): string | undefined {
  for (const name of names) {
    const declared = properties.get(name);
    if (declared === undefined) continue;
    const value = resolveVars(declared, properties);
    if (!value.includes('var(')) return value;
  }
  return undefined;
}

// A type size, with the line height, tracking and weight declared for the same
// style name, as in `--text-caption` and `--leading-caption`. Font families
// aren't paired with sizes: nothing in the CSS says which goes with which.
function typeStyle(style: string, fontSize: string, properties: Map<string, string>): TypographyToken {
  const token: TypographyToken = { fontSize };
  const lineHeight = companion(properties, [`--text-${style}--line-height`, `--leading-${style}`, `--line-height-${style}`]);
  const letterSpacing = companion(properties, [`--text-${style}--letter-spacing`, `--tracking-${style}`, `--letter-spacing-${style}`]);
  const fontWeight = companion(properties, [`--text-${style}--font-weight`]);
  if (lineHeight) token.lineHeight = lineHeight;
  if (letterSpacing) token.letterSpacing = letterSpacing;
  if (fontWeight) token.fontWeight = fontWeight;
  return token;
}

export function parseCssTokens(markdown: string): DesignTokens | null {
  const properties = customProperties(markdown);
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const rounded: Record<string, string> = {};
  const typography: Record<string, TypographyToken> = {};

  for (const [name, declared] of properties) {
    const value = resolveVars(declared, properties);
    if (value.includes('var(') || CSS_WIDE_KEYWORD.test(value)) continue;
    const typeSize = TYPE_SIZE_NAME.exec(name);
    if (!NOT_A_SWATCH.test(value) && isValidCssColor(value)) {
      colors[name] = value;
    } else if (SPACING_NAME.test(name) && isLength(value)) {
      spacing[name] = value;
    } else if (RADIUS_NAME.test(name) && supports('border-radius', value, () => isLength(value) || /%$/.test(value))) {
      rounded[name] = value;
    } else if (typeSize && !typeSize[1].includes('--') && supports('font-size', value, () => isLength(value))) {
      typography[name] = typeStyle(typeSize[1], value, properties);
    }
  }

  const tokens: DesignTokens = { name: '' };
  if (Object.keys(colors).length > 0) tokens.colors = colors;
  if (Object.keys(spacing).length > 0) tokens.spacing = spacing;
  if (Object.keys(rounded).length > 0) tokens.rounded = rounded;
  if (Object.keys(typography).length > 0) tokens.typography = typography;
  return Object.keys(tokens).length > 1 ? tokens : null;
}

/** The styleguide for a DESIGN.md whose tokens are CSS custom properties. */
export function parseCssDesignMd(content: string, filePath: string | null | undefined): ParsedDesignMd | null {
  if (!isDesignFileName(filePath) || !hasCssBlock(content)) return null;
  const body = stripFrontMatter(content);
  const tokens = parseCssTokens(body);
  return tokens ? { body, tokens, source: 'css' } : null;
}
