// Stamps each top-level block with the source line it starts on, so a palette
// result for line N can be matched to the element it rendered into, and counts
// what the page shows of a block's lines, to find line N's match inside it.

interface BlockNode {
  position?: { start: { line: number } };
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
}

export function remarkSourceLines() {
  return (tree: { children: BlockNode[] }) => {
    for (const node of tree.children) {
      const line = node.position?.start.line;
      if (line === undefined) continue;
      const data = (node.data ??= {});
      data.hProperties = { ...(data.hProperties ?? {}), 'data-line': line };
    }
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Where 1-based `line` starts in `text`, or the end of the text past its last line.
function lineStart(text: string, line: number): number {
  let index = 0;
  for (let n = 1; n < line; n++) {
    const next = text.indexOf('\n', index);
    if (next === -1) return text.length;
    index = next + 1;
  }
  return index;
}

const FENCE_OPEN = /^ {0,3}(?:`{3,}|~{3,})/;

/**
 * How often find would match `query` in what the page shows of lines `from` up
 * to, not including, `to`: the matches a pick on line `to` skips in a block
 * that starts on line `from`. Entities and backslash escapes (`&amp;`, `\_`)
 * show as other text than they're written, so a match spelled that way isn't
 * counted and the pick lands one match early, still in the block. Accepted
 * for 1.9.0.
 */
export function countShownMatches(text: string, query: string, from: number, to: number): number {
  let lines = text.slice(lineStart(text, from), lineStart(text, to));
  if (FENCE_OPEN.test(lines)) {
    // A fence shows its code as written, but not the line that opens it.
    const opener = lines.indexOf('\n');
    lines = opener === -1 ? '' : lines.slice(opener + 1);
  } else {
    // Images, link addresses and comments aren't text on the page.
    lines = lines
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/<!--[\s\S]*?-->/g, '');
  }
  return lines.match(new RegExp(escapeRegExp(query), 'giu'))?.length ?? 0;
}
