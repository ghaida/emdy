import { describe, it, expect } from 'vitest';
import { localFilePathFromUrl } from './local-file';

describe('localFilePathFromUrl', () => {
  it('reads the path after the fixed host, decoding once', () => {
    expect(localFilePathFromUrl('local-file://local/Users/me/notes/Screenshot%201.png'))
      .toBe('/Users/me/notes/Screenshot 1.png');
  });

  it('keeps the case of the path', () => {
    expect(localFilePathFromUrl('local-file://local/Users/Ghaida/Photo.PNG')).toBe('/Users/Ghaida/Photo.PNG');
  });

  it('resolves dot segments', () => {
    expect(localFilePathFromUrl('local-file://local/Users/me/notes/../pic.png')).toBe('/Users/me/pic.png');
  });

  it('resolves a .. that only appears once an encoded slash is decoded', () => {
    // The URL parser leaves ..%2F in place, so this one is down to path.resolve.
    expect(localFilePathFromUrl('local-file://local/Users/me/notes/..%2Fpic.png')).toBe('/Users/me/pic.png');
  });

  it('decodes an encoded % only once', () => {
    expect(localFilePathFromUrl('local-file://local/Users/me/a%2520b.png')).toBe('/Users/me/a%20b.png');
  });

  it('refuses the old triple-slash form, other hosts and other schemes', () => {
    expect(localFilePathFromUrl('local-file:///Users/me/pic.png')).toBeNull();
    expect(localFilePathFromUrl('local-file://users/me/pic.png')).toBeNull();
    expect(localFilePathFromUrl('file:///Users/me/pic.png')).toBeNull();
    expect(localFilePathFromUrl('not a url')).toBeNull();
  });

  it('serves only image types', () => {
    expect(localFilePathFromUrl('local-file://local/Users/me/notes.md')).toBeNull();
    expect(localFilePathFromUrl('local-file://local/Users/me/.ssh/id_rsa')).toBeNull();
    expect(localFilePathFromUrl('local-file://local/Users/me/a.svg')).toBe('/Users/me/a.svg');
  });

  it('refuses malformed percent-encoding', () => {
    expect(localFilePathFromUrl('local-file://local/Users/me/%E0%A4%A.png')).toBeNull();
  });
});
