import { describe, it, expect } from 'vitest';
import { parseRgba, toHex } from './color';

describe('parseRgba', () => {
  it('reads every hex length, with and without alpha', () => {
    expect(parseRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseRgba('#0f08')).toEqual({ r: 0, g: 255, b: 0, a: 136 / 255 });
    expect(parseRgba('#D47418')).toEqual({ r: 212, g: 116, b: 24, a: 1 });
    expect(parseRgba('#B020E040')).toEqual({ r: 176, g: 32, b: 224, a: 64 / 255 });
  });

  it('reads comma and space rgb()/rgba() syntax, including percentages', () => {
    expect(parseRgba('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseRgba('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseRgba('rgb(100% 0% 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('returns null for forms it does not handle', () => {
    expect(parseRgba('#12345')).toBeNull();
    expect(parseRgba('hsl(10 20% 30%)')).toBeNull();
    expect(parseRgba('rebeccapurple')).toBeNull();
  });
});

describe('toHex', () => {
  it('rounds and clamps channels', () => {
    expect(toHex(127.5, 300, -4)).toBe('#80ff00');
  });
});
