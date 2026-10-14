import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readTextFile, MAX_FILE_BYTES } from './read-text';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-read-')); });
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

// Another app writes to the file straight after its size is checked: stat
// answers for the file as it was, then `change` runs.
function changeAfterStat(change: (filePath: string) => void) {
  const realStat = fsp.stat;
  vi.spyOn(fsp, 'stat').mockImplementation((async (p: fs.PathLike) => {
    const stats = await realStat(p);
    change(String(p));
    return stats;
  }) as unknown as typeof fsp.stat);
}

describe('readTextFile', () => {
  it('reads a file', async () => {
    const p = path.join(dir, 'a.md');
    fs.writeFileSync(p, '# A\n');
    expect(await readTextFile(p)).toBe('# A\n');
  });

  it('refuses files over the cap, folders and missing files', async () => {
    const big = path.join(dir, 'big.md');
    fs.writeFileSync(big, 'x'.repeat(MAX_FILE_BYTES + 1));
    await expect(readTextFile(big)).rejects.toThrow('File too large');
    await expect(readTextFile(dir)).rejects.toThrow('Not a file');
    await expect(readTextFile(path.join(dir, 'nope.md'))).rejects.toThrow();
  });

  it('refuses a file that grew past the cap after its size was checked', async () => {
    const p = path.join(dir, 'log.md');
    fs.writeFileSync(p, '# Log\n');
    // Sparse: the file reports the size without taking up the space.
    changeAfterStat((filePath) => fs.truncateSync(filePath, MAX_FILE_BYTES + 1));
    await expect(readTextFile(p)).rejects.toThrow('File too large');
  });

  it('reads all of a file that grew after its size was checked but stays under the cap', async () => {
    const p = path.join(dir, 'log.md');
    fs.writeFileSync(p, '# Log\n');
    changeAfterStat((filePath) => fs.appendFileSync(filePath, 'One more line.\n'));
    expect(await readTextFile(p)).toBe('# Log\nOne more line.\n');
  });

  it('reads a file of exactly the cap', async () => {
    const p = path.join(dir, 'full.md');
    fs.writeFileSync(p, '');
    fs.truncateSync(p, MAX_FILE_BYTES);
    expect((await readTextFile(p)).length).toBe(MAX_FILE_BYTES);
  });

  it('decodes as fs.readFile does, keeping a BOM, CRLF line ends and invalid UTF-8 as they were', async () => {
    const p = path.join(dir, 'windows.md');
    fs.writeFileSync(p, Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x20, 0x41, 0x0d, 0x0a, 0xff, 0x0a]));
    expect(await readTextFile(p)).toBe(fs.readFileSync(p, 'utf-8'));
  });
});
