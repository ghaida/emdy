import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DisplaySettings, ElectronAPI } from '../lib/types';
import { applyTheme } from '../lib/theme-provider';
import { useDisplaySettings } from './useDisplaySettings';

// The real applyTheme, counted.
vi.mock('../lib/theme-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/theme-provider')>();
  return { ...actual, applyTheme: vi.fn(actual.applyTheme) };
});

const saved: DisplaySettings = { fontFamily: 'sans', theme: 'light', colorTheme: 'warm', zoom: 1, contentWidth: 'default' };
const unsubscribe = vi.fn();

// What the hook asks main for, and what it listens to.
const api = {
  getSettingsSync: vi.fn<ElectronAPI['getSettingsSync']>(() => ({ ...saved })),
  getSettings: vi.fn<ElectronAPI['getSettings']>(async () => ({ ...saved })),
  setSetting: vi.fn<ElectronAPI['setSetting']>(async () => undefined),
  getAccentColor: vi.fn<ElectronAPI['getAccentColor']>(async () => '#007AFF'),
  onAccentColorChanged: vi.fn<ElectronAPI['onAccentColorChanged']>(() => () => undefined),
  onSettingChanged: vi.fn<ElectronAPI['onSettingChanged']>(() => unsubscribe),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Mounts the hook and lets main's first answers (the saved settings, the
// system accent) arrive, so only what a test does next is counted.
async function renderSettings() {
  const rendered = renderHook(() => useDisplaySettings());
  await act(async () => undefined);
  vi.mocked(applyTheme).mockClear();
  return rendered;
}

// Main passing on a change made in another window, to the listener the hook registered.
function changeElsewhere(key: string, value: unknown) {
  const listener = api.onSettingChanged.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error('useDisplaySettings is not listening for settings:changed');
  act(() => listener(key, value));
}

describe('useDisplaySettings', () => {
  it('applies a change made in another window once, without saving it again', async () => {
    const { result } = await renderSettings();
    changeElsewhere('theme', 'dark');
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedAppearance).toBe('dark');
    expect(applyTheme).toHaveBeenCalledTimes(1);
    expect(applyTheme).toHaveBeenCalledWith('warm', 'dark', '#007AFF');
    changeElsewhere('zoom', 1.5);
    expect(result.current.zoom).toBe(1.5);
    expect(api.setSetting).not.toHaveBeenCalled();
  });

  it('stops listening when it unmounts', async () => {
    const { unmount } = await renderSettings();
    expect(api.onSettingChanged).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
