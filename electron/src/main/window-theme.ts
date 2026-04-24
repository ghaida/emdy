import { nativeTheme } from 'electron';
import { getSettings } from './settings-store';

// Background colors per theme to avoid white flash on launch
const BG_COLORS: Record<string, { light: string; dark: string }> = {
  warm:    { light: '#F5F3EF', dark: '#1C1A16' },
  cool:    { light: '#F5F5F4', dark: '#1A1A19' },
  neutral: { light: '#F0F0F0', dark: '#1C1C1E' },
  fresh:   { light: '#FFFBF0', dark: '#0A1628' },
  neon:    { light: '#F4F2F8', dark: '#050510' },
};

export function getWindowBackgroundColor(): string {
  const settings = getSettings();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors);
  const palette = BG_COLORS[settings.colorTheme] || BG_COLORS.warm;
  return isDark ? palette.dark : palette.light;
}
