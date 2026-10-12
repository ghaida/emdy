import { describe, it, expect } from 'vitest';
import { MAX_RECENTS, parseRecents, recentLabel, withRecent } from './recent-list';

describe('withRecent', () => {
  it('puts the newly opened path first', () => {
    expect(withRecent(['/a.md', '/b.md'], '/c.md')).toEqual(['/c.md', '/a.md', '/b.md']);
  });

  it('moves a path that is already listed to the top instead of listing it twice', () => {
    expect(withRecent(['/a.md', '/b.md', '/c.md'], '/b.md')).toEqual(['/b.md', '/a.md', '/c.md']);
  });

  it('keeps only the most recent ten', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `/file-${i}.md`);
    const list = eleven.reduce<string[]>((acc, p) => withRecent(acc, p), []);
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe('/file-10.md');
    expect(list).not.toContain('/file-0.md');
  });
});

describe('parseRecents', () => {
  it('reads back a list of absolute paths', () => {
    expect(parseRecents(['/docs', '/notes/a.md'])).toEqual(['/docs', '/notes/a.md']);
  });

  it('drops anything that is not an absolute path, and duplicates', () => {
    expect(parseRecents(['/a.md', 'relative.md', 42, null, '/a.md', '/b.md'])).toEqual(['/a.md', '/b.md']);
  });

  it('returns nothing for junk', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents({ paths: ['/a.md'] })).toEqual([]);
    expect(parseRecents('/a.md')).toEqual([]);
  });

  it('keeps at most ten', () => {
    expect(parseRecents(Array.from({ length: 12 }, (_, i) => `/f${i}.md`))).toHaveLength(MAX_RECENTS);
  });
});

describe('recentLabel', () => {
  const home = '/Users/ghaida';

  it('writes the home folder as ~', () => {
    expect(recentLabel('/Users/ghaida/Documents/notes/readme.md', home)).toBe('~/Documents/notes/readme.md');
  });

  it('leaves paths outside the home folder as they are', () => {
    expect(recentLabel('/Volumes/Work/plan.md', home)).toBe('/Volumes/Work/plan.md');
  });

  it("doesn't treat a folder that only starts with the home folder's name as home", () => {
    expect(recentLabel('/Users/ghaida2/notes.md', home)).toBe('/Users/ghaida2/notes.md');
  });
});
