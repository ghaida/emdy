import React, { useMemo } from 'react';
import type { FileEntry } from '../lib/types';

interface DirectoryBrowserProps {
  entries: FileEntry[];
  activePath: string | null;
  rootPath: string | null;
  onFileSelect: (filePath: string) => void;
  onFileContextMenu: (e: React.MouseEvent, filePath: string) => void;
}

export function DirectoryBrowser({ entries, activePath, rootPath, onFileSelect, onFileContextMenu }: DirectoryBrowserProps) {
  const flatFiles = useMemo(() => flattenFiles(entries), [entries]);

  const getRelativePath = (filePath: string): string | null => {
    if (!rootPath) return null;
    const rel = filePath.replace(rootPath, '').replace(/^\//, '');
    const dir = rel.split('/').slice(0, -1).join('/');
    return dir || null;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-tree">
        {flatFiles.map((file) => {
          const relPath = getRelativePath(file.path);
          return (
            <button
              key={file.path}
              className={`tree-item${file.path === activePath ? ' active' : ''}`}
              onClick={() => onFileSelect(file.path)}
              onContextMenu={(e) => onFileContextMenu(e, file.path)}
              title={file.path}
            >
              <span className="tree-item-name">{file.name}</span>
              {relPath && <span className="tree-item-path">{relPath}</span>}
            </button>
          );
        })}
        {flatFiles.length === 0 && (
          <div className="sidebar-empty">No Markdown files</div>
        )}
      </div>
    </div>
  );
}

interface FlatFile extends FileEntry {
  depth: number;
}

function flattenFiles(entries: FileEntry[]): FlatFile[] {
  const result: FlatFile[] = [];
  collect(entries, 0, result);
  result.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });
  return result;
}

function collect(entries: FileEntry[], depth: number, result: FlatFile[]) {
  for (const entry of entries) {
    if (entry.isDirectory && entry.children) {
      collect(entry.children, depth + 1, result);
    } else if (!entry.isDirectory) {
      result.push({ ...entry, depth });
    }
  }
}
