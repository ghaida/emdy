import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, act, screen, fireEvent } from '@testing-library/react';
import { MarkdownView, type MarkdownViewHandle, type HighlightState } from './MarkdownView';
import { warm } from '../lib/color-themes';
import { parseDesignMd } from '../lib/design-md';
import { FULL_CODE_ATTR } from '../lib/code-export';

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
    return renderView({ content: parsed.body, designTokens: parsed.tokens });
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
