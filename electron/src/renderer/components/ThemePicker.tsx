import React from 'react';
import type { AppTheme, ColorThemeName } from '../lib/types';
import { iconSize } from '../lib/design-tokens';

interface ThemePickerProps {
  theme: AppTheme;
  colorTheme: ColorThemeName;
  onThemeChange: (theme: AppTheme) => void;
  onColorThemeChange: (colorTheme: ColorThemeName) => void;
}

const sz = iconSize.md;

export function ThemePicker({ theme, colorTheme, onThemeChange, onColorThemeChange }: ThemePickerProps) {
  return (
    <div className="theme-picker">
      {/* Color theme toggle */}
      <button
        className={`toolbar-btn${colorTheme === 'warm' ? ' active' : ''}`}
        onClick={() => onColorThemeChange('warm')}
        title="Warm theme"
      >
        <svg width={sz} height={sz} viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5" fill="#D47418" />
        </svg>
      </button>
      <button
        className={`toolbar-btn${colorTheme === 'cool' ? ' active' : ''}`}
        onClick={() => onColorThemeChange('cool')}
        title="Cool theme"
      >
        <svg width={sz} height={sz} viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5" fill="#4A7196" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* Appearance */}
      <button
        className={`toolbar-btn${theme === 'light' ? ' active' : ''}`}
        onClick={() => onThemeChange('light')}
        title="Light"
      >
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>
      <button
        className={`toolbar-btn${theme === 'dark' ? ' active' : ''}`}
        onClick={() => onThemeChange('dark')}
        title="Dark"
      >
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 2a6 6 0 108 8c-3.31 0-6-2.69-6-6a5.97 5.97 0 012-2z" />
        </svg>
      </button>
      <button
        className={`toolbar-btn${theme === 'system' ? ' active' : ''}`}
        onClick={() => onThemeChange('system')}
        title="System"
      >
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="12" height="9" rx="1" />
          <path d="M5 14h6" />
        </svg>
      </button>
    </div>
  );
}
