import { spacing, fontSize, radii, layout, fontFamily, transition, shadowLight, shadowDark, overlay } from './design-tokens';
import { themes, type ColorThemeName, type ColorScale } from './color-themes';

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export function applyTheme(colorTheme: ColorThemeName, appearance: 'light' | 'dark'): void {
  const colors: ColorScale = themes[colorTheme][appearance];
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
    root.style.setProperty(`--transition-${key}`, value);
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

export function getResolvedColors(colorTheme: ColorThemeName, appearance: 'light' | 'dark'): ColorScale {
  return themes[colorTheme][appearance];
}
