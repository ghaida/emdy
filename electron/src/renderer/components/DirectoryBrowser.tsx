import React, { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { FileEntry } from '../lib/types';

interface DirectoryBrowserProps {
  entries: FileEntry[];
  activePath: string | null;
  rootPath: string | null;
  onFileSelect: (filePath: string) => void;
  onFileContextMenu: (e: React.MouseEvent, filePath: string) => void;
}

export function DirectoryBrowser({ entries, activePath, onFileSelect, onFileContextMenu }: DirectoryBrowserProps) {
  const { rootFiles, folders } = useMemo(() => {
    const rootFiles: FileEntry[] = [];
    const folders: FileEntry[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) folders.push(entry);
      else rootFiles.push(entry);
    }
    rootFiles.sort((a, b) => a.name.localeCompare(b.name));
    folders.sort((a, b) => a.name.localeCompare(b.name));
    return { rootFiles, folders };
  }, [entries]);

  return (
    <div className="sidebar">
      <div className="sidebar-heading">Files</div>
      <div className="sidebar-tree">
        {rootFiles.map((file) => (
          <FileItem
            key={file.path}
            entry={file}
            activePath={activePath}
            onSelect={onFileSelect}
            onContextMenu={onFileContextMenu}
          />
        ))}
        {folders.map((folder) => (
          <FolderItem
            key={folder.path}
            entry={folder}
            activePath={activePath}
            onSelect={onFileSelect}
            onContextMenu={onFileContextMenu}
          />
        ))}
        {rootFiles.length === 0 && folders.length === 0 && (
          <div className="sidebar-empty">No Markdown files</div>
        )}
      </div>
    </div>
  );
}

function FileItem({ entry, activePath, nested, onSelect, onContextMenu }: {
  entry: FileEntry;
  activePath: string | null;
  nested?: boolean;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}) {
  return (
    <button
      className={`tree-item${nested ? ' tree-item-nested' : ''}${entry.path === activePath ? ' active' : ''}`}
      onClick={() => onSelect(entry.path)}
      onContextMenu={(e) => onContextMenu(e, entry.path)}
      title={entry.path}
    >
      <span className="tree-item-name">{entry.name}</span>
    </button>
  );
}

function FolderItem({ entry, activePath, onSelect, onContextMenu }: {
  entry: FileEntry;
  activePath: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { files, subfolders } = useMemo(() => {
    const files: FileEntry[] = [];
    const subfolders: FileEntry[] = [];
    for (const child of entry.children || []) {
      if (child.isDirectory) subfolders.push(child);
      else files.push(child);
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    subfolders.sort((a, b) => a.name.localeCompare(b.name));
    return { files, subfolders };
  }, [entry.children]);

  const totalCount = useMemo(() => countFiles(entry.children || []), [entry.children]);

  if (totalCount === 0) return null;

  return (
    <div className="tree-folder-group">
      <button className="tree-folder" onClick={() => setExpanded((v) => !v)}>
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          className={`tree-folder-chevron${expanded ? ' expanded' : ''}`}
        />
        <span className="tree-folder-name">{entry.name}</span>
        <span className="badge">{totalCount}</span>
      </button>
      {expanded && (
        <>
          {files.map((file) => (
            <FileItem
              key={file.path}
              entry={file}
              activePath={activePath}
              nested
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
          {subfolders.map((sub) => (
            <FolderItem
              key={sub.path}
              entry={sub}
              activePath={activePath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </div>
  );
}

function countFiles(entries: FileEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.isDirectory && entry.children) {
      count += countFiles(entry.children);
    } else if (!entry.isDirectory) {
      count++;
    }
  }
  return count;
}
