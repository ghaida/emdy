import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../renderer/lib/types';

export const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.vite', '__pycache__',
  'vendor', '.git', '.svn', 'coverage', '.next', '.nuxt',
]);

export async function scanDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || IGNORED_DIRS.has(item.name) || item.isSymbolicLink()) continue;
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const children = await scanDirectory(fullPath);
        if (children.length > 0) {
          entries.push({ name: item.name, path: fullPath, isDirectory: true, children });
        }
      } else if (/\.(md|markdown)$/i.test(item.name)) {
        entries.push({ name: item.name, path: fullPath, isDirectory: false });
      }
    }
  } catch {
    // Permission denied or similar
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}
