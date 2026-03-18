import React from 'react';
import type { AppTheme, ColorThemeName } from '../lib/types';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  colorTheme: ColorThemeName;
  onThemeChange: (theme: AppTheme) => void;
  onColorThemeChange: (colorTheme: ColorThemeName) => void;
}

const appearances: { value: AppTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const colorThemes: { value: ColorThemeName; label: string; swatch: string }[] = [
  { value: 'warm', label: 'Warm', swatch: '#D47418' },
  { value: 'cool', label: 'Cool', swatch: '#4A7196' },
];

export function SettingsModal({
  visible,
  onClose,
  theme,
  colorTheme,
  onThemeChange,
  onColorThemeChange,
}: SettingsModalProps) {
  if (!visible) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Color Scheme</label>
          <div className="settings-options">
            {colorThemes.map((ct) => (
              <button
                key={ct.value}
                className={`settings-option${colorTheme === ct.value ? ' active' : ''}`}
                onClick={() => onColorThemeChange(ct.value)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="5" fill={ct.swatch} />
                </svg>
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label className="settings-label">Appearance</label>
          <div className="settings-options">
            {appearances.map((a) => (
              <button
                key={a.value}
                className={`settings-option${theme === a.value ? ' active' : ''}`}
                onClick={() => onThemeChange(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
