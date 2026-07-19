import { parse as parseYaml } from 'yaml';

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
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseDesignMd(content: string): ParsedDesignMd | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;

  let raw: unknown;
  try {
    raw = parseYaml(match[1]);
  } catch {
    return null;
  }
  if (!isPlainObject(raw)) return null;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;

  const hasTokens = TOKEN_CATEGORIES.some(
    (cat) => isPlainObject(raw[cat]) && Object.keys(raw[cat] as object).length > 0
  );
  if (!hasTokens) return null;

  const body = content.slice(match[0].length);
  return { body, tokens: normalizeTokens(raw) };
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
  for (let hop = 0; hop < MAX_REFERENCE_HOPS; hop++) {
    if (typeof current !== 'string' && typeof current !== 'number') break;
    const str = String(current);
    const ref = REFERENCE_PATTERN.exec(str);
    if (!ref) return str;
    const next = lookupPath(root, ref[1]);
    if (next === undefined || next === current) return str;
    current = next;
  }
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

const LENGTH_PATTERN = /^([\d.]+)(px|rem|em)?$/;

export function cssLength(value: string): number | null {
  const m = LENGTH_PATTERN.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : n;
}
