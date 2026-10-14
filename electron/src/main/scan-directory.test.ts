import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanDirectory } from './scan-directory';

let base: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-scan-directory-'));
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('scanDirectory', () => {
  it('leaves out symlinks, so nothing outside the folder is listed', async () => {
    const notes = path.join(base, 'notes');
    const outside = path.join(base, 'outside');
    fs.mkdirSync(notes);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(notes, 'real.md'), '# Real');
    fs.writeFileSync(path.join(outside, 'secret.md'), '# Secret');
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(notes, 'link.md'));
    fs.symlinkSync(outside, path.join(notes, 'linked-folder'));
    expect(await scanDirectory(notes)).toEqual([
      { name: 'real.md', path: path.join(notes, 'real.md'), isDirectory: false },
    ]);
  });
});
