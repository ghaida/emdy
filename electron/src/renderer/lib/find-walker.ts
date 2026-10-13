export interface FindMatchesResult {
  marks: HTMLElement[];
  isCapped: boolean;
}

// Matches are wrapped in HTML <mark> elements, which don't render inside SVG:
// a match in a diagram label would make that text disappear.
const SKIP_SELECTOR = 'script, style, svg';

// A mark splits a text node into head, match and tail, and the head may be
// React's. Clearing appends the match and tail back onto the head and removes
// only the pieces find created. normalize() would remove a head emptied by a
// match at its first character, and React would throw on its next update there.
const splits = new WeakMap<Element, { head: Text; tail: Text }>();

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Raw HTML on its own line renders as text directly in the root, which
      // outlives each document: a mark split off there would be left behind.
      if (parent === root) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface MatchRange {
  start: number;
  length: number;
}

// Offsets come from the original text. Lowercasing it first would shift them:
// 'İ'.toLowerCase() is two UTF-16 units, and splitText at a shifted offset
// throws. Unicode case folding with the u flag never changes a match's length.
function findRanges(text: string, pattern: RegExp): MatchRange[] {
  const ranges: MatchRange[] = [];
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m[0].length === 0) {
      pattern.lastIndex++;
      continue;
    }
    ranges.push({ start: m.index, length: m[0].length });
  }
  return ranges;
}

export function findMatches(
  root: HTMLElement,
  query: string,
  maxMatches: number
): FindMatchesResult {
  clearMatches(root);

  const trimmed = query.trim();
  if (!trimmed) return { marks: [], isCapped: false };

  const pattern = new RegExp(escapeRegExp(query), 'giu');
  const textNodes = collectTextNodes(root);

  const marks: HTMLElement[] = [];
  let isCapped = false;

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const ranges = findRanges(text, pattern);
    if (ranges.length === 0) continue;

    if (marks.length >= maxMatches) {
      // We already hit the cap; any additional matches confirm isCapped.
      isCapped = true;
      continue;
    }

    let currentNode: Text = textNode;
    let consumed = 0;
    for (const range of ranges) {
      if (marks.length >= maxMatches) {
        isCapped = true;
        break;
      }
      const relPos = range.start - consumed;
      const matchNode = currentNode.splitText(relPos);
      const tail = matchNode.splitText(range.length);
      const mark = document.createElement('mark');
      mark.setAttribute('data-emdy-match', '');
      mark.setAttribute('data-match-index', String(marks.length));
      matchNode.parentNode!.insertBefore(mark, matchNode);
      mark.appendChild(matchNode);
      splits.set(mark, { head: textNode, tail });
      marks.push(mark);
      currentNode = tail;
      consumed = range.start + range.length;
    }
  }

  return { marks, isCapped };
}

export function clearMatches(root: HTMLElement): void {
  // Document order: the tails of earlier marks in the same text node are gone
  // by the time a mark is reached, so it sits right after its head again.
  root.querySelectorAll('mark[data-emdy-match]').forEach((mark) => {
    const split = splits.get(mark);
    if (split && mark.previousSibling === split.head && mark.nextSibling === split.tail) {
      split.head.appendData((mark.textContent ?? '') + split.tail.data);
      split.tail.remove();
      mark.remove();
    } else {
      mark.replaceWith(...mark.childNodes);
    }
  });
}
