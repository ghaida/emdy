// The command palette's search. Names first, then contents, each alphabetical
// with the open file ahead of the rest; file text is cached by mtime and size
// so a query stats files instead of re-reading them; a query that's been
// superseded stops between files. The folder walk skips files over 2 MB, but
// the open document is searched whatever the walk makes of it, up to the
// 10 MB cap it was opened under: find is reached only through the palette.
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SearchResult, SearchScope } from '../renderer/lib/types';
import { isTextDocument } from '../shared/paths';
import { MAX_FILE_BYTES } from './read-text';
import { IGNORED_DIRS } from './scan-directory';

const MD_FILE = /\.(md|markdown)$/i;
const MAX_SEARCH_FILE_BYTES = 2 * 1024 * 1024;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_RESULTS = 50;
const SNIPPETS_PER_FILE = 3;
const MAX_COUNT_PER_FILE = 1000;
const SNIPPET_CHARS = 120;

interface CacheEntry {
  mtimeMs: number;
  size: number;
  text: string;
}

// Insertion order doubles as age: the oldest entry is the first key.
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

/**
 * What the text cache has counted against its cap, and what its entries add
 * up to. The two match unless the count has drifted. For tests.
 */
export function cacheTotals(): { counted: number; held: number } {
  let held = 0;
  for (const entry of cache.values()) held += entry.size * 2;
  return { counted: cacheBytes, held };
}

// The newest query generation each window (by webContents id) has sent.
const newestGeneration = new Map<number, number>();

/**
 * Records `generation` as the newest query from `sender` and returns a check
 * that turns true once that window registers a newer one. An empty query
 * registers too, which is how a cleared field or a closed palette stops the
 * search in flight.
 */
export function registerSearch(sender: number, generation: number): () => boolean {
  newestGeneration.set(sender, generation);
  return () => newestGeneration.get(sender) !== generation;
}

async function listFiles(dir: string, out: string[]): Promise<void> {
  let items;
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const item of items) {
    if (item.name.startsWith('.') || IGNORED_DIRS.has(item.name) || item.isSymbolicLink()) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await listFiles(full, out);
    else if (item.isFile() && MD_FILE.test(item.name)) out.push(full);
  }
}

// The listing skips links, but the open file can be one. It's judged by where
// it leads, so a setup.md that links to .env isn't searched.
async function leadsToTextDocument(filePath: string): Promise<boolean> {
  try {
    return isTextDocument(await fs.realpath(filePath));
  } catch {
    return false; // missing, or a broken link
  }
}

// The cache counts every entry at twice its size on disk, whatever the cap it
// was read under, so the open document (up to 10 MB, 20 MB counted) stays in
// it like any other file and isn't read again for every query.
async function loadText(file: string, maxBytes: number): Promise<CacheEntry | null> {
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > maxBytes) return null;
  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
  let text: string;
  try {
    text = await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }
  const entry: CacheEntry = { mtimeMs: stat.mtimeMs, size: stat.size, text };
  // Another search may have loaded this file while this one was reading it,
  // so the entry being replaced is whatever the cache holds now.
  const previous = cache.get(file);
  if (previous) cacheBytes -= previous.size * 2;
  cache.delete(file);
  cache.set(file, entry);
  cacheBytes += stat.size * 2;
  for (const [key, old] of cache) {
    if (cacheBytes <= MAX_CACHE_BYTES) break;
    cache.delete(key);
    cacheBytes -= old.size * 2;
  }
  return entry;
}

// Where each line of `text` starts. Found once per file that has a match.
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

// The 1-based line holding `index`, and its text up to SNIPPET_CHARS: a binary
// search for the last line start at or before `index`.
function lineAt(text: string, starts: number[], index: number): { number: number; text: string } {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= index) low = mid;
    else high = mid - 1;
  }
  const start = starts[low];
  const end = low + 1 < starts.length ? starts[low + 1] - 1 : text.length;
  return { number: low + 1, text: text.slice(start, Math.min(end, start + SNIPPET_CHARS)) };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Results for the palette, or null when `isStale` reported that a newer query
 * has arrived. `query` is matched case-insensitively as plain text, on the
 * original text as find does: offsets in a lowercased copy drift, because
 * 'İ'.toLowerCase() is two UTF-16 units.
 */
export async function searchFiles(scope: SearchScope, query: string, isStale: () => boolean): Promise<SearchResult[] | null> {
  if (!query.trim()) return [];
  const source = escapeRegExp(query);
  const inName = new RegExp(source, 'iu');
  const inText = new RegExp(source, 'giu');
  const files: string[] = [];
  if (scope.rootPath) await listFiles(scope.rootPath, files);
  // The open document goes first, and is searched where the walk leaves it
  // out too: a .txt, a file under a dot or ignored folder, a link (judged by
  // where it leads).
  const open = scope.filePath;
  if (open) {
    const i = files.indexOf(open);
    if (i !== -1) files.splice(i, 1);
    if (i !== -1 || (await leadsToTextDocument(open))) files.unshift(open);
  }

  const names: SearchResult[] = [];
  for (const file of files) {
    const fileName = path.basename(file);
    if (inName.test(fileName)) names.push({ filePath: file, fileName, type: 'file' });
    if (names.length >= MAX_RESULTS) break;
  }

  const contents: SearchResult[] = [];
  for (const file of files) {
    if (isStale()) return null;
    if (contents.length >= MAX_RESULTS) break;
    const entry = await loadText(file, file === open ? MAX_FILE_BYTES : MAX_SEARCH_FILE_BYTES);
    if (!entry) continue;
    const fileName = path.basename(file);
    let matchCount = 0;
    const snippets: SearchResult[] = [];
    let starts: number[] | null = null;
    inText.lastIndex = 0;
    let match: RegExpExecArray | null;
    while (matchCount < MAX_COUNT_PER_FILE && (match = inText.exec(entry.text)) !== null) {
      matchCount++;
      if (snippets.length < SNIPPETS_PER_FILE) {
        starts ??= lineStarts(entry.text);
        const line = lineAt(entry.text, starts, match.index);
        if (!snippets.some((s) => s.lineNumber === line.number)) {
          snippets.push({ filePath: file, fileName, matchLine: line.text, lineNumber: line.number, type: 'content' });
        }
      }
    }
    for (const snippet of snippets) {
      if (contents.length >= MAX_RESULTS) break;
      snippet.matchCount = matchCount;
      contents.push(snippet);
    }
  }

  // 1.8.1's order within each group: alphabetical by name, with the open
  // file's rows first. The sort is stable, so a file's rows stay in line order.
  const openFirst = (r: SearchResult) => (r.filePath === scope.filePath ? 0 : 1);
  const order = (a: SearchResult, b: SearchResult) => openFirst(a) - openFirst(b) || a.fileName.localeCompare(b.fileName);
  return [...names.sort(order), ...contents.sort(order)];
}
