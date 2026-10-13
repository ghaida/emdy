import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, act, screen, fireEvent } from '@testing-library/react';
import { MarkdownView, type MarkdownViewHandle, type HighlightState } from './MarkdownView';
import { warm, cool } from '../lib/color-themes';
import { parseDesignMd, type DesignTokens } from '../lib/design-md';
import { FULL_CODE_ATTR } from '../lib/code-export';
import { countShownMatches } from '../lib/remark-source-lines';

const colors = warm.light;

function setup(initialHighlight: HighlightState | null = null, onMatchesChanged = vi.fn()) {
  const ref = createRef<MarkdownViewHandle>();
  const utils = render(
    <MarkdownView
      ref={ref}
      content={'Alpha beta alpha gamma alpha'}
      colors={colors}
      highlight={initialHighlight}
      onMatchesChanged={onMatchesChanged}
    />
  );
  return { ...utils, ref, onMatchesChanged };
}

describe('MarkdownView highlight integration', () => {
  it('renders no marks when highlight is null', async () => {
    const { container, onMatchesChanged } = setup(null);
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(0);
    });
    expect(onMatchesChanged).toHaveBeenCalledWith(0, false, []);
  });

  it('walks and wraps matches when highlight is present', async () => {
    const { container, onMatchesChanged } = setup({
      query: 'alpha',
      currentIndex: 0,
      mode: 'multi-persistent',
    });
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    const lastCall = onMatchesChanged.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe(3);
    expect(lastCall[1]).toBe(false);
    expect(Array.isArray(lastCall[2])).toBe(true);
    expect(lastCall[2].length).toBe(3);
  });

  it('marks the current match with data-current', async () => {
    const { container } = setup({ query: 'alpha', currentIndex: 1, mode: 'multi-persistent' });
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    const marks = container.querySelectorAll('mark[data-emdy-match]');
    expect(marks[0].getAttribute('data-current')).toBe(null);
    expect(marks[1].getAttribute('data-current')).toBe('true');
    expect(marks[2].getAttribute('data-current')).toBe(null);
  });

  it('clears marks when highlight flips back to null', async () => {
    const { container, rerender } = render(
      <MarkdownView
        content={'alpha beta alpha'}
        colors={colors}
        highlight={{ query: 'alpha', currentIndex: 0, mode: 'multi-persistent' }}
      />
    );
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(2);
    });

    rerender(
      <MarkdownView content={'alpha beta alpha'} colors={colors} highlight={null} />
    );
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(0);
    });
  });

  it('moves data-current when currentIndex changes', async () => {
    const { container, rerender } = render(
      <MarkdownView
        content={'alpha beta alpha gamma alpha'}
        colors={colors}
        highlight={{ query: 'alpha', currentIndex: 0, mode: 'multi-persistent' }}
      />
    );
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    let marks = container.querySelectorAll('mark[data-emdy-match]');
    expect(marks[0].getAttribute('data-current')).toBe('true');

    rerender(
      <MarkdownView
        content={'alpha beta alpha gamma alpha'}
        colors={colors}
        highlight={{ query: 'alpha', currentIndex: 2, mode: 'multi-persistent' }}
      />
    );
    marks = container.querySelectorAll('mark[data-emdy-match]');
    await waitFor(() => {
      expect(marks[2].getAttribute('data-current')).toBe('true');
    });
    expect(marks[0].getAttribute('data-current')).toBe(null);
  });

  it('exposes getMatchCount via imperative handle', async () => {
    const { container, ref } = setup({ query: 'alpha', currentIndex: 0, mode: 'multi-persistent' });
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    expect(ref.current?.getMatchCount()).toBe(3);
  });

  it('scrollToMatch is callable without throwing when match exists', async () => {
    const { container, ref } = setup({ query: 'alpha', currentIndex: 0, mode: 'multi-persistent' });
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    // jsdom's scrollIntoView is a no-op stub; ensure the call doesn't throw.
    expect(() => act(() => ref.current?.scrollToMatch(1))).not.toThrow();
  });

  it('focusMatchAtLine returns an index given a plausible line', async () => {
    const { container, ref } = setup({ query: 'alpha', currentIndex: 0, mode: 'multi-persistent' });
    await waitFor(() => {
      expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(3);
    });
    // Content renders as one block (a single paragraph). Line 1 → block 0 → first match.
    expect(ref.current?.focusMatchAtLine(1)).toBe(0);
  });
});

