import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindBar } from './FindBar';
import { AnnounceProvider } from '../hooks/useAnnounce';

function renderBar(overrides: Partial<Parameters<typeof FindBar>[0]> = {}) {
  const props = {
    visible: true,
    query: 'foo',
    currentIndex: 0,
    totalMatches: 12,
    isCapped: false,
    mode: 'multi-persistent' as const,
    onQueryChange: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <AnnounceProvider>
      <FindBar {...props} />
    </AnnounceProvider>
  );
  return { ...utils, props };
}

describe('FindBar', () => {
  it('does not render when visible is false', () => {
    renderBar({ visible: false });
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('renders with role="search" and aria-label', async () => {
    renderBar();
    const bar = await screen.findByRole('search');
    expect(bar).toHaveAttribute('aria-label', 'Find in document');
  });

  it('shows "{current} of {total}" counter for multi-persistent', async () => {
    renderBar({ currentIndex: 2, totalMatches: 12 });
    await screen.findByRole('search');
    expect(screen.getByText('3 of 12')).toBeTruthy();
  });

  it('shows "No matches" for zero mode', async () => {
    renderBar({ mode: 'zero', totalMatches: 0, currentIndex: 0 });
    const bar = await screen.findByRole('search');
    expect(within(bar).getByText('No matches')).toBeTruthy();
  });

  it('shows "{current} of 1,000+" with tooltip for over-cap', async () => {
    renderBar({ mode: 'over-cap', isCapped: true, totalMatches: 1000, currentIndex: 4 });
    await screen.findByRole('search');
    const counter = screen.getByText('5 of 1,000+');
    expect(counter).toHaveAttribute(
      'title',
      'Showing first 1,000 matches. Refine your search to see more.'
    );
  });

  it('disables cycling when totalMatches <= 1', async () => {
    renderBar({ totalMatches: 1, currentIndex: 0 });
    await screen.findByRole('search');
    expect(screen.getByLabelText('Previous match')).toBeDisabled();
    expect(screen.getByLabelText('Next match')).toBeDisabled();
    expect(screen.getByLabelText('Close find bar')).toBeEnabled();
  });

  it('disables cycling in zero mode', async () => {
    renderBar({ mode: 'zero', totalMatches: 0 });
    await screen.findByRole('search');
    expect(screen.getByLabelText('Previous match')).toBeDisabled();
    expect(screen.getByLabelText('Next match')).toBeDisabled();
  });

  it('calls onNext on Enter in input', async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    await screen.findByRole('search');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    await user.type(input, '{Enter}');
    expect(props.onNext).toHaveBeenCalled();
    expect(props.onPrev).not.toHaveBeenCalled();
  });

  it('calls onPrev on Shift+Enter in input', async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    await screen.findByRole('search');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    await user.type(input, '{Shift>}{Enter}{/Shift}');
    expect(props.onPrev).toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    await screen.findByRole('search');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    await user.type(input, '{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('fires onQueryChange on input', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const { props } = renderBar({ query: '', onQueryChange });
    await screen.findByRole('search');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    await user.type(input, 'hi');
    expect(props.onQueryChange).toHaveBeenCalled();
    expect(onQueryChange.mock.calls.at(-1)?.[0]).toBe('hi');
  });

  it('counter has aria-live and aria-describedby wiring', async () => {
    renderBar();
    await screen.findByRole('search');
    const counter = screen.getByText('1 of 12');
    expect(counter).toHaveAttribute('id', 'find-bar-counter');
    expect(counter).toHaveAttribute('aria-live', 'polite');
    expect(counter).toHaveAttribute('aria-atomic', 'true');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    expect(input).toHaveAttribute('aria-describedby', 'find-bar-counter');
  });

  it('does not call onNext when cycling disabled', async () => {
    const user = userEvent.setup();
    const { props } = renderBar({ totalMatches: 1 });
    await screen.findByRole('search');
    const input = screen.getByLabelText('Find in document', { selector: 'input' });
    await user.type(input, '{Enter}');
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it('adds pulse class when pulseNonce changes', async () => {
    const { rerender } = render(
      <AnnounceProvider>
        <FindBar
          visible
          query="foo"
          currentIndex={0}
          totalMatches={12}
          isCapped={false}
          mode="multi-persistent"
          pulseNonce={0}
          onQueryChange={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />
      </AnnounceProvider>
    );
    await screen.findByRole('search');
    const counter = screen.getByText('1 of 12');
    expect(counter.className).not.toMatch(/\bpulse\b/);

    rerender(
      <AnnounceProvider>
        <FindBar
          visible
          query="foo"
          currentIndex={0}
          totalMatches={12}
          isCapped={false}
          mode="multi-persistent"
          pulseNonce={1}
          onQueryChange={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />
      </AnnounceProvider>
    );
    await waitFor(() => {
      expect(screen.getByText('1 of 12').className).toMatch(/\bpulse\b/);
    });
  });
});
