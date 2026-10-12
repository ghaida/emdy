import { describe, it, expect } from 'vitest';
import { isInsideFolder } from './paths';

describe('isInsideFolder', () => {
  it('is true for files in the folder or below it', () => {
    expect(isInsideFolder('/docs/intro.md', '/docs')).toBe(true);
    expect(isInsideFolder('/docs/guides/setup.md', '/docs')).toBe(true);
  });

  it('accepts a folder path with a trailing slash', () => {
    expect(isInsideFolder('/docs/intro.md', '/docs/')).toBe(true);
  });

  it('is false for a sibling whose name starts with the folder name', () => {
    expect(isInsideFolder('/docs-old/old.md', '/docs')).toBe(false);
    expect(isInsideFolder('/a/bc.md', '/a/b')).toBe(false);
  });

  it('is false for the folder itself and for files elsewhere', () => {
    expect(isInsideFolder('/docs', '/docs')).toBe(false);
    expect(isInsideFolder('/notes/todo.md', '/docs')).toBe(false);
  });
});
