import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { splitFrontMatter } from './front-matter';

export type TokenCategory = 'colors' | 'typography' | 'spacing' | 'rounded' | 'components';

export const TOKEN_CATEGORIES: TokenCategory[] = ['colors', 'typography', 'spacing', 'rounded', 'components'];

export interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

export interface DesignTokens {
  name: string;
  description?: string;
  colors?: Record<string, string>;
  typography?: Record<string, TypographyToken>;
  spacing?: Record<string, string>;
  rounded?: Record<string, string>;
  components?: Record<string, Record<string, string>>;
}

export interface ParsedDesignMd {
  body: string;
  tokens: DesignTokens;
  /** Where the tokens were declared: YAML front matter, or CSS code blocks in the body. */
  source: 'front-matter' | 'css';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseDesignMd(content: string): ParsedDesignMd | null {
  const frontMatter = splitFrontMatter(content);
  if (!frontMatter) return null;
  const raw = frontMatter.data;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;

  const hasTokens = TOKEN_CATEGORIES.some(
    (cat) => isPlainObject(raw[cat]) && Object.keys(raw[cat] as object).length > 0
  );
  if (!hasTokens) return null;

  return { body: frontMatter.body, tokens: normalizeTokens(raw), source: 'front-matter' };
}

const REFERENCE_PATTERN = /^\{([\w.-]+)\}$/;
const MAX_REFERENCE_HOPS = 8;

function lookupPath(root: Record<string, unknown>, path: string): unknown {
  let node: unknown = root;
  for (const part of path.split('.')) {
    if (!isPlainObject(node)) return undefined;
    node = node[part];
  }
  return node;
}

function resolveValue(value: unknown, root: Record<string, unknown>): string {
  let current = value;
  let hops = 0;
  while (typeof current === 'string' || typeof current === 'number') {
    const str = String(current);
    const ref = REFERENCE_PATTERN.exec(str);
    if (!ref) return str; // current is a concrete value — fully resolved
    if (hops >= MAX_REFERENCE_HOPS) break; // chain longer than the cap
    const next = lookupPath(root, ref[1]);
    if (next === undefined || next === current) break; // dead end or self-reference
    current = next;
    hops++;
  }
  // Hops exhausted with current still a reference, or a dead end was hit:
  // fall back to the original literal.
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

const TYPOGRAPHY_FIELDS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const;

function normalizeTokens(raw: Record<string, unknown>): DesignTokens {
  const tokens: DesignTokens = { name: String(raw.name) };
  if (typeof raw.description === 'string') tokens.description = raw.description;

  const flat = (cat: 'colors' | 'spacing' | 'rounded') => {
    const src = raw[cat];
    if (!isPlainObject(src)) return;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) {
      if (typeof v === 'string' || typeof v === 'number') out[k] = resolveValue(v, raw);
    }
    if (Object.keys(out).length > 0) tokens[cat] = out;
  };
  flat('colors');
  flat('spacing');
  flat('rounded');

  if (isPlainObject(raw.typography)) {
    const out: Record<string, TypographyToken> = {};
    for (const [k, v] of Object.entries(raw.typography)) {
      if (!isPlainObject(v)) continue;
      const entry: TypographyToken = {};
      for (const field of TYPOGRAPHY_FIELDS) {
        const fv = v[field];
        if (typeof fv === 'string' || typeof fv === 'number') entry[field] = resolveValue(fv, raw);
      }
      if (Object.keys(entry).length > 0) out[k] = entry;
    }
    if (Object.keys(out).length > 0) tokens.typography = out;
  }

  if (isPlainObject(raw.components)) {
    const out: Record<string, Record<string, string>> = {};
    for (const [name, props] of Object.entries(raw.components)) {
      if (!isPlainObject(props)) continue;
      const entry: Record<string, string> = {};
      for (const [prop, v] of Object.entries(props)) {
        if (typeof v === 'string' || typeof v === 'number') entry[prop] = resolveValue(v, raw);
      }
      if (Object.keys(entry).length > 0) out[name] = entry;
    }
    if (Object.keys(out).length > 0) tokens.components = out;
  }

  return tokens;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i;

export function isValidCssColor(value: string): boolean {
  const v = value.trim();
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', v) || HEX_COLOR.test(v) || FUNC_COLOR.test(v);
  }
  return HEX_COLOR.test(v) || FUNC_COLOR.test(v);
}

const LENGTH_PATTERN = /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em)?$/i;

