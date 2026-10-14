import { describe, it, expect, vi, beforeEach, afterEach, onTestFinished } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cacheTotals, registerSearch, searchFiles } from './search';

let dir: string;

function write(rel: string, text: string): string {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return p;
}

// Sparse: the file reports `bytes` as its size without taking up the space.
// It ends with `tail`; everything before is NUL bytes on one line.
function sparse(rel: string, bytes: number, tail: string): string {
  const p = write(rel, '');
  fs.truncateSync(p, bytes - Buffer.byteLength(tail));
  fs.appendFileSync(p, tail);
  return p;
}

// A slow drive: every read takes a few milliseconds. `third` settles when the
// third read starts, so a test can act while the search is mid-walk.
function slowReads(): { count: () => number; third: Promise<void> } {
  const realReadFile = fsp.readFile;
  let reads = 0;
  let thirdStarted: () => void = () => undefined;
  const third = new Promise<void>((resolve) => {
    thirdStarted = resolve;
  });
  vi.spyOn(fsp, 'readFile').mockImplementation(((...args: Parameters<typeof fsp.readFile>) => {
    if (++reads === 3) thirdStarted();
    return new Promise((resolve) => setTimeout(resolve, 5)).then(() => realReadFile(...args));
  }) as unknown as typeof fsp.readFile);
  return { count: () => reads, third };
}

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'emdy-search-')));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

const never = () => false;

