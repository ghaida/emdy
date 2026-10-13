import { describe, it, expect, beforeEach } from 'vitest';
import { findMatches, clearMatches } from './find-walker';

function setup(html: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!doctype html><html><body><div class="markdown-body">${html}</div></body></html>`,
    'text/html'
  );
  const root = doc.body.firstElementChild as HTMLElement;
  document.body.appendChild(root);
  return root;
}

describe('findMatches', () => {
  beforeEach(() => {
    document.body.textContent = '';
  });

  it('returns empty for empty query', () => {
    const root = setup('<p>Hello world</p>');
    const { marks, isCapped } = findMatches(root, '', 1000);
    expect(marks).toEqual([]);
    expect(isCapped).toBe(false);
    expect(root.querySelectorAll('mark[data-emdy-match]').length).toBe(0);
  });

  it('returns empty for whitespace-only query', () => {
    const root = setup('<p>Hello world</p>');
    const { marks, isCapped } = findMatches(root, '   ', 1000);
    expect(marks).toEqual([]);
    expect(isCapped).toBe(false);
  });

  it('skips text inside SVG, where an HTML <mark> would hide the match', () => {
    const root = setup('<p>alpha</p><svg><text>alpha</text><foreignObject><div>alpha</div></foreignObject></svg>');
    const { marks } = findMatches(root, 'alpha', 1000);
    expect(marks.length).toBe(1);
    expect(root.querySelector('svg mark')).toBeNull();
  });

  it('skips text directly in the root, where a mark would outlive the document', () => {
    const root = setup('Intro<p>x</p>');
    const childCount = root.childNodes.length;
    expect(findMatches(root, 'Intro', 1000).marks.length).toBe(0);
    expect(root.childNodes.length).toBe(childCount);
  });

  it('returns empty when no matches found', () => {
    const root = setup('<p>Hello world</p>');
    const { marks, isCapped } = findMatches(root, 'xyz', 1000);
    expect(marks).toEqual([]);
    expect(isCapped).toBe(false);
  });

  it('wraps a single match in a plain paragraph', () => {
    const root = setup('<p>The quick brown fox</p>');
    const { marks, isCapped } = findMatches(root, 'quick', 1000);
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('quick');
    expect(marks[0].tagName).toBe('MARK');
    expect(marks[0].hasAttribute('data-emdy-match')).toBe(true);
    expect(marks[0].getAttribute('data-match-index')).toBe('0');
    expect(isCapped).toBe(false);
  });

  it('wraps multiple matches in the same paragraph in document order', () => {
    const root = setup('<p>foo bar foo baz foo</p>');
    const { marks } = findMatches(root, 'foo', 1000);
    expect(marks.length).toBe(3);
    expect(marks.map((m) => m.textContent)).toEqual(['foo', 'foo', 'foo']);
    expect(marks.map((m) => m.getAttribute('data-match-index'))).toEqual(['0', '1', '2']);
  });

  it('wraps matches across multiple paragraphs in document order', () => {
    const root = setup('<p>one alpha two</p><p>three alpha four</p><p>five alpha six</p>');
    const { marks } = findMatches(root, 'alpha', 1000);
    expect(marks.length).toBe(3);
    expect(marks[0].closest('p')).toBe(root.children[0]);
    expect(marks[1].closest('p')).toBe(root.children[1]);
    expect(marks[2].closest('p')).toBe(root.children[2]);
  });

  it('does NOT match across element boundaries', () => {
    const root = setup('<p><em>foo</em>bar</p>');
    const { marks } = findMatches(root, 'foobar', 1000);
    expect(marks).toEqual([]);
  });

  it('is case-insensitive', () => {
    const root = setup('<p>Hello hello HELLO HeLLo</p>');
    const { marks } = findMatches(root, 'hello', 1000);
    expect(marks.length).toBe(4);
    expect(marks.map((m) => m.textContent)).toEqual(['Hello', 'hello', 'HELLO', 'HeLLo']);
  });

  it('matches inside <code>', () => {
    const root = setup('<p>before <code>match</code> after match</p>');
    const { marks } = findMatches(root, 'match', 1000);
    expect(marks.length).toBe(2);
    expect(marks[0].closest('code')).not.toBe(null);
    expect(marks[1].closest('code')).toBe(null);
  });

  it('matches inside <pre>', () => {
    const root = setup('<pre><code>match</code></pre><p>match after</p>');
    const { marks } = findMatches(root, 'match', 1000);
    expect(marks.length).toBe(2);
    expect(marks[0].closest('pre')).not.toBe(null);
    expect(marks[1].closest('pre')).toBe(null);
  });

  it('matches inside <a href>', () => {
    const root = setup('<p>see <a href="#x">match</a> and match again</p>');
    const { marks } = findMatches(root, 'match', 1000);
    expect(marks.length).toBe(2);
    expect(marks[0].closest('a')).not.toBe(null);
    expect(marks[1].closest('a')).toBe(null);
  });

  it('matches nested code inside a list item', () => {
    const root = setup('<ul><li>item <code>match</code> here match</li></ul>');
    const { marks } = findMatches(root, 'match', 1000);
    expect(marks.length).toBe(2);
    expect(marks[0].closest('code')).not.toBe(null);
    expect(marks[1].closest('code')).toBe(null);
  });

  it('enforces the match cap and reports isCapped', () => {
    const items = Array.from({ length: 10 }, () => '<p>match</p>').join('');
    const root = setup(items);
    const { marks, isCapped } = findMatches(root, 'match', 3);
    expect(marks.length).toBe(3);
    expect(isCapped).toBe(true);
  });

  it('does not report isCapped when match count equals the cap exactly but no more exist', () => {
    const items = Array.from({ length: 3 }, () => '<p>match</p>').join('');
    const root = setup(items);
    const { marks, isCapped } = findMatches(root, 'match', 3);
    expect(marks.length).toBe(3);
    expect(isCapped).toBe(false);
  });

  it('handles a Turkish dotted İ without throwing or drifting', () => {
    const root = setup("<p>Toplantı İzmir'de yapılacak</p>");
    const { marks } = findMatches(root, 'yapılacak', 1000);
    expect(marks.map((m) => m.textContent)).toEqual(['yapılacak']);
  });

  it('matches İ itself', () => {
    const root = setup('<p>Gidiş İzmir</p>');
    const { marks } = findMatches(root, 'İzmir', 1000);
    expect(marks.map((m) => m.textContent)).toEqual(['İzmir']);
  });

  it('treats regex characters in the query literally', () => {
    const root = setup('<p>a.b and axb and (x) and [1]</p>');
    expect(findMatches(root, 'a.b', 1000).marks.map((m) => m.textContent)).toEqual(['a.b']);
    expect(findMatches(root, '(x)', 1000).marks.map((m) => m.textContent)).toEqual(['(x)']);
    expect(findMatches(root, '[1]', 1000).marks.map((m) => m.textContent)).toEqual(['[1]']);
  });

  it('is still case-insensitive for ASCII', () => {
    const root = setup('<p>Alpha ALPHA alpha</p>');
    expect(findMatches(root, 'alpha', 1000).marks.length).toBe(3);
  });
});

describe('clearMatches', () => {
  beforeEach(() => {
    document.body.textContent = '';
  });

  it('restores original text and rejoins split text nodes', () => {
    const root = setup('<p>foo bar foo baz foo</p>');
    const originalText = root.textContent;
    findMatches(root, 'foo', 1000);
    expect(root.querySelectorAll('mark[data-emdy-match]').length).toBe(3);

    clearMatches(root);

    expect(root.querySelectorAll('mark[data-emdy-match]').length).toBe(0);
    expect(root.textContent).toBe(originalText);
    const p = root.querySelector('p')!;
    expect(p.childNodes.length).toBe(1);
    expect(p.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  });

  it('is a no-op when no marks are present', () => {
    const root = setup('<p>nothing to do</p>');
    expect(() => clearMatches(root)).not.toThrow();
    expect(root.textContent).toBe('nothing to do');
  });

  it('keeps the original text node when a match starts at its first character', () => {
    const root = setup('<p>See <a href="#">docs</a>.</p>');
    const p = root.querySelector('p');
    const original = p?.lastChild as Text;
    expect(findMatches(root, '.', 1000).marks.length).toBe(1);

    clearMatches(root);

    expect(p?.lastChild).toBe(original);
    expect(original.data).toBe('.');
    expect(p?.textContent).toBe('See docs.');
  });

  it('rejoins a match into the text node it was split from', () => {
    const root = setup('<p>Hello world</p>');
    const p = root.querySelector('p');
    const original = p?.firstChild;
    expect(findMatches(root, 'world', 1000).marks.length).toBe(1);

    clearMatches(root);

    expect(p?.childNodes.length).toBe(1);
    expect(p?.firstChild).toBe(original);
    expect(p?.textContent).toBe('Hello world');
  });

  it('keeps two adjacent text nodes as the same two nodes', () => {
    const root = setup('<p></p>');
    const p = root.querySelector('p');
    const first = document.createTextNode('one foo ');
    const second = document.createTextNode('two foo');
    p?.append(first, second);
    expect(findMatches(root, 'foo', 1000).marks.length).toBe(2);

    clearMatches(root);

    expect(p?.childNodes.length).toBe(2);
    expect(p?.childNodes[0]).toBe(first);
    expect(p?.childNodes[1]).toBe(second);
    expect([first.data, second.data]).toEqual(['one foo ', 'two foo']);
  });

  it('leaves a text node it did not split alone when the original is gone', () => {
    const root = setup('<p>Hello world</p>');
    const p = root.querySelector('p');
    expect(findMatches(root, 'world', 1000).marks.length).toBe(1);
    const stranger = document.createTextNode('Bye ');
    p?.firstChild?.replaceWith(stranger);

    clearMatches(root);

    expect(stranger.data).toBe('Bye ');
    expect(p?.textContent).toBe('Bye world');
    expect(root.querySelector('mark')).toBeNull();
  });
});
