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

// Task 2 replaces this stub with reference resolution + value normalization.
function normalizeTokens(raw: Record<string, unknown>): DesignTokens {
  const tokens: DesignTokens = { name: String(raw.name) };
  if (typeof raw.description === 'string') tokens.description = raw.description;
  for (const cat of TOKEN_CATEGORIES) {
    if (isPlainObject(raw[cat]) && Object.keys(raw[cat] as object).length > 0) {
      (tokens as unknown as Record<string, unknown>)[cat] = raw[cat];
    }
  }
  return tokens;
}