describe('searchFiles', () => {
  it('lists name matches from every file before content matches fill the cap', async () => {
    for (let i = 0; i < 30; i++) write(`notes/n${String(i).padStart(2, '0')}.md`, 'design here\ndesign again\ndesign once more\n');
    const target = write('zz-design.md', 'nothing here\n');
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'design', never);
    expect(results).not.toBeNull();
    expect(results?.some((r) => r.type === 'file' && r.filePath === target)).toBe(true);
    // Three snippets a file would reach 51 at the seventeenth file; the cap is exact.
    expect(results?.filter((r) => r.type === 'content').length).toBe(50);
  });

  it('counts matches separately from the three snippets', async () => {
    write('a.md', Array.from({ length: 40 }, (_, i) => `line ${i} alpha`).join('\n'));
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(results).not.toBeNull();
    const content = results?.filter((r) => r.type === 'content') ?? [];
    expect(content.length).toBe(3);
    expect(content[0].matchCount).toBe(40);
    expect(content.map((r) => r.lineNumber)).toEqual([1, 2, 3]);
  });

  it('searches the open file first', async () => {
    write('a.md', 'alpha\n');
    const open = write('b.md', 'alpha\n');
    const results = await searchFiles({ rootPath: dir, filePath: open }, 'alpha', never);
    expect(results).not.toBeNull();
    expect(results?.filter((r) => r.type === 'content')[0].filePath).toBe(open);
  });

  it('with no root searches only the open file', async () => {
    write('other.md', 'alpha\n');
    const open = write('open.md', 'alpha\n');
    const results = await searchFiles({ rootPath: null, filePath: open }, 'alpha', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => r.filePath)).toEqual([open]);
  });

  it('judges an open file that is a link by where it leads, so a document-named link to .env yields nothing', async () => {
    write('.env', 'API_KEY=secret-value\n');
    const setup = path.join(dir, 'setup.md');
    fs.symlinkSync('.env', setup);
    const notes = write('notes.md', 'API_KEY goes here\n');
    const alias = path.join(dir, 'alias.md');
    fs.symlinkSync(notes, alias);
    expect(await searchFiles({ rootPath: null, filePath: setup }, 'API_KEY', never)).toEqual([]);
    // A link to a document is searched, under the name the window shows.
    const viaLink = await searchFiles({ rootPath: null, filePath: alias }, 'API_KEY', never);
    expect(viaLink?.map((r) => [r.filePath, r.lineNumber])).toEqual([[alias, 1]]);
  });

  it('skips files over 2 MB, dot folders, ignored folders and symlinks', async () => {
    write('big.md', 'alpha'.padEnd(2 * 1024 * 1024 + 1, 'x'));
    write('.obsidian/hidden.md', 'alpha\n');
    write('node_modules/dep.md', 'alpha\n');
    const outside = path.join(os.tmpdir(), `emdy-outside-${process.pid}.md`);
    fs.writeFileSync(outside, 'alpha\n');
    onTestFinished(() => fs.rmSync(outside, { force: true }));
    fs.symlinkSync(outside, path.join(dir, 'link.md'));
    const kept = write('kept.md', 'alpha\n');
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => r.filePath)).toEqual([kept]);
  });

  it('is case-insensitive and reads an edited file again', async () => {
    const p = write('a.md', 'Alpha\n');
    const before = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(before).not.toBeNull();
    expect(before?.length).toBe(1);
    fs.writeFileSync(p, 'beta\n');
    const later = new Date(Date.now() + 2000);
    fs.utimesSync(p, later, later);
    const after = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(after).not.toBeNull();
    expect(after?.length).toBe(0);
  });

  it('returns null as soon as a newer query has arrived', async () => {
    for (let i = 0; i < 5; i++) write(`n${i}.md`, 'alpha\n');
    let calls = 0;
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', () => ++calls > 2);
    expect(results).toBeNull();
  });

  it('reports the right line when İ comes before the match', async () => {
    // 'İ'.toLowerCase() is two UTF-16 units, so offsets in a lowercased copy run ahead of the text.
    write('tr.md', 'İİİİİ\nab\nc\n');
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'ab', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => [r.lineNumber, r.matchLine])).toEqual([[2, 'ab']]);
  });

  it('stops counting at 1,000 matches', async () => {
    write('many.md', 'alpha '.repeat(1500));
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => r.matchCount)).toEqual([1000]);
  });

  it('returns no rows for an empty query without listing files', async () => {
    write('a.md', 'alpha\n');
    const readdir = vi.spyOn(fsp, 'readdir');
    expect(await searchFiles({ rootPath: dir, filePath: null }, '', never)).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });

  it('stops between files once the same window registers a newer search', async () => {
    for (let i = 0; i < 20; i++) write(`n${String(i).padStart(2, '0')}.md`, 'alpha\n');
    const reads = slowReads();
    const pending = searchFiles({ rootPath: dir, filePath: null }, 'alpha', registerSearch(1, 1));
    await reads.third;
    registerSearch(1, 2);
    expect(await pending).toBeNull();
    expect(reads.count()).toBe(3);
  });

  it('keeps searching when another window registers a newer search', async () => {
    for (let i = 0; i < 20; i++) write(`n${String(i).padStart(2, '0')}.md`, 'alpha\n');
    const reads = slowReads();
    const pending = searchFiles({ rootPath: dir, filePath: null }, 'alpha', registerSearch(2, 1));
    await reads.third;
    registerSearch(3, 2);
    expect((await pending)?.length).toBe(20);
    expect(reads.count()).toBe(20);
  });

  it('matches regex characters in the query literally', async () => {
    write('chars.md', 'axb\na.b\n(x)\n[1]\n1\n');
    const lines = async (query: string) =>
      (await searchFiles({ rootPath: dir, filePath: null }, query, never))?.map((r) => r.lineNumber);
    expect(await lines('a.b')).toEqual([2]);
    expect(await lines('(x)')).toEqual([3]);
    expect(await lines('[1]')).toEqual([4]);
  });

  it('lists names, then contents, each in alphabetical order as 1.8.1 did', async () => {
    write('Zeta-note.md', 'note\n');
    write('alpha-note.md', 'note one\nnote two\n');
    write('mid/beta-note.md', 'note\n');
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'note', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => [r.type, r.fileName, r.lineNumber])).toEqual([
      ['file', 'alpha-note.md', undefined],
      ['file', 'beta-note.md', undefined],
      ['file', 'Zeta-note.md', undefined],
      ['content', 'alpha-note.md', 1],
      ['content', 'alpha-note.md', 2],
      ['content', 'beta-note.md', 1],
      ['content', 'Zeta-note.md', 1],
    ]);
  });

  it('finds snippet lines past a long line full of matches', async () => {
    write('long.md', `${'alpha '.repeat(500)}\n${'filler\n'.repeat(500)}alpha at the end`);
    const results = await searchFiles({ rootPath: dir, filePath: null }, 'alpha', never);
    expect(results).not.toBeNull();
    expect(results?.map((r) => [r.lineNumber, r.matchLine, r.matchCount])).toEqual([
      [1, 'alpha '.repeat(20), 501],
      [502, 'alpha at the end', 501],
    ]);
  });

  it('counts a file once when two searches load it at the same time', async () => {
    const file = write('shared.md', 'alpha\n'.repeat(100));
    const realReadFile = fsp.readFile;
    let reads = 0;
    let bothReading: () => void = () => undefined;
    // Every read waits until both searches are reading, so the two loads overlap.
    // The timer only keeps a future that reads once from hanging here.
    const gate = new Promise<void>((resolve) => {
      bothReading = resolve;
      setTimeout(resolve, 1000);
    });
    vi.spyOn(fsp, 'readFile').mockImplementation(((...args: Parameters<typeof fsp.readFile>) => {
      if (++reads === 2) bothReading();
      return gate.then(() => realReadFile(...args));
    }) as unknown as typeof fsp.readFile);
    const scope = { rootPath: null, filePath: file };
    await Promise.all([searchFiles(scope, 'alpha', never), searchFiles(scope, 'alpha', never)]);
    expect(reads).toBe(2);
    const { counted, held } = cacheTotals();
    expect(counted).toBe(held);
  });
});

