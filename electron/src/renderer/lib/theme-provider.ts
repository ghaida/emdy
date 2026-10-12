import { spacing, fontSize, radii, layout, fontFamily, transition, shadowLight, shadowDark, overlay } from './design-tokens';
import { themes, type ColorThemeName, type ColorScale } from './color-themes';

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function applyTheme(colorTheme: ColorThemeName, appearance: 'light' | 'dark', systemAccentColor?: string): void {
  const colors: ColorScale = { ...themes[colorTheme][appearance] };

  // Neutral theme inherits accent from system settings
  if (colorTheme === 'neutral' && systemAccentColor) {
    colors.accent = systemAccentColor;
    colors.accentHover = appearance === 'light'
      ? adjustBrightness(systemAccentColor, -30)
      : adjustBrightness(systemAccentColor, 30);
  }

  const root = document.documentElement;

  // Colors
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${camelToKebab(key)}`, value);
  }

  // Spacing
  for (const [key, value] of Object.entries(spacing)) {
    root.style.setProperty(`--space-${key}`, value);
  }

  // Font sizes
  for (const [key, value] of Object.entries(fontSize)) {
    root.style.setProperty(`--fs-${key}`, value);
  }

  // Radii
  for (const [key, value] of Object.entries(radii)) {
    root.style.setProperty(`--radius-${key}`, value);
  }

  // Layout
  for (const [key, value] of Object.entries(layout)) {
    root.style.setProperty(`--${camelToKebab(key)}`, value);
  }

  // Transitions
  for (const [key, value] of Object.entries(transition)) {
    root.style.setProperty(`--transition-${camelToKebab(key)}`, value);
  }

  // Shadows — appearance-aware (layered, with dark mode ring)
  const shadows = appearance === 'dark' ? shadowDark : shadowLight;
  for (const [key, value] of Object.entries(shadows)) {
    root.style.setProperty(`--shadow-${key}`, value);
  }

  // Overlay
  root.style.setProperty('--overlay-dim', overlay.dim);

  // Font families
  root.style.setProperty('--font-sans', fontFamily.sans);
  root.style.setProperty('--font-serif', fontFamily.serif);
  root.style.setProperty('--font-mono', fontFamily.mono);

  // Dark class
  root.classList.toggle('dark', appearance === 'dark');
}

export function getResolvedColors(colorTheme: ColorThemeName, appearance: 'light' | 'dark', systemAccentColor?: string): ColorScale {
  const colors = { ...themes[colorTheme][appearance] };
  if (colorTheme === 'neutral' && systemAccentColor) {
    colors.accent = systemAccentColor;
    colors.accentHover = appearance === 'light'
      ? adjustBrightness(systemAccentColor, -30)
      : adjustBrightness(systemAccentColor, 30);
  }
  return colors;
}
