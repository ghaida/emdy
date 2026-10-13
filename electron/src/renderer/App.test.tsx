import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen, within, fireEvent } from '@testing-library/react';
import { App } from './App';
import type { ElectronAPI } from './lib/types';

// What main sends a window, the call that tells main the page is listening,
// and the update checks.
const api = {
  onMenuEvent: vi.fn<ElectronAPI['onMenuEvent']>(() => () => undefined),
  onFileOpen: vi.fn(() => () => undefined),
  onDirOpen: vi.fn(() => () => undefined),
  onDropRejected: vi.fn(() => () => undefined),
  onWindowRestore: vi.fn(() => () => undefined),
  reportReady: vi.fn(),
  getUpdateStatus: vi.fn<ElectronAPI['getUpdateStatus']>(async () => ({ status: 'idle' })),
  checkForUpdate: vi.fn<ElectronAPI['checkForUpdate']>(async () => ({ status: 'checking' })),
  installUpdate: vi.fn<ElectronAPI['installUpdate']>(async () => false),
};

// A menu pick, sent to the listener App registered last.
async function chooseFromMenu(event: string) {
  await act(async () => api.onMenuEvent.mock.calls.at(-1)?.[0](event));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // Any other subscription returns an unsubscribe function; every other call resolves empty.
  (window as unknown as { electronAPI: unknown }).electronAPI = new Proxy(api, {
    get: (target, name) =>
      name in target
        ? target[name as keyof typeof api]
        : String(name).startsWith('on') ? () => () => undefined : async () => '',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it("tells main it's listening only once it has subscribed to what main sends", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(api.reportReady).toHaveBeenCalled();
    const ready = api.reportReady.mock.invocationCallOrder[0];
    for (const subscribe of [api.onMenuEvent, api.onFileOpen, api.onDirOpen, api.onDropRejected, api.onWindowRestore]) {
      expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(ready);
    }
  });

  it('asks main again when Check for Updates follows an update it already showed', async () => {
    // An update had downloaded when the window opened, so its dialog came up
    // without asking main. Main may have lost it since, say to a failed install.
    api.getUpdateStatus.mockResolvedValueOnce({ status: 'downloaded', version: '1.9.0', notes: null });
    await act(async () => {
      render(<App />);
    });
    const dialog = await screen.findByRole('dialog', { name: 'Software Update' });
    expect(within(dialog).getByText(/Emdy 1\.9\.0 is ready to install/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart to Update' })).not.toBeInTheDocument();
  });

  it('checks again when Check for Updates is chosen while the dialog shows a failed check', async () => {
    await act(async () => {
      render(<App />);
    });
    api.checkForUpdate.mockResolvedValueOnce({ status: 'error', error: 'offline' });
    await chooseFromMenu('check-for-updates');
    expect(screen.getByText(/Could not check for updates/)).toBeInTheDocument();
    // Back online, the user asks again without closing the dialog.
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
  });

  it("checks again when Check for Updates is chosen while the dialog says the update isn't ready", async () => {
    await act(async () => {
      render(<App />);
    });
    api.checkForUpdate.mockResolvedValueOnce({ status: 'downloaded', version: '1.9.0', notes: null });
    await chooseFromMenu('check-for-updates');
    // Main has lost the download since, so Restart to Update finds nothing to install.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Restart to Update' }));
    });
    expect(screen.getByText(/The update isn't ready to install yet/)).toBeInTheDocument();
    // The user does what the message says, with the dialog still open.
    await chooseFromMenu('check-for-updates');
    expect(api.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Checking for updates…')).toBeInTheDocument();
    expect(screen.queryByText(/The update isn't ready to install yet/)).not.toBeInTheDocument();
  });
});
