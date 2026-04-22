export interface FindMatchesResult {
  marks: HTMLElement[];
  isCapped: boolean;
}

const SKIP_SELECTOR = 'script, style';

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

function findPositions(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  if (!needle) return positions;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    positions.push(idx);
    idx += needle.length;
  }
  return positions;
}

export function findMatches(
  root: HTMLElement,
  query: string,
  maxMatches: number
): FindMatchesResult {
  clearMatches(root);

  const trimmed = query.trim();
  if (!trimmed) return { marks: [], isCapped: false };

  const q = query.toLowerCase();
  const textNodes = collectTextNodes(root);

  const marks: HTMLElement[] = [];
  let isCapped = false;

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const lower = text.toLowerCase();
    const positions = findPositions(lower, q);
    if (positions.length === 0) continue;

    if (marks.length >= maxMatches) {
      // We already hit the cap; any additional matches confirm isCapped.
      isCapped = true;
      continue;
    }

    let currentNode: Text = textNode;
    let consumed = 0;
    for (const pos of positions) {
      if (marks.length >= maxMatches) {
        isCapped = true;
        break;
      }
      const relPos = pos - consumed;
      const matchNode = currentNode.splitText(relPos);
      const tail = matchNode.splitText(q.length);
      const mark = document.createElement('mark');
      mark.setAttribute('data-emdy-match', '');
      mark.setAttribute('data-match-index', String(marks.length));
      matchNode.parentNode!.insertBefore(mark, matchNode);
      mark.appendChild(matchNode);
      marks.push(mark);
      currentNode = tail;
      consumed = pos + q.length;
    }
  }

  return { marks, isCapped };
}

export function clearMatches(root: HTMLElement): void {
  const marks = root.querySelectorAll('mark[data-emdy-match]');
  if (marks.length === 0) return;
  const parents = new Set<Node>();
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parents.add(parent);
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
  parents.forEach((p) => p.normalize());
}
