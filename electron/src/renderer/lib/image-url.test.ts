import { describe, it, expect } from 'vitest';
import { localImageUrl, resolveImagePath } from './image-url';

const file = '/Users/me/notes/guide.md';

describe('resolveImagePath', () => {
  it('resolves a relative path against the file\'s folder', () => {
    expect(resolveImagePath('pic.png', file)).toBe('/Users/me/notes/pic.png');
    expect(resolveImagePath('./img/pic.png', file)).toBe('/Users/me/notes/img/pic.png');
  });

  it('collapses .. segments', () => {
    expect(resolveImagePath('../shared/pic.png', file)).toBe('/Users/me/shared/pic.png');
  });

  it('decodes what the Markdown pipeline already percent-encoded', () => {
    expect(resolveImagePath('Screenshot%202026-10-12%20at%2014.07.18.png', file))
      .toBe('/Users/me/notes/Screenshot 2026-10-12 at 14.07.18.png');
  });

  it('drops a #fragment, as GitHub does with logo.png#gh-dark-mode-only', () => {
    expect(resolveImagePath('logo.png#gh-dark-mode-only', file)).toBe('/Users/me/notes/logo.png');
  });

  it('drops a ?query', () => {
    expect(resolveImagePath('img/shot.png?raw=true', file)).toBe('/Users/me/notes/img/shot.png');
  });

  it('keeps an encoded # as part of the file name', () => {
    expect(resolveImagePath('a%23b.png', file)).toBe('/Users/me/notes/a#b.png');
  });

  it('keeps an absolute path', () => {
    expect(resolveImagePath('/Volumes/Work/pic.png', file)).toBe('/Volumes/Work/pic.png');
  });

  it('returns null for anything with a scheme', () => {
    expect(resolveImagePath('https://example.com/a.png', file)).toBeNull();
    expect(resolveImagePath('data:image/png;base64,AAAA', file)).toBeNull();
    expect(resolveImagePath('file:///etc/hosts', file)).toBeNull();
  });
});

describe('localImageUrl', () => {
  it('builds a local-file URL with a fixed host and encoded segments', () => {
    expect(localImageUrl('Screenshot 1.png', file)).toBe('local-file://local/Users/me/notes/Screenshot%201.png');
    expect(localImageUrl('img/caf%C3%A9.png', file)).toBe('local-file://local/Users/me/notes/img/caf%C3%A9.png');
  });

  it('leaves URLs with a scheme alone', () => {
    expect(localImageUrl('https://example.com/a.png', file)).toBe('https://example.com/a.png');
  });
});
