import React from 'react';
import type { FontFamily } from '../lib/types';

interface FontPickerProps {
  value: FontFamily;
  onChange: (font: FontFamily) => void;
}

const fonts: { value: FontFamily; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

export function FontPicker({ value, onChange }: FontPickerProps) {
  return (
    <div className="font-picker">
      {fonts.map((f) => (
        <button
          key={f.value}
          className={`toolbar-btn${value === f.value ? ' active' : ''}`}
          onClick={() => onChange(f.value)}
          title={`${f.label} font`}
        >
          <span style={{ fontFamily: f.value === 'sans' ? 'var(--font-sans)' : f.value === 'serif' ? 'var(--font-serif)' : 'var(--font-mono)', fontSize: '12px' }}>
            {f.label}
          </span>
        </button>
      ))}
    </div>
  );
}
