import React, { useRef, useEffect } from 'react';
import type { AppTheme, ColorThemeName } from '../lib/types';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

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
  { value: 'neutral', label: 'Neutral', swatch: '#007AFF' },
  { value: 'fresh', label: 'Fresh', swatch: '#FF6B00' },
  { value: 'neon', label: 'Neon', swatch: '#FF2BD2' },
];

export function SettingsModal({
  visible,
  onClose,
  theme,
  colorTheme,
  onThemeChange,
  onColorThemeChange,
}: SettingsModalProps) {
  const { mounted, active } = useTransition(visible);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, visible);

  useEffect(() => {
    if (visible && modalRef.current) {
      const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [href], input');
      firstFocusable?.focus();
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <div className={`settings-overlay${active ? ' active' : ''}`} onClick={onClose}>
      <div ref={modalRef} className={`settings-modal${active ? ' active' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div className="settings-header">
          <span id="settings-modal-title" className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Color Scheme</label>
          <div className="settings-options" role="radiogroup" aria-label="Color scheme">
            {colorThemes.map((ct) => (
              <button
                key={ct.value}
                className={`settings-option${colorTheme === ct.value ? ' active' : ''}`}
                onClick={() => onColorThemeChange(ct.value)}
                role="radio"
                aria-checked={colorTheme === ct.value}
                aria-label={`${ct.label} theme`}
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
          <div className="settings-options" role="radiogroup" aria-label="Appearance">
            {appearances.map((a) => (
              <button
                key={a.value}
                className={`settings-option${theme === a.value ? ' active' : ''}`}
                onClick={() => onThemeChange(a.value)}
                role="radio"
                aria-checked={theme === a.value}
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
