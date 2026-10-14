import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AboutDialog } from './AboutDialog';
import type { ElectronAPI } from '../lib/types';

type StatusListener = (status: string) => void;
type UpdateStatus = Awaited<ReturnType<ElectronAPI['getUpdateStatus']>>;
type Answer = UpdateStatus | Promise<UpdateStatus>;

// Main's answers to About's status question: `first` when About opens, `after`
// when it asks again after the next update:status. By default a check is in
// flight at first, and then it has found nothing newer.
function mockUpdater({
  first = { status: 'checking' },
  after = { status: 'idle', upToDate: true },
}: { first?: Answer; after?: Answer } = {}) {
  const updater = {
    statusChanged: null as StatusListener | null,
    removeStatus: vi.fn(),
  };
  const api: Partial<ElectronAPI> = {
    getAppVersion: vi.fn(async () => '1.8.1'),
    getUpdateStatus: vi
      .fn<ElectronAPI['getUpdateStatus']>()
      .mockImplementationOnce(() => Promise.resolve(first))
      .mockImplementationOnce(() => Promise.resolve(after)),
    onUpdateStatus: vi.fn((callback: StatusListener) => {
      updater.statusChanged = callback;
      return updater.removeStatus;
    }),
  };
  window.electronAPI = api as ElectronAPI;
  return updater;
}

describe('About', () => {
  it('replaces "Checking…" with "Up to date" when the check finishes while it is open', async () => {
    const updater = mockUpdater();
    render(<AboutDialog visible onClose={vi.fn()} />);
    expect(await screen.findByText(/Checking…/)).toBeInTheDocument();
    act(() => updater.statusChanged?.('not-available'));
    expect(await screen.findByText(/Up to date/)).toBeInTheDocument();
    expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
  });

  it("doesn't say Checking… while it waits for main, when no check is running", async () => {
    let answer: (status: UpdateStatus) => void = () => undefined;
    mockUpdater({ first: new Promise<UpdateStatus>((resolve) => (answer = resolve)) });
    render(<AboutDialog visible onClose={vi.fn()} />);
    // About is open and main hasn't answered yet.
    expect(screen.getByText(/Version/)).toBeInTheDocument();
    expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
    await act(async () => answer({ status: 'idle', upToDate: true }));
    expect(screen.getByText(/Up to date/)).toBeInTheDocument();
    expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
  });

  it('shows an update that finishes downloading while it is open', async () => {
    const updater = mockUpdater({ after: { status: 'downloaded', version: '1.9.0', notes: null } });
    render(<AboutDialog visible onClose={vi.fn()} />);
    expect(await screen.findByText(/Checking…/)).toBeInTheDocument();
    act(() => updater.statusChanged?.('downloaded'));
    expect(await screen.findByText('1.9.0 ready — restart to install')).toBeInTheDocument();
    expect(screen.queryByText(/Checking…/)).not.toBeInTheDocument();
  });

  it('stops listening for update status when it closes', async () => {
    const updater = mockUpdater();
    const { rerender } = render(<AboutDialog visible onClose={vi.fn()} />);
    await screen.findByText(/Checking…/);
    rerender(<AboutDialog visible={false} onClose={vi.fn()} />);
    expect(updater.removeStatus).toHaveBeenCalledTimes(1);
  });

  it('focuses its first button when it opens, and closes on Escape', async () => {
    mockUpdater();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AboutDialog visible onClose={onClose} />);
    await screen.findByText(/Checking…/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
