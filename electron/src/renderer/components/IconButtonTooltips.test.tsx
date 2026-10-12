import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { AboutDialog } from './AboutDialog';
import { UpdateDialog } from './UpdateDialog';
import { ToastNotification } from './ToastNotification';
import { SupportBanner } from './SupportBanner';
import { FindBar } from './FindBar';
import { MarkdownView } from './MarkdownView';
import { AnnounceProvider } from '../hooks/useAnnounce';
import { warm } from '../lib/color-themes';

vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn(async () => ({ svg: '<svg viewBox="0 0 10 10"></svg>' })) },
}));

beforeEach(() => {
  // Subscriptions return an unsubscribe function; every other call resolves empty.
  (window as unknown as { electronAPI: unknown }).electronAPI = new Proxy(
    {},
    { get: (_, name) => (String(name).startsWith('on') ? () => () => undefined : async () => '') }
  );
});

/** Icon-only buttons in the document, as [tooltip, placement] pairs. Fails on any native title. */
function iconButtonTooltips() {
  const buttons = Array.from(document.body.querySelectorAll('button')).filter((b) => !b.textContent?.trim());
  for (const button of buttons) expect(button.hasAttribute('title')).toBe(false);
  return buttons.map((b) => [b.getAttribute('data-tooltip'), b.getAttribute('data-tooltip-placement')]);
}

describe('icon buttons use the toolbar tooltip', () => {
  it('code block copy, beside the button so the scroll area cannot clip it', () => {
    render(<MarkdownView content={'```js\nconst a = 1;\n```'} colors={warm.light} />);
    expect(iconButtonTooltips()).toEqual([['Copy code', 'left']]);
  });

  it('diagram copy buttons, the edge one aligned to its end', () => {
    render(<MarkdownView content={'```mermaid\ngraph TD\n  A-->B\n```'} colors={warm.light} />);
    expect(iconButtonTooltips()).toEqual([
      ['Copy code', null],
      ['Copy as PNG', 'end'],
    ]);
  });

  it('find bar', () => {
    render(
      <AnnounceProvider>
        <FindBar
          visible
          query="foo"
          currentIndex={0}
          totalMatches={2}
          isCapped={false}
          mode="multi-persistent"
          onQueryChange={vi.fn()}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />
      </AnnounceProvider>
    );
    expect(iconButtonTooltips()).toEqual([
      ['Previous match  ⇧⌘G', null],
      ['Next match  ⌘G', null],
      ['Close  Esc', 'end'],
    ]);
  });

  it('settings close', () => {
    render(
      <SettingsModal
        visible
        onClose={vi.fn()}
        theme="system"
        colorTheme="warm"
        onThemeChange={vi.fn()}
        onColorThemeChange={vi.fn()}
      />
    );
    expect(iconButtonTooltips()).toEqual([['Close', 'end']]);
  });

  it('about close', async () => {
    await act(async () => {
      render(<AboutDialog visible onClose={vi.fn()} />);
    });
    expect(iconButtonTooltips()).toEqual([['Close', 'end']]);
  });

  it('update dialog close', async () => {
    await act(async () => {
      render(<UpdateDialog visible onClose={vi.fn()} />);
    });
    expect(iconButtonTooltips()).toEqual([['Close', 'end']]);
  });

  it('toast close', () => {
    render(<ToastNotification toasts={[{ id: 1, message: 'Copied', type: 'info' }]} onDismiss={vi.fn()} />);
    expect(iconButtonTooltips()).toEqual([['Close', null]]);
  });

  it('support banner dismiss', () => {
    vi.useFakeTimers();
    try {
      const nudgeState = {
        filesOpened: 10,
        appLaunches: 3,
        firstLaunchDate: '2020-01-01T00:00:00.000Z',
        dismissedUntil: null,
        dismissCount: 0,
        contributed: false,
      };
      render(<SupportBanner nudgeState={nudgeState} />);
      act(() => vi.advanceTimersByTime(1000));
      expect(iconButtonTooltips()).toEqual([['Dismiss for 30 days', 'end']]);
    } finally {
      vi.useRealTimers();
    }
  });
});
