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
