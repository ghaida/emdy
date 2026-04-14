import React, { useRef, useEffect } from 'react';
import type { AppTheme, ColorThemeName, ContentWidth } from '../lib/types';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  colorTheme: ColorThemeName;
  contentWidth: ContentWidth;
  systemAccentColor?: string;
  onThemeChange: (theme: AppTheme) => void;
  onColorThemeChange: (colorTheme: ColorThemeName) => void;
  onContentWidthChange: (contentWidth: ContentWidth) => void;
}

const appearances: { value: AppTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const colorThemes: { value: ColorThemeName; label: string; swatch: string }[] = [
  { value: 'neutral', label: 'Neutral', swatch: '#007AFF' },
  { value: 'warm', label: 'Warm', swatch: '#D47418' },
  { value: 'cool', label: 'Cool', swatch: '#4A7196' },
  { value: 'fresh', label: 'Fresh', swatch: '#FF6B00' },
  { value: 'neon', label: 'Neon', swatch: '#FF2BD2' },
];

const contentWidths: { value: ContentWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'medium', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
];

export function SettingsModal({
  visible,
  onClose,
  theme,
  colorTheme,
  contentWidth,
  systemAccentColor,
  onThemeChange,
  onColorThemeChange,
  onContentWidthChange,
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
          <div className="settings-options settings-grid-3" role="radiogroup" aria-label="Color scheme">
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
                  <circle cx="8" cy="8" r="5" fill={ct.value === 'neutral' && systemAccentColor ? systemAccentColor : ct.swatch} />
                </svg>
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label className="settings-label">Appearance</label>
          <div className="settings-options settings-grid-3" role="radiogroup" aria-label="Appearance">
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

        <div className="settings-section">
          <label className="settings-label">Content Width</label>
          <div className="settings-options settings-grid-3" role="radiogroup" aria-label="Content width">
            {contentWidths.map((width) => (
              <button
                key={width.value}
                className={`settings-option${contentWidth === width.value ? ' active' : ''}`}
                onClick={() => onContentWidthChange(width.value)}
                role="radio"
                aria-checked={contentWidth === width.value}
              >
                {width.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <label className="settings-label">Support</label>
          <button
            className="settings-support-btn"
            onClick={() => window.electronAPI.openExternal('https://buy.stripe.com/eVq14o0r23dZ7H12breZ200')}
          >
            Support Emdy
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