export function cssLength(value: string): number | null {
  const m = LENGTH_PATTERN.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = m[2]?.toLowerCase();
  return unit === 'rem' || unit === 'em' ? n * 16 : n;
}

const SECTION_NAMES: Record<string, TokenCategory> = {
  colors: 'colors',
  color: 'colors',
  colours: 'colors',
  colour: 'colors',
  'color palette': 'colors',
  'colour palette': 'colors',
  palette: 'colors',
  theme: 'colors',
  typography: 'typography',
  layout: 'spacing',
  spacing: 'spacing',
  shapes: 'rounded',
  shape: 'rounded',
  components: 'components',
};

// Tools number their sections and add subtitles ("2. Colors: The Print
// Palette"), and some sections cover more than one category ("Layout &
// Spacing", "Tokens — Spacing & Shapes"). The name is what comes before a
// colon; each part of it separated by a spaced dash, comma, & or "and" counts.
export function categoriesForHeading(text: string): TokenCategory[] {
  const name = text
    .trim()
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, '')
    .split(':')[0];
  const categories: TokenCategory[] = [];
  for (const part of name.split(/\s+[—–-]\s+|,|&|\band\b/)) {
    const category = SECTION_NAMES[part.replace(/\s+/g, ' ').trim()];
    if (category && !categories.includes(category)) categories.push(category);
  }
  return categories;
}

// Minimal structural view of an mdast node — enough to walk the tree and read
// heading text/positions without pulling in the full @types/mdast surface.
interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  position?: { start: { line: number } };
  children?: MdNode[];
}

// Single reusable processor: buildInjectionMap runs on every content change, so
// avoid re-instantiating the parser. No plugins beyond remarkParse + remarkGfm,
// matching the CommonMark+GFM machinery the renderer (react-markdown) uses.
const headingProcessor = unified().use(remarkParse).use(remarkGfm);

// Concatenate the text/inlineCode descendants of a heading node — the same
// characters react-markdown renders for that heading.
function headingText(node: MdNode): string {
  let out = '';
  const walk = (n: MdNode): void => {
    if (n.type === 'text' || n.type === 'inlineCode') out += n.value ?? '';
    if (n.children) for (const child of n.children) walk(child);
  };
  walk(node);
  return out;
}

// Map of 1-based body line number of a real h2 heading → categories to inject
// there. Parsing with the same CommonMark+GFM machinery as the renderer means
// the map agrees with it by construction: headings inside code fences don't
// exist in the mdast tree, while setext and 1-3-space-indented ATX headings do,
// with correct positions. First matching heading per category wins; a category
// with no (non-empty) tokens is skipped.
export function buildInjectionMap(body: string, tokens: DesignTokens): Map<number, TokenCategory[]> {
  const map = new Map<number, TokenCategory[]>();
  const claimed = new Set<TokenCategory>();
  const tree = headingProcessor.parse(body) as unknown as MdNode;

  const visit = (node: MdNode): void => {
    if (node.type === 'heading' && node.depth === 2 && node.position) {
      const categories = categoriesForHeading(headingText(node)).filter(
        (cat) => !claimed.has(cat) && tokens[cat] && Object.keys(tokens[cat] as object).length > 0
      );
      if (categories.length > 0) {
        categories.forEach((cat) => claimed.add(cat));
        map.set(node.position.start.line, categories);
      }
    }
    if (node.children) for (const child of node.children) visit(child);
  };
  visit(tree);
  return map;
}
