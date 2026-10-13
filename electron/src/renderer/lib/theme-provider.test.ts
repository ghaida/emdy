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

describe('applyTheme with an unknown theme name', () => {
  it('falls back to warm instead of throwing', () => {
    applyTheme('warm', 'light');
    const warmAccent = cssVar('--accent');
    expect(() => applyTheme('sepia' as never, 'light')).not.toThrow();
    expect(cssVar('--accent')).toBe(warmAccent);
  });
});
