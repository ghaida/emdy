import { parse as parseYaml } from 'yaml';

// YAML front matter between `---` fences at the top of a file. Some tools put an
// HTML comment above it, so leading comments and blank lines are allowed. A
// comment's text can't contain `-->`, so a run of comments matches one way only.
// The block can be empty, and it ends at the first closing fence.
const FRONT_MATTER_PATTERN = /^(?:\s*<!--(?:(?!-->)[\s\S])*-->)*\s*---\r?\n(?:([\s\S]*?)\r?\n)??---(?:\r?\n|$)/;

// Cap the captured block before handing it to the YAML parser. Measured hazard:
// a ~3MB valid front-matter block blocks the UI thread for minutes inside
// parseYaml. Real front matter is <10KB, so 100KB is a generous ceiling that
// keeps the parser responsive while never rejecting a legitimate file.
const MAX_FRONT_MATTER_CHARS = 100 * 1024;

// A line of front matter: a key, a comment, a list item, or an indented
// continuation. A block of such lines is metadata even if the YAML is broken,
// as long as its first line after any comments is a top-level key: a list or a
// heading between two rules is not front matter.
const METADATA_LINE = /^(?:[\w.-]+\s*:|#|-\s|\s)/;
const KEY_LINE = /^[\w.-]+\s*:/;

function looksLikeMetadata(block: string): boolean {
  const lines = block.split(/\r?\n/).filter((l) => l.trim() !== '');
  const first = lines.find((l) => !l.trimStart().startsWith('#'));
  return first !== undefined && KEY_LINE.test(first) && lines.every((l) => METADATA_LINE.test(l));
}

export interface FrontMatter {
  data: Record<string, unknown>;
  /** The document after the front matter and any comments above it. */
  body: string;
}

/** Front matter counts when it parses as a YAML mapping, when it's empty or only
 * whitespace, or when its YAML is broken but it starts with a key and every line
 * looks like metadata. A heading or a list alone between two horizontal rules
 * stays visible, and so does prose unless YAML reads it as keys and values, as it
 * does `Note: read this first`. */
export function splitFrontMatter(content: string): FrontMatter | null {
  // Strip a leading UTF-8 BOM so the opening fence is still recognized.
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  const match = FRONT_MATTER_PATTERN.exec(text);
  if (!match) return null;
  const block = match[1] ?? '';
  if (block.length > MAX_FRONT_MATTER_CHARS) return null;
  const body = text.slice(match[0].length);
  if (block.trim() === '') return { data: {}, body };

  let data: unknown;
  try {
    data = parseYaml(block);
  } catch {
    return looksLikeMetadata(block) ? { data: {}, body } : null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  return { data: data as Record<string, unknown>, body };
}

/** The document without its front matter, which is metadata, not something to read. */
export function stripFrontMatter(content: string): string {
  return splitFrontMatter(content)?.body ?? content;
}
