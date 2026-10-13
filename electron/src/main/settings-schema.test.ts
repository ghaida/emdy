import { describe, it, expect } from 'vitest';
import { defaults, sanitizeSettings } from './settings-schema';

describe('sanitizeSettings', () => {
  it('keeps valid values', () => {
    expect(sanitizeSettings({ fontFamily: 'mono', theme: 'dark', colorTheme: 'cool', zoom: 1.5, contentWidth: 'wide' }))
      .toEqual({ fontFamily: 'mono', theme: 'dark', colorTheme: 'cool', zoom: 1.5, contentWidth: 'wide' });
  });

  it('replaces only the invalid values with defaults', () => {
    expect(sanitizeSettings({ colorTheme: 'cool', zoom: 'big', theme: 'sepia' }))
      .toEqual({ ...defaults, colorTheme: 'cool' });
  });

  it('ignores keys it does not know', () => {
    expect(sanitizeSettings({ colorTheme: 'cool', evil: true })).toEqual({ ...defaults, colorTheme: 'cool' });
  });

  it('returns the defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(defaults);
    expect(sanitizeSettings('warm')).toEqual(defaults);
    expect(sanitizeSettings([1, 2])).toEqual(defaults);
  });
});
