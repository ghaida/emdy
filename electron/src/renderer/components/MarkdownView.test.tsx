import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MarkdownView, type MarkdownViewHandle, type HighlightState } from './MarkdownView';
import { warm } from '../lib/color-themes';

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
