import { describe, it, expect } from 'vitest';
import { parseDesignMd } from './design-md';

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
