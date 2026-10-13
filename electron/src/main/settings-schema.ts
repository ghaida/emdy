// What settings.json may hold. Kept free of Electron imports so it can be
// unit-tested, and so a hand-edited or downgraded file can never put a value
// in front of the renderer that it would crash on.

export interface Settings {
  fontFamily: string;
  theme: string;
  colorTheme: string;
  zoom: number;
  contentWidth: string;
}

export const defaults: Settings = {
  fontFamily: 'sans',
  theme: 'system',
  colorTheme: 'warm',
  zoom: 1.0,
  contentWidth: 'default',
};

const VALID_FONT_FAMILIES = new Set(['sans', 'serif', 'mono']);
const VALID_THEMES = new Set(['light', 'dark', 'system']);
const VALID_COLOR_THEMES = new Set(['warm', 'cool', 'neutral', 'fresh', 'neon']);
const VALID_CONTENT_WIDTHS = new Set(['default', 'wide']);

export function validateSetting(key: string, value: unknown): boolean {
  switch (key) {
    case 'fontFamily': return typeof value === 'string' && VALID_FONT_FAMILIES.has(value);
    case 'theme': return typeof value === 'string' && VALID_THEMES.has(value);
    case 'colorTheme': return typeof value === 'string' && VALID_COLOR_THEMES.has(value);
    case 'zoom': return typeof value === 'number' && value >= 0.5 && value <= 3.0;
    case 'contentWidth': return typeof value === 'string' && VALID_CONTENT_WIDTHS.has(value);
    default: return false;
  }
}

/** The saved settings with every invalid or missing value replaced by its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const out: Settings = { ...defaults };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    if (validateSetting(key, record[key])) {
      (out as unknown as Record<string, unknown>)[key] = record[key];
    }
  }
  return out;
}
