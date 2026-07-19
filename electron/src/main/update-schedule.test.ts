import { describe, it, expect } from 'vitest';
import { shouldCheckOnFocus, RECHECK_INTERVAL_MS } from './update-schedule';

describe('shouldCheckOnFocus', () => {
  const now = 1_000_000_000_000;

  it('returns true when there is no prior check', () => {
    expect(shouldCheckOnFocus(null, now)).toBe(true);
  });

  it('returns false when the last check was 3h59m ago (under threshold)', () => {
    const lastCheckAt = now - (3 * 60 * 60 * 1000 + 59 * 60 * 1000);
    expect(shouldCheckOnFocus(lastCheckAt, now)).toBe(false);
  });

  it('returns true when the last check was 4h01m ago (over threshold)', () => {
    const lastCheckAt = now - (4 * 60 * 60 * 1000 + 1 * 60 * 1000);
    expect(shouldCheckOnFocus(lastCheckAt, now)).toBe(true);
  });

  it('returns true exactly at the interval boundary', () => {
    expect(shouldCheckOnFocus(now - RECHECK_INTERVAL_MS, now)).toBe(true);
  });

  it('uses a 4-hour interval', () => {
    expect(RECHECK_INTERVAL_MS).toBe(4 * 60 * 60 * 1000);
  });
});
