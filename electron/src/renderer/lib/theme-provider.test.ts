import { describe, it, expect } from 'vitest';
import { applyTheme } from './theme-provider';

const cssVar = (name: string) => document.documentElement.style.getPropertyValue(name);

describe('applyTheme transitions', () => {
  it('sets the tooltip delay as a kebab-case custom property', () => {
    applyTheme('warm', 'light');
    expect(cssVar('--transition-tooltip-delay')).toBe('0.3s');
  });

  it('keeps the single-word transition names', () => {
    applyTheme('warm', 'light');
    expect(cssVar('--transition-fast')).toBe('0.1s');
    expect(cssVar('--transition-normal')).toBe('0.15s');
    expect(cssVar('--transition-slow')).toBe('0.2s');
  });
});
