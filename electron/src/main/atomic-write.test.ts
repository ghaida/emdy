import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeJsonAtomic, writeTextAtomic } from './atomic-write';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-write-')); });
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeJsonAtomic', () => {
  it('writes the JSON with mode 600 and leaves no temp file behind', () => {
    const p = path.join(dir, 'state.json');
    writeJsonAtomic(p, { a: 1 });
    expect(JSON.parse(fs.readFileSync(p, 'utf-8'))).toEqual({ a: 1 });
    expect((fs.statSync(p).mode & 0o777).toString(8)).toBe('600');
    expect(fs.readdirSync(dir)).toEqual(['state.json']);
  });

  it('replaces an existing file', () => {
    const p = path.join(dir, 'state.json');
    writeJsonAtomic(p, { a: 1 });
    writeJsonAtomic(p, { a: 2 });
    expect(JSON.parse(fs.readFileSync(p, 'utf-8'))).toEqual({ a: 2 });
  });

  it('leaves the saved file whole when a write fails partway, as on a full disk', () => {
    const p = path.join(dir, 'state.json');
    writeJsonAtomic(p, { a: 1 });
    const saved = fs.readFileSync(p, 'utf-8');
    const realWrite = fs.writeFileSync;
    // Three characters reach the disk, then it's full.
    vi.spyOn(fs, 'writeFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, data: string, options?: fs.WriteFileOptions) => {
      realWrite(file, data.slice(0, 3), options);
      throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
    }) as typeof fs.writeFileSync);
    expect(() => writeJsonAtomic(p, { a: 2 })).toThrow('ENOSPC');
    expect(fs.readFileSync(p, 'utf-8')).toBe(saved);
  });

  it('puts the new file in place by renaming the temp file over the old one', () => {
    const p = path.join(dir, 'state.json');
    writeJsonAtomic(p, { a: 1 });
    const oldFile = fs.statSync(p).ino;
    const realRename = fs.renameSync;
    let tempFile: number | null = null;
    vi.spyOn(fs, 'renameSync').mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
      tempFile = fs.statSync(from).ino;
      realRename(from, to);
    });
    writeJsonAtomic(p, { a: 2 });
    expect(tempFile).not.toBeNull();
    expect(fs.statSync(p).ino).toBe(tempFile);
    expect(fs.statSync(p).ino).not.toBe(oldFile);
  });
});

describe('writeTextAtomic', () => {
  it('writes the text as given with mode 600 and leaves no temp file behind', () => {
    const p = path.join(dir, 'session.json');
    writeTextAtomic(p, 'hello\n');
    expect(fs.readFileSync(p, 'utf-8')).toBe('hello\n');
    expect((fs.statSync(p).mode & 0o777).toString(8)).toBe('600');
    expect(fs.readdirSync(dir)).toEqual(['session.json']);
  });
});
