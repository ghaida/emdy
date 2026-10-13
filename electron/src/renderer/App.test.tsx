import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { App } from './App';

// What main sends a window, and the call that tells main the page is listening.
const api = {
  onMenuEvent: vi.fn(() => () => undefined),
  onFileOpen: vi.fn(() => () => undefined),
  onDirOpen: vi.fn(() => () => undefined),
  onDropRejected: vi.fn(() => () => undefined),
  onWindowRestore: vi.fn(() => () => undefined),
  reportReady: vi.fn(),
};

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
});