const DESIGN_FILE = `---
name: Heritage
description: Warm editorial identity
colors:
  primary: "#1A1C1E"
typography:
  h1:
    fontSize: 3rem
---

## Overview

Intro text.

## Colors

Color rationale.
`;

function renderView(props: Partial<React.ComponentProps<typeof MarkdownView>> & { content: string }) {
  return render(<MarkdownView colors={colors} {...props} />);
}

describe('MarkdownView design.md rendering', () => {
  function renderDesign() {
    const parsed = parseDesignMd(DESIGN_FILE)!;
    return renderView({ content: DESIGN_FILE, designTokens: parsed.tokens });
  }

  it('renders the front-matter name and description as a header', () => {
    renderDesign();
    expect(screen.getByText('Heritage')).toBeInTheDocument();
    expect(screen.getByText('Warm editorial identity')).toBeInTheDocument();
  });

  it('injects the swatch grid under the matching Colors heading', () => {
    renderDesign();
    const heading = screen.getByRole('heading', { name: 'Colors' });
    const sibling = heading.nextElementSibling;
    expect(sibling?.classList.contains('design-block')).toBe(true);
    expect(sibling?.querySelector('.design-swatches')).not.toBeNull();
  });

  it('shows every category a heading names under it, and not again at the end', () => {
    renderView({
      content: '## 2. Colors & Typography: The Print Palette\n\nText.\n',
      designTokens: { name: 'X', colors: { ink: '#111111' }, typography: { body: { fontSize: '16px' } } },
    });
    const heading = screen.getByRole('heading', { name: '2. Colors & Typography: The Print Palette' });
    const swatches = heading.nextElementSibling;
    expect(swatches?.querySelector('.design-swatches')).not.toBeNull();
    expect(swatches?.nextElementSibling?.querySelector('.design-specimens')).not.toBeNull();
    expect(document.querySelector('.design-appendix')).toBeNull();
  });

  it('appends unmatched categories at the end', () => {
    renderDesign();
    // typography tokens exist but there is no ## Typography heading
    const appendix = document.querySelector('.design-appendix');
    expect(appendix).not.toBeNull();
    expect(appendix!.querySelector('.design-specimens')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Typography' })).toBeInTheDocument();
  });

  it('leaves out the end section when told to', () => {
    renderView({
      content: '## Overview\n\nText.\n',
      designTokens: { name: '', colors: { ink: '#111111' } },
      designAppendix: false,
    });
    expect(document.querySelector('.design-appendix')).toBeNull();
    expect(document.querySelector('.design-swatches')).toBeNull();
  });

  it('shows no header for tokens without a name', () => {
    renderView({ content: '# Pravah\n\n## Colors\n', designTokens: { name: '', colors: { ink: '#111111' } } });
    expect(document.querySelector('.design-header')).toBeNull();
    expect(document.querySelector('.design-swatches')).not.toBeNull();
  });

  it('renders plain markdown unchanged when designTokens is absent', () => {
    renderView({ content: '## Colors\n\nJust a doc.' });
    expect(document.querySelector('.design-swatches')).toBeNull();
    expect(document.querySelector('.design-appendix')).toBeNull();
  });
});

describe('MarkdownView front matter and comments', () => {
  it('hides front matter', () => {
    const { container } = render(
      <MarkdownView content={'---\ntitle: My note\ntags: [a, b]\n---\n\n# Heading\n\nBody.'} colors={colors} />
    );
    expect(container.querySelector('hr')).toBeNull();
    expect(container.querySelector('h2')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Heading');
    expect(container.textContent).not.toContain('title:');
  });

  it('hides front matter that sits below an HTML comment', () => {
    const { container } = render(
      <MarkdownView content={'<!-- SEED: generated -->\n\n---\nname: Mutual aid\n---\n\n# Design'} colors={colors} />
    );
    expect(container.textContent).not.toContain('SEED');
    expect(container.textContent).not.toContain('name:');
    expect(container.querySelector('hr')).toBeNull();
  });

  it('hides HTML comments, on their own and inline', () => {
    const { container } = render(
      <MarkdownView content={'<!-- a note for tools -->\n\n# Title\n\nBefore <!-- aside --> after.'} colors={colors} />
    );
    expect(container.textContent).not.toContain('a note for tools');
    expect(container.textContent).not.toContain('aside');
    expect(container.textContent).toContain('Before');
    expect(container.textContent).toContain('after.');
  });

  it('keeps comment syntax inside code', () => {
    const { container } = render(
      <MarkdownView content={'Use `<!-- -->` in HTML.\n\n```html\n<!-- kept -->\n```'} colors={colors} />
    );
    expect(container.textContent).toContain('<!-- -->');
    expect(container.textContent).toContain('<!-- kept -->');
  });
});

describe('MarkdownView code blocks', () => {
  const longCode = Array.from({ length: 250 }, (_, i) => `log(${i + 1});`).join('\n');

  it('keeps the full code of a block cut short on screen, for export', () => {
    renderView({ content: '```js\nconst a = 1;\n```\n\n```js\n' + longCode + '\n```' });
    const [short, long] = [...document.querySelectorAll('.code-block-wrapper')];

    expect(short.hasAttribute(FULL_CODE_ATTR)).toBe(false);
    expect(long.getAttribute(FULL_CODE_ATTR)).toBe(longCode);
    expect(long.querySelector('code')!.textContent!.split('\n')).toHaveLength(200);

    fireEvent.click(screen.getByRole('button', { name: 'Show all 250 lines' }));

    expect(long.hasAttribute(FULL_CODE_ATTR)).toBe(false);
    expect(long.querySelector('code')!.textContent).toBe(longCode);
  });
});

describe('MarkdownView document switch while find is applied', () => {
  const docA = 'Run npm install **first** before you start.\n\nSecond paragraph.';
  const docB = 'Open the settings **panel** to begin.\n\nAnother paragraph.';
  const highlight = (dismissing: boolean): HighlightState => ({
    query: 'npm',
    currentIndex: 0,
    mode: 'multi-persistent',
    dismissing,
  });

  it('leaves none of the old document behind in the new one', async () => {
    const props = { colors, filePath: '/x/a.md', onMatchesChanged: vi.fn() };
    const { container, rerender } = render(<MarkdownView {...props} content={docA} highlight={highlight(false)} />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    // Clicking another file: the new content and closeFind land in one render,
    // and the query stays applied while the find bar fades out.
    await act(async () => {
      rerender(<MarkdownView {...props} filePath="/x/b.md" content={docB} highlight={highlight(true)} />);
    });
    await act(async () => {
      rerender(<MarkdownView {...props} filePath="/x/b.md" content={docB} highlight={null} />);
    });
    expect(container.querySelector('.markdown-body')?.textContent).toBe('Open the settings panel to begin.\nAnother paragraph.');
  });

  it('leaves none of the other file behind when going back to the first one with find applied', async () => {
    const base = { colors, onMatchesChanged: vi.fn() };
    const docA2 = 'Alpha **one** text here.';
    const docB2 = 'Beta **two** foo here.';
    const foo = (dismissing: boolean): HighlightState => ({ query: 'foo', currentIndex: 0, mode: 'multi-persistent', dismissing });
    const { container, rerender } = render(<MarkdownView {...base} filePath="/x/a.md" content={docA2} highlight={null} />);
    // b.md with find closed is patched in place.
    rerender(<MarkdownView {...base} filePath="/x/b.md" content={docB2} highlight={null} />);
    rerender(<MarkdownView {...base} filePath="/x/b.md" content={docB2} highlight={foo(false)} />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    // Clicking a.md: its content and closeFind land in one render.
    await act(async () => {
      rerender(<MarkdownView {...base} filePath="/x/a.md" content={docA2} highlight={foo(true)} />);
    });
    await act(async () => {
      rerender(<MarkdownView {...base} filePath="/x/a.md" content={docA2} highlight={null} />);
    });
    expect(container.querySelector('.markdown-body')?.textContent).toBe('Alpha one text here.');
  });

  it('re-highlights the same text when only the file path changes', () => {
    const ref = createRef<MarkdownViewHandle>();
    const alpha: HighlightState = { query: 'alpha', currentIndex: 0, mode: 'multi-persistent' };
    const props = { colors, content: 'alpha beta alpha', highlight: alpha, onMatchesChanged: vi.fn() };
    const { container, rerender } = render(<MarkdownView ref={ref} {...props} filePath="/x/a.md" />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(2);
    rerender(<MarkdownView ref={ref} {...props} filePath="/x/b.md" />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(2);
    expect(ref.current?.getMatchCount()).toBe(2);
  });
});

describe('MarkdownView live reload', () => {
  const longCode = Array.from({ length: 250 }, (_, i) => `log(${i + 1});`).join('\n');
  const doc = (paragraph: string) => `# Notes\n\n${paragraph}\n\n\`\`\`js\n${longCode}\n\`\`\``;
  const props = { colors, filePath: '/x/a.md', onMatchesChanged: vi.fn() };

  it('patches the document in place while find has no marks in it', () => {
    const { container, rerender } = render(<MarkdownView {...props} content={doc('Before the edit.')} highlight={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 250 lines' }));
    const heading = container.querySelector('h1');
    rerender(<MarkdownView {...props} content={doc('After the edit.')} highlight={null} />);
    expect(container.querySelector('h1')).toBe(heading);
    expect(container.querySelector('p')?.textContent).toBe('After the edit.');
    // The expanded code block stays expanded.
    expect(screen.queryByRole('button', { name: 'Show all 250 lines' })).toBeNull();
  });

  it('mounts a new document while find has marks in it', () => {
    const highlight: HighlightState = { query: 'edit', currentIndex: 0, mode: 'multi-persistent' };
    const { container, rerender } = render(<MarkdownView {...props} content={doc('Before the edit.')} highlight={highlight} />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    const heading = container.querySelector('h1');
    rerender(<MarkdownView {...props} content={doc('After the edit.')} highlight={highlight} />);
    expect(container.querySelector('h1')).not.toBe(heading);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
  });

  it('leaves none of the newer version behind when a reload goes back to the first one with find applied', () => {
    const base = { colors, filePath: '/x/a.md', onMatchesChanged: vi.fn() };
    const v1 = 'Alpha **one** text here.';
    const v2 = 'Alpha **one** foo added.';
    const foo: HighlightState = { query: 'foo', currentIndex: 0, mode: 'multi-persistent' };
    const { container, rerender } = render(<MarkdownView {...base} content={v1} highlight={null} />);
    // The editor saves v2 with find closed, so it's patched in place.
    rerender(<MarkdownView {...base} content={v2} highlight={null} />);
    rerender(<MarkdownView {...base} content={v2} highlight={foo} />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    // Undo and save: v1 again, with find still applied.
    rerender(<MarkdownView {...base} content={v1} highlight={foo} />);
    expect(container.querySelector('.markdown-body')?.textContent).toBe('Alpha one text here.');
  });

  it('mounts a new document when only the design tokens change while find has marks in it', () => {
    const tokens = (fontSize: string): DesignTokens => ({ name: '', typography: { h1: { fontSize } } });
    const design = { ...props, filePath: '/x/DESIGN.md', content: '## Overview\n\nIntro text.\n' };
    const highlight: HighlightState = { query: '18px', currentIndex: 0, mode: 'multi-persistent' };
    const { container, rerender } = render(<MarkdownView {...design} designTokens={tokens('18px')} highlight={highlight} />);
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    const paragraph = container.querySelector('p');
    // A front-matter edit: the tokens change and the body doesn't.
    rerender(<MarkdownView {...design} designTokens={tokens('16px')} highlight={highlight} />);
    expect(container.querySelector('p')).not.toBe(paragraph);
    rerender(<MarkdownView {...design} designTokens={tokens('16px')} highlight={null} />);
    expect(container.querySelector('.design-token-value')?.textContent).toBe('16px');
  });
});

describe('MarkdownView find with non-ASCII text', () => {
  it('does not throw on a Turkish dotted İ', () => {
    expect(() =>
      render(
        <MarkdownView
          colors={colors}
          filePath="/x/a.md"
          content={"Toplantı İzmir'de yapılacak"}
          highlight={{ query: 'yapılacak', currentIndex: 0, mode: 'multi-persistent' }}
          onMatchesChanged={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});

describe('MarkdownView find with raw HTML at the top level', () => {
  // react-markdown renders raw HTML on its own line as a text node directly in
  // the article, between the newline nodes that separate blocks.
  const docA = 'Intro paragraph.\n\n<h1 align="center">Emdy</h1>\n\nAfter paragraph.';
  const emdy: HighlightState = { query: 'Emdy', currentIndex: 0, mode: 'multi-persistent' };

  function plainText(content: string) {
    const { container } = render(<MarkdownView colors={colors} content={content} />);
    return container.querySelector('.markdown-body')?.textContent;
  }

  it('survives a live reload after find, with nothing left behind', () => {
    const edited = 'Intro edited.\n\n<h1 align="center">Emdy</h1>\n\nAfter paragraph.';
    const props = { colors, filePath: '/x/a.md', onMatchesChanged: vi.fn() };
    const { container, rerender } = render(<MarkdownView {...props} content={docA} highlight={emdy} />);
    rerender(<MarkdownView {...props} content={docA} highlight={null} />);
    expect(() =>
      act(() => {
        rerender(<MarkdownView {...props} content={edited} highlight={null} />);
      })
    ).not.toThrow();
    const expected = plainText(edited);
    expect(expected).toContain('Intro edited.');
    expect(container.querySelector('.markdown-body')?.textContent).toBe(expected);
  });

  it('leaves none of it behind when switching files while find is applied', async () => {
    const docB = 'Open the settings **panel** to begin.\n\nAnother paragraph.';
    const props = { colors, onMatchesChanged: vi.fn() };
    const { container, rerender } = render(<MarkdownView {...props} filePath="/x/a.md" content={docA} highlight={emdy} />);
    await act(async () => {
      rerender(<MarkdownView {...props} filePath="/x/b.md" content={docB} highlight={{ ...emdy, dismissing: true }} />);
    });
    await act(async () => {
      rerender(<MarkdownView {...props} filePath="/x/b.md" content={docB} highlight={null} />);
    });
    const expected = plainText(docB);
    expect(expected).toContain('Open the settings panel to begin.');
    expect(container.querySelector('.markdown-body')?.textContent).toBe(expected);
  });
});

describe('MarkdownView theme switch after find', () => {
  it('keeps working after a match at the start of a text node', () => {
    // The period is its own text node after the link, so the match starts it.
    const props = { filePath: '/x/a.md', content: 'See [docs](https://example.com).', onMatchesChanged: vi.fn() };
    const { container, rerender } = render(
      <MarkdownView {...props} colors={colors} highlight={{ query: '.', currentIndex: 0, mode: 'multi-persistent' }} />
    );
    expect(container.querySelectorAll('mark[data-emdy-match]').length).toBe(1);
    rerender(<MarkdownView {...props} colors={colors} highlight={null} />);
    expect(() => rerender(<MarkdownView {...props} colors={cool.light} highlight={null} />)).not.toThrow();
    expect(container.querySelector('.markdown-body')?.textContent).toBe('See docs.');
  });
});

describe('MarkdownView focusMatchAtLine', () => {
  it('maps source lines to the block that starts there', () => {
    const doc = '# Setup\n\nInstall npm.\n\n## Usage\n\nRun npm start.\n';
    const ref = createRef<MarkdownViewHandle>();
    render(
      <MarkdownView ref={ref} colors={colors} filePath="/x/a.md" content={doc}
        highlight={{ query: 'npm', currentIndex: 0, mode: 'multi-persistent' }} onMatchesChanged={vi.fn()} />
    );
    expect([ref.current?.focusMatchAtLine(3), ref.current?.focusMatchAtLine(7)]).toEqual([0, 1]);
  });

  it('accounts for stripped front matter', () => {
    const doc = '---\ntitle: T\n---\n\nInstall npm.\n\nRun npm start.\n';
    const ref = createRef<MarkdownViewHandle>();
    render(
      <MarkdownView ref={ref} colors={colors} filePath="/x/a.md" content={doc}
        highlight={{ query: 'npm', currentIndex: 0, mode: 'multi-persistent' }} onMatchesChanged={vi.fn()} />
    );
    // Search reports file lines: "Install npm." is line 5 of the file and "Run npm start." line 7.
    expect(ref.current?.focusMatchAtLine(5)).toBe(0);
    expect(ref.current?.focusMatchAtLine(7)).toBe(1);
  });

  it('lands inside a fenced code block', () => {
    const doc = 'Use npm here.\n\n```bash\nnpm install\n```\n';
    const ref = createRef<MarkdownViewHandle>();
    render(
      <MarkdownView ref={ref} colors={colors} filePath="/x/a.md" content={doc}
        highlight={{ query: 'npm', currentIndex: 0, mode: 'multi-persistent' }} onMatchesChanged={vi.fn()} />
    );
    // "npm install" is line 4, in the fence that starts on line 3.
    expect(ref.current?.focusMatchAtLine(4)).toBe(1);
  });

  // A pick as the palette makes one: the document is on screen, then the
  // query arrives and a line is picked.
  function pick(content: string, query: string, lines: number[], designTokens?: DesignTokens) {
    const ref = createRef<MarkdownViewHandle>();
    const props = { colors, filePath: '/x/a.md', content, designTokens, onMatchesChanged: vi.fn() };
    const { rerender } = render(<MarkdownView ref={ref} {...props} highlight={null} />);
    rerender(<MarkdownView ref={ref} {...props} highlight={{ query, currentIndex: 0, mode: 'multi-persistent' }} />);
    return lines.map((line) => ref.current?.focusMatchAtLine(line));
  }

  it('lands on the picked line when a fence has matches on several lines', () => {
    expect(pick('Intro.\n\n```bash\nnpm install\nnpm run build\n```\n', 'npm', [4, 5])).toEqual([0, 1]);
  });

  it('lands on the picked line in a list', () => {
    expect(pick('- Install npm\n- Run npm start\n', 'npm', [1, 2])).toEqual([0, 1]);
  });

  it('lands on the picked line in a paragraph wrapped over two lines', () => {
    expect(pick('Install npm first,\nthen run npm start.\n', 'npm', [1, 2])).toEqual([0, 1]);
  });

  it('lands on the last match when none comes at or after the line', () => {
    // Line 5's "npm" is in the link's address, which isn't shown.
    expect(pick('Install npm.\n\nRun npm start.\n\nSee [docs](https://npmjs.com).\n', 'npm', [5])).toEqual([1]);
  });

  it('lands on the picked line in a list of links', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) => `- [npm](https://www.npmjs.com/package/${p}) ${p}`);
    expect(pick(`${items.join('\n')}\n\nAfter npm.\n`, 'npm', [1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('lands on the picked line in a table of contents', () => {
    const readme =
      '# Emdy\n\n- [Install](#install)\n- [Usage](#usage)\n- [Install from source](#install-from-source)\n\n## Install\n\nRun the installer.\n';
    expect(pick(readme, 'install', [3, 5, 7])).toEqual([0, 1, 2]);
  });

  it('lands on the picked line after a line with links', () => {
    const doc = 'See [npm](https://www.npmjs.com) and [the npm docs](https://docs.npmjs.com),\nthen run npm start.\n\nAfter npm.\n';
    expect(pick(doc, 'npm', [1, 2])).toEqual([0, 2]);
  });

  it('lands on the picked line in a fence whose language matches', () => {
    expect(pick('```js\nconst js = 1;\nlog(js);\n```\n', 'js', [2, 3])).toEqual([0, 1]);
  });

  it('lands on the picked line after a line with an image', () => {
    // The image's alt text isn't text on the page, so find doesn't mark it.
    const doc = '![npm logo](npm.png) Install npm first,\nthen run npm start.\n\nAfter npm.\n';
    expect(pick(doc, 'npm', [1, 2, 4])).toEqual([0, 1, 2]);
  });

  it("lands on the header for a line in a design file's front matter", () => {
    const content = '---\nname: Acme\ncolors:\n  primary: "#ff6600"\n---\n\nAcme uses orange.\n';
    // Line 2 is "name: Acme", which the header shows as its title.
    expect(pick(content, 'acme', [2], parseDesignMd(content)?.tokens)).toEqual([0]);
  });

  const npm: HighlightState = { query: 'npm', currentIndex: 0, mode: 'multi-persistent' };

  it('uses the new front matter length after a rerender', () => {
    const body = '\nInstall npm.\n\nRun npm start.\n';
    const ref = createRef<MarkdownViewHandle>();
    const props = { colors, filePath: '/x/a.md', highlight: npm, onMatchesChanged: vi.fn() };
    const { rerender } = render(<MarkdownView ref={ref} {...props} content={body} />);
    // The same body under front matter: "Install npm." is now line 5.
    rerender(<MarkdownView ref={ref} {...props} content={`---\ntitle: T\n---\n${body}`} />);
    expect(ref.current?.focusMatchAtLine(5)).toBe(0);
  });

  it('counts matches in the document on screen after it changes', () => {
    const ref = createRef<MarkdownViewHandle>();
    const props = { colors, filePath: '/x/a.md', highlight: npm, onMatchesChanged: vi.fn() };
    const { rerender } = render(<MarkdownView ref={ref} {...props} content={'Hello.\n\nWorld.\n'} />);
    rerender(<MarkdownView ref={ref} {...props} content={'```\nnpm install\nnpm run build\n```\n'} />);
    // "npm run build" is line 3, the fence's second match.
    expect(ref.current?.focusMatchAtLine(3)).toBe(1);
  });
});

describe('countShownMatches', () => {
  it('counts on the lines from `from` up to, not including, `to`', () => {
    const text = 'npm\nnpm npm\nnpm\n';
    expect([countShownMatches(text, 'npm', 1, 1), countShownMatches(text, 'npm', 1, 3), countShownMatches(text, 'npm', 2, 9)]).toEqual([0, 3, 3]);
  });

  it('matches as find does: in any case, with the query as plain text', () => {
    expect(countShownMatches('A.b a.B axb\n', 'a.b', 1, 2)).toBe(2);
  });

  it("leaves out images, link addresses and comments, which the page doesn't show", () => {
    expect(countShownMatches('![npm logo](npm.png) [npm](https://npmjs.com) <!-- npm --> npm\n', 'npm', 1, 2)).toBe(2);
    // A badge, an image inside a link, shows nothing.
    expect(countShownMatches('[![npm](https://img.shields.io/npm/v/emdy.svg)](https://www.npmjs.com/package/emdy)\n', 'npm', 1, 2)).toBe(0);
  });

  it('counts an autolink, whose address is its text', () => {
    expect(countShownMatches('<https://www.npmjs.com>\n', 'npm', 1, 2)).toBe(1);
  });

  it("leaves out a fence's opening line and counts its code as written", () => {
    expect(countShownMatches('```js\nconst link = "[js](js.md)";\n```\n', 'js', 1, 3)).toBe(2);
  });
});
