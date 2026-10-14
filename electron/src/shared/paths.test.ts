import { describe, it, expect } from 'vitest';
import { isInsideFolder, isTextDocument } from './paths';

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

describe('isTextDocument', () => {
  it('accepts Markdown and plain text in any case', () => {
    const accepted = ['/n/a.md', '/n/guide.markdown', '/n/todo.txt', '/n/README.MD', '/n/B.MARKDOWN', '/n/Notes.Txt'];
    expect(accepted.map((p) => isTextDocument(p))).toEqual([true, true, true, true, true, true]);
  });

  it('refuses other files, including ones that only look close and names with no extension', () => {
    const refused = ['/n/.env', '/n/photo.png', '/n/page.mdx', '/n/id_ed25519', '/n/Makefile', '/n/md'];
    expect(refused.map((p) => isTextDocument(p))).toEqual([false, false, false, false, false, false]);
  });
});
