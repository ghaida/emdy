import { useState, useEffect, useCallback } from 'react';
import type { FontFamily, AppTheme, ColorThemeName, ContentWidth, DisplaySettings } from '../lib/types';
import { applyTheme, getResolvedColors } from '../lib/theme-provider';
import type { ColorScale } from '../lib/color-themes';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>({
    fontFamily: 'sans',
    theme: 'system',
    colorTheme: 'warm',
    zoom: 1.0,
    contentWidth: 'medium',
  });
  const [resolvedAppearance, setResolvedAppearance] = useState<'light' | 'dark'>('light');
  const [resolvedColors, setResolvedColors] = useState<ColorScale>(
    getResolvedColors('warm', 'light')
  );
  const [systemAccentColor, setSystemAccentColor] = useState<string | undefined>();

  // Load saved settings and system accent color on mount
  useEffect(() => {
    window.electronAPI.getSettings().then((saved) => {
      setSettings({
        fontFamily: saved.fontFamily || 'sans',
        theme: saved.theme || 'system',
        colorTheme: saved.colorTheme || 'warm',
        zoom: saved.zoom || 1.0,
        contentWidth: saved.contentWidth || 'medium',
      });
    });
    window.electronAPI.getAccentColor().then(setSystemAccentColor);
    return window.electronAPI.onAccentColorChanged(setSystemAccentColor);
  }, []);

  // Resolve appearance and apply theme
  useEffect(() => {
    const resolve = () => {
      let dark: boolean;
      if (settings.theme === 'system') {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        dark = settings.theme === 'dark';
      }
      const appearance = dark ? 'dark' : 'light';
      setResolvedAppearance(appearance);
      setResolvedColors(getResolvedColors(settings.colorTheme, appearance, systemAccentColor));
      applyTheme(settings.colorTheme, appearance, systemAccentColor);
    };

    resolve();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', resolve);
    return () => mq.removeEventListener('change', resolve);
  }, [settings.theme, settings.colorTheme, systemAccentColor]);

  const setFontFamily = useCallback((fontFamily: FontFamily) => {
    setSettings((s) => ({ ...s, fontFamily }));
    window.electronAPI.setSetting('fontFamily', fontFamily);
  }, []);

  const setTheme = useCallback((theme: AppTheme) => {
    setSettings((s) => ({ ...s, theme }));
    window.electronAPI.setSetting('theme', theme);
  }, []);

  const setColorTheme = useCallback((colorTheme: ColorThemeName) => {
    setSettings((s) => ({ ...s, colorTheme }));
    window.electronAPI.setSetting('colorTheme', colorTheme);
  }, []);

  const setContentWidth = useCallback((contentWidth: ContentWidth) => {
    setSettings((s) => ({ ...s, contentWidth }));
    window.electronAPI.setSetting('contentWidth', contentWidth);
  }, []);

  const zoomIn = useCallback(() => {
    setSettings((s) => {
      const zoom = Math.min(s.zoom + ZOOM_STEP, ZOOM_MAX);
      window.electronAPI.setSetting('zoom', Math.round(zoom * 100) / 100);
      return { ...s, zoom };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setSettings((s) => {
      const zoom = Math.max(s.zoom - ZOOM_STEP, ZOOM_MIN);
      window.electronAPI.setSetting('zoom', Math.round(zoom * 100) / 100);
      return { ...s, zoom };
    });
  }, []);

  const resetZoom = useCallback(() => {
    setSettings((s) => {
      window.electronAPI.setSetting('zoom', 1.0);
      return { ...s, zoom: 1.0 };
    });
  }, []);

  return {
    ...settings,
    resolvedAppearance,
    resolvedColors,
    systemAccentColor,
    setFontFamily,
    setTheme,
    setColorTheme,
    setContentWidth,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
