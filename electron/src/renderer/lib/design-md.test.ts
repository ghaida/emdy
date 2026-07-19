import { describe, it, expect } from 'vitest';
import { parseDesignMd, isValidCssColor, cssLength } from './design-md';

const HERITAGE = `---
name: Heritage
description: A warm editorial identity
colors:
  primary: "#1A1C1E"
  tertiary: "#B8422E"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
spacing:
  sm: 8px
  md: 16px
rounded:
  sm: 4px
---

## Overview

Body text here.
`;

describe('parseDesignMd detection', () => {
  it('parses a valid design.md file', () => {
    const result = parseDesignMd(HERITAGE);
    expect(result).not.toBeNull();
    expect(result!.tokens.name).toBe('Heritage');
    expect(result!.tokens.description).toBe('A warm editorial identity');
    expect(result!.tokens.colors).toEqual({ primary: '#1A1C1E', tertiary: '#B8422E' });
    expect(result!.body).not.toContain('---');
    expect(result!.body).toContain('## Overview');
  });

  it('returns null when there is no front matter', () => {
    expect(parseDesignMd('# Just a doc\n\nHello.')).toBeNull();
  });

  it('returns null for blog-style front matter (no token categories)', () => {
    expect(parseDesignMd('---\ntitle: My Post\ndate: 2026-01-01\nname: x\n---\nBody')).toBeNull();
  });

  it('returns null when name is missing', () => {
    expect(parseDesignMd('---\ncolors:\n  primary: "#fff"\n---\nBody')).toBeNull();
  });

  it('returns null when name is not a string', () => {
    expect(parseDesignMd('---\nname: 42\ncolors:\n  primary: "#fff"\n---\nBody')).toBeNull();
  });

  it('returns null when the only token category is empty', () => {
    expect(parseDesignMd('---\nname: X\ncolors: {}\n---\nBody')).toBeNull();
  });

  it('returns null on malformed YAML instead of throwing', () => {
    expect(parseDesignMd('---\nname: [unclosed\ncolors: {\n---\nBody')).toBeNull();
  });

  it('returns null when front matter is not a mapping', () => {
    expect(parseDesignMd('---\n- just\n- a list\n---\nBody')).toBeNull();
  });

  it('accepts a file with front matter only and empty body', () => {
    const result = parseDesignMd('---\nname: X\ncolors:\n  a: "#fff"\n---\n');
    expect(result).not.toBeNull();
    expect(result!.body.trim()).toBe('');
  });

  it('handles CRLF line endings', () => {
    const result = parseDesignMd('---\r\nname: X\r\ncolors:\r\n  a: "#fff"\r\n---\r\nBody');
    expect(result).not.toBeNull();
    expect(result!.body).toContain('Body');
  });
});

describe('parseDesignMd normalization', () => {
  it('coerces numeric spacing values to strings', () => {
    const r = parseDesignMd('---\nname: X\nspacing:\n  sm: 8\n  md: 16px\n---\n');
    expect(r!.tokens.spacing).toEqual({ sm: '8', md: '16px' });
  });

  it('keeps only known typography fields, coerced to strings', () => {
    const r = parseDesignMd(
      '---\nname: X\ntypography:\n  h1:\n    fontFamily: Public Sans\n    fontSize: 3rem\n    fontWeight: 600\n    bogus: nope\n---\n'
    );
    expect(r!.tokens.typography!.h1).toEqual({
      fontFamily: 'Public Sans',
      fontSize: '3rem',
      fontWeight: '600',
    });
  });

  it('drops non-object typography entries', () => {
    const r = parseDesignMd('---\nname: X\ntypography:\n  h1: big\ncolors:\n  a: "#fff"\n---\n');
    expect(r!.tokens.typography).toBeUndefined();
  });

  it('resolves token references in components', () => {
    const r = parseDesignMd(
      '---\nname: X\ncolors:\n  primary: "#1A1C1E"\ncomponents:\n  button:\n    backgroundColor: "{colors.primary}"\n    padding: 12px\n---\n'
    );
    expect(r!.tokens.components!.button).toEqual({
      backgroundColor: '#1A1C1E',
      padding: '12px',
    });
  });

  it('resolves chained references', () => {
    const r = parseDesignMd(
      '---\nname: X\ncolors:\n  base: "#fff"\n  surface: "{colors.base}"\ncomponents:\n  card:\n    bg: "{colors.surface}"\n---\n'
    );
    expect(r!.tokens.components!.card.bg).toBe('#fff');
  });

  it('keeps unresolvable references literal', () => {
    const r = parseDesignMd(
      '---\nname: X\ncolors:\n  a: "#fff"\ncomponents:\n  card:\n    bg: "{colors.missing}"\n---\n'
    );
    expect(r!.tokens.components!.card.bg).toBe('{colors.missing}');
  });

  it('keeps circular references literal instead of hanging', () => {
    const r = parseDesignMd(
      '---\nname: X\ncolors:\n  a: "{colors.b}"\n  b: "{colors.a}"\n---\n'
    );
    expect(r!.tokens.colors!.a).toBe('{colors.b}');
  });
});

describe('isValidCssColor', () => {
  it('accepts hex, rgb, and oklch', () => {
    expect(isValidCssColor('#B8422E')).toBe(true);
    expect(isValidCssColor('rgb(10, 20, 30)')).toBe(true);
    expect(isValidCssColor('oklch(62% 0.18 250)')).toBe(true);
  });
  it('rejects non-color strings', () => {
    expect(isValidCssColor('{colors.missing}')).toBe(false);
    expect(isValidCssColor('12px')).toBe(false);
  });
});

describe('cssLength', () => {
  it('converts px, rem, em, and bare numbers to px', () => {
    expect(cssLength('16px')).toBe(16);
    expect(cssLength('1.5rem')).toBe(24);
    expect(cssLength('2em')).toBe(32);
    expect(cssLength('8')).toBe(8);
  });
  it('returns null for unparseable or negative values', () => {
    expect(cssLength('auto')).toBeNull();
    expect(cssLength('-4px')).toBeNull();
  });
});
