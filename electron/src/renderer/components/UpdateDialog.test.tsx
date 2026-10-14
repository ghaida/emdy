import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdateDialog } from './UpdateDialog';
import type { ElectronAPI } from '../lib/types';

const NOT_READY = /The update isn't ready to install yet\. Check for Updates again\./;
const ready = { version: '1.9.0', notes: null };

// installUpdate resolves to whether main had a downloaded update to install.
function mockUpdater(installs: boolean) {
  const installUpdate = vi.fn(async () => installs);
  const api: Partial<ElectronAPI> = {
    getAppVersion: vi.fn(async () => '1.8.1'),
    getSkippedVersion: vi.fn(async () => null),
    installUpdate,
  };
  window.electronAPI = api as ElectronAPI;
  return { installUpdate };
}

describe('Restart to Update', () => {
  it("says so when there's nothing to install, until the dialog opens again", async () => {
    const { installUpdate } = mockUpdater(false);
    const user = userEvent.setup();
    const { rerender } = render(<UpdateDialog visible onClose={vi.fn()} readyVersion={ready} />);
    await screen.findByText(/Emdy 1\.9\.0 is ready to install/);
    expect(screen.queryByText(NOT_READY)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restart to Update' }));
    expect(installUpdate).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(NOT_READY)).toHaveClass('update-message');
    rerender(<UpdateDialog visible={false} onClose={vi.fn()} readyVersion={ready} />);
    await act(async () => {
      rerender(<UpdateDialog visible onClose={vi.fn()} readyVersion={ready} />);
    });
    expect(screen.queryByText(NOT_READY)).not.toBeInTheDocument();
  });

  it('says nothing when the install starts', async () => {
    const { installUpdate } = mockUpdater(true);
    const user = userEvent.setup();
    render(<UpdateDialog visible onClose={vi.fn()} readyVersion={ready} />);
    await screen.findByText(/Emdy 1\.9\.0 is ready to install/);
    await user.click(screen.getByRole('button', { name: 'Restart to Update' }));
    expect(installUpdate).toHaveBeenCalledTimes(1);
    await act(async () => undefined);
    expect(screen.queryByText(NOT_READY)).not.toBeInTheDocument();
  });
});

describe('Opening and closing', () => {
  it('focuses Close even when an update is ready, and closes on Escape', async () => {
    mockUpdater(true);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UpdateDialog visible onClose={onClose} readyVersion={ready} />);
    await screen.findByText(/Emdy 1\.9\.0 is ready to install/);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("doesn't restart for a key typed as it pops up", async () => {
    // It opens unasked when a download finishes, perhaps while someone types.
    const { installUpdate } = mockUpdater(true);
    const user = userEvent.setup();
    render(<UpdateDialog visible onClose={vi.fn()} readyVersion={ready} />);
    await screen.findByText(/Emdy 1\.9\.0 is ready to install/);
    await user.keyboard(' ');
    expect(installUpdate).not.toHaveBeenCalled();
  });

  it('focuses Close while it checks', async () => {
    const api: Partial<ElectronAPI> = {
      getAppVersion: vi.fn(async () => '1.8.1'),
      getSkippedVersion: vi.fn(async () => null),
      // The check never answers.
      checkForUpdate: vi.fn(() => new Promise<never>(() => undefined)),
    };
    window.electronAPI = api as ElectronAPI;
    render(<UpdateDialog visible onClose={vi.fn()} />);
    await screen.findByText('Checking for updates…');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });
});
