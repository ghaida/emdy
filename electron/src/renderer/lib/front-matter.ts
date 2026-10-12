import { parse as parseYaml } from 'yaml';

// YAML front matter between `---` fences at the top of a file. Some tools put an
// HTML comment above it, so leading comments and blank lines are allowed. A
// comment's text can't contain `-->`, so a run of comments matches one way only.
const FRONT_MATTER_PATTERN = /^(?:\s*<!--(?:(?!-->)[\s\S])*-->)*\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// Cap the captured block before handing it to the YAML parser. Measured hazard:
// a ~3MB valid front-matter block blocks the UI thread for minutes inside
// parseYaml. Real front matter is <10KB, so 100KB is a generous ceiling that
// keeps the parser responsive while never rejecting a legitimate file.
const MAX_FRONT_MATTER_CHARS = 100 * 1024;

export interface FrontMatter {
  data: Record<string, unknown>;
  /** The document after the front matter and any comments above it. */
  body: string;
}

/** Front matter only counts when it parses as a YAML mapping, so a document that
 * opens with a horizontal rule and a line of prose is left alone. */
export function splitFrontMatter(content: string): FrontMatter | null {
  // Strip a leading UTF-8 BOM so the opening fence is still recognized.
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  const match = FRONT_MATTER_PATTERN.exec(text);
  if (!match || match[1].length > MAX_FRONT_MATTER_CHARS) return null;

  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

  return { data: data as Record<string, unknown>, body: text.slice(match[0].length) };
}

/** The document without its front matter, which is metadata, not something to read. */
export function stripFrontMatter(content: string): string {
  return splitFrontMatter(content)?.body ?? content;
}
