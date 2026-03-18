// Design tokens — single source of truth for all non-color values
// Strict 4px grid for all spacing and sizing.
// Only exceptions: 1px (borders) and 2px (fine detail).

export const spacing = {
  '0': '0px',
  'px': '1px',
  'half': '2px',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '13': '52px',
  '16': '64px',
  '20': '80px',
  '25': '100px',
} as const;

// Font sizes — prefixed with 'fs-' to avoid collision with color --text-* tokens
export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '16px',
  body: '16px',
  xl: '32px',
} as const;

export const iconSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
} as const;

// Radii — 4px grid
export const radii = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '50%',
} as const;

export const layout = {
  titlebarHeight: '52px',
  titlebarHeightCompact: '40px',
  statusBarHeight: '24px',
  sidebarWidth: '240px',
  sidebarMinWidth: '200px',
  sidebarMaxWidth: '320px',
  contentMaxWidth: '680px',
  minimapWidth: '140px',
  toolbarBtnSize: '28px',
  scrollbarWidth: '8px',
  scrollbarWidthNarrow: '4px',
  commandPaletteWidth: '520px',
  commandPaletteMaxHeight: '420px',
  settingsWidth: '360px',
  dropdownMinWidth: '120px',
  toastBottom: '36px',
} as const;

export const fontFamily = {
  sans: "'IBM Plex Sans', -apple-system, sans-serif",
  serif: "'IBM Plex Serif', Georgia, serif",
  mono: "'IBM Plex Mono', 'SF Mono', monospace",
} as const;

export const transition = {
  fast: '0.1s',
  normal: '0.15s',
  slow: '0.2s',
} as const;

export const shadow = {
  dropdown: '0 8px 24px rgba(0, 0, 0, 0.15)',
  modal: '0 16px 48px rgba(0, 0, 0, 0.2)',
} as const;

export const overlay = {
  dim: 'rgba(0, 0, 0, 0.3)',
} as const;
