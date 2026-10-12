import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

describe("a folder that can't be resolved", () => {
  it('is added as given instead of throwing', () => {
    const missing = path.join(base, 'missing');
    expect(() => allowedPaths.addAllowedRoot(missing)).not.toThrow();
    expect(allowedPaths.isPathAllowed(path.join(missing, 'a.md'))).toBe(true);
  });
});