// The document on screen is searched whatever the walk makes of it: find is
// reached only through the palette.
describe('searchFiles and the open document', () => {
  const MB = 1024 * 1024;
  // Over the walk's 2 MB cap and under the 10 MB read cap, with its matches at the end.
  const bigFile = (rel: string) => sparse(rel, 3 * MB, '\nalpha near the end\nalpha again\n');

  it('searches an open document over 2 MB on its own', async () => {
    const big = bigFile('big.md');
    const results = await searchFiles({ rootPath: null, filePath: big }, 'alpha', never);
    expect(results?.map((r) => [r.filePath, r.lineNumber, r.matchLine, r.matchCount])).toEqual([
      [big, 2, 'alpha near the end', 2],
      [big, 3, 'alpha again', 2],
    ]);
  });

  it('searches an open document over 2 MB in its folder, first, and still skips the folder\'s other files over 2 MB', async () => {
    write('a-small.md', 'alpha\n');
    bigFile('other-big.md');
    const big = bigFile('big.md');
    const results = await searchFiles({ rootPath: dir, filePath: big }, 'alpha', never);
    expect(results?.map((r) => [r.fileName, r.lineNumber, r.matchCount])).toEqual([
      ['big.md', 2, 2],
      ['big.md', 3, 2],
      ['a-small.md', 1, 1],
    ]);
  });

  it('searches an open document the folder walk leaves out, unless it is a link that leads to something else', async () => {
    const todo = write('todo.txt', 'alpha in a text file\n');
    const hidden = write('.obsidian/notes.md', 'alpha in a dot folder\n');
    const dep = write('node_modules/pkg/README.md', 'alpha in a package\n');
    write('.env', 'alpha=secret-value\n');
    const setup = path.join(dir, 'setup.md');
    fs.symlinkSync('.env', setup);
    const kept = write('kept.md', 'alpha\n');
    const rows = async (open: string) =>
      (await searchFiles({ rootPath: dir, filePath: open }, 'alpha', never))?.map((r) => [r.filePath, r.lineNumber]);
    expect(await rows(todo)).toEqual([[todo, 1], [kept, 1]]);
    expect(await rows(hidden)).toEqual([[hidden, 1], [kept, 1]]);
    expect(await rows(dep)).toEqual([[dep, 1], [kept, 1]]);
    expect(await rows(setup)).toEqual([[kept, 1]]);
  });

  it('keeps an open document over 2 MB in the cache, counted at its size', async () => {
    const big = bigFile('big.md');
    const reads = vi.spyOn(fsp, 'readFile');
    await searchFiles({ rootPath: null, filePath: big }, 'alpha', never);
    expect((await searchFiles({ rootPath: null, filePath: big }, 'again', never))?.map((r) => r.lineNumber)).toEqual([3]);
    expect(reads).toHaveBeenCalledTimes(1);
    const { counted, held } = cacheTotals();
    expect(counted).toBe(held);
  });

  it('skips an open document that has grown past the 10 MB read cap', async () => {
    const huge = sparse('huge.md', 10 * MB + 1, '\nalpha\n');
    expect(await searchFiles({ rootPath: null, filePath: huge }, 'alpha', never)).toEqual([]);
  });
});
