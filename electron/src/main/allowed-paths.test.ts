import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { localFilePathFromUrl } from './local-file';

let base: string;
let allowedPaths: typeof import('./allowed-paths');

beforeEach(async () => {
  // realpath: os.tmpdir() is under /var, a symlink to /private/var.
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-allowed-paths-')));
  // A fresh module, so each test starts with no folders opened.
  vi.resetModules();
  allowedPaths = await import('./allowed-paths');
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('a folder opened through a symlink', () => {
  let real: string;
  let link: string;

  beforeEach(() => {
    real = path.join(base, 'notes');
    link = path.join(base, 'link');
    fs.mkdirSync(real);
    fs.writeFileSync(path.join(real, 'a.md'), '# A');
    fs.symlinkSync(real, link);
    allowedPaths.addAllowedRoot(link);
  });

  it('allows its files through the symlink', () => {
    expect(allowedPaths.isPathAllowed(path.join(link, 'a.md'))).toBe(true);
  });

  it('allows its files through the real path', () => {
    expect(allowedPaths.isPathAllowed(path.join(real, 'a.md'))).toBe(true);
  });

  it('allows the folder itself either way', () => {
    expect(allowedPaths.isPathAllowed(link)).toBe(true);
    expect(allowedPaths.isPathAllowed(real)).toBe(true);
  });

  it('does not allow a sibling folder', () => {
    // Its name starts with the opened folder's, so only the separator keeps it out.
    const sibling = path.join(base, 'notes-archive');
    fs.mkdirSync(sibling);
    fs.writeFileSync(path.join(sibling, 'b.md'), '# B');
    expect(allowedPaths.isPathAllowed(sibling)).toBe(false);
    expect(allowedPaths.isPathAllowed(path.join(sibling, 'b.md'))).toBe(false);
  });
});

describe('an image URL, read the way the local-file: handler reads it', () => {
  let notes: string;

  // Built as image-url.ts builds them: the fixed host, then each segment encoded.
  const imageUrl = (filePath: string) =>
    `local-file://local${filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
  // The handler's check (index.ts): a path from the URL, inside an opened folder.
  const served = (filePath: string | null) => filePath !== null && allowedPaths.isPathAllowed(filePath);

  beforeEach(() => {
    notes = path.join(base, 'notes');
    fs.mkdirSync(notes);
    fs.mkdirSync(path.join(base, 'outside'));
    fs.writeFileSync(path.join(base, 'pic.png'), '');
    fs.writeFileSync(path.join(base, 'outside', 'logo.png'), '');
    fs.writeFileSync(path.join(notes, 'real.png'), '');
    fs.symlinkSync(path.join(base, 'outside', 'logo.png'), path.join(notes, 'logo.png'));
    allowedPaths.addAllowedRoot(notes);
  });

  it('is refused when an encoded slash climbs out of the folder', () => {
    // Written raw: encoding the segment would turn its % into %25.
    const filePath = localFilePathFromUrl(`${imageUrl(notes)}/..%2Fpic.png`);
    expect(filePath).toBe(path.join(base, 'pic.png'));
    expect(served(filePath)).toBe(false);
  });

  it('is refused for a symlink inside the folder that points outside it', () => {
    const filePath = localFilePathFromUrl(imageUrl(path.join(notes, 'logo.png')));
    expect(filePath).toBe(path.join(notes, 'logo.png'));
    expect(served(filePath)).toBe(false);
  });

  it('is served for a file inside the folder', () => {
    const filePath = localFilePathFromUrl(imageUrl(path.join(notes, 'real.png')));
    expect(filePath).toBe(path.join(notes, 'real.png'));
    expect(served(filePath)).toBe(true);
  });
});

describe("a folder that can't be resolved", () => {
  it('is added as given instead of throwing', () => {
    const missing = path.join(base, 'missing');
    expect(() => allowedPaths.addAllowedRoot(missing)).not.toThrow();
    expect(allowedPaths.isPathAllowed(path.join(missing, 'a.md'))).toBe(true);
  });
});
