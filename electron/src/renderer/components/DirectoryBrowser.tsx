import React, { useState, useMemo, useCallback } from 'react';
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
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tree = e.currentTarget;
    const items = Array.from(tree.querySelectorAll<HTMLElement>('button.tree-item, button.tree-folder'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const currentButton = items[currentIndex];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(currentIndex + 1, items.length - 1);
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(currentIndex - 1, 0);
      items[prev]?.focus();
    } else if (e.key === 'ArrowRight') {
      if (currentButton?.classList.contains('tree-folder')) {
        const li = currentButton.closest('li');
        if (li?.getAttribute('aria-expanded') === 'false') {
          e.preventDefault();
          currentButton.click();
        }
      }
    } else if (e.key === 'ArrowLeft') {
      if (currentButton?.classList.contains('tree-folder')) {
        const li = currentButton.closest('li');
        if (li?.getAttribute('aria-expanded') === 'true') {
          e.preventDefault();
          currentButton.click();
        }
      }
    }
  }, []);

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
      <ul className="sidebar-tree" role="tree" onKeyDown={handleTreeKeyDown}>
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
      </ul>
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
  const handleClick = (e: React.MouseEvent) => {
    const modifierPressed = e.metaKey || e.ctrlKey;
    if (modifierPressed) {
      e.preventDefault();
      window.electronAPI.openInNewWindow(entry.path);
      return;
    }
    onSelect(entry.path);
  };
  return (
    <li role="treeitem" aria-current={entry.path === activePath ? 'page' : undefined}>
      <button
        className={`tree-item${nested ? ' tree-item-nested' : ''}${entry.path === activePath ? ' active' : ''}`}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry.path)}
        title={entry.path}
      >
        <span className="tree-item-name">{entry.name}</span>
      </button>
    </li>
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
    <li role="treeitem" aria-expanded={expanded} className="tree-folder-group">
      <button className="tree-folder" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          className={`tree-folder-chevron${expanded ? ' expanded' : ''}`}
        />
        <span className="tree-folder-name">{entry.name}</span>
        <span className="badge">{totalCount}</span>
      </button>
      {expanded && (
        <ul role="group">
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
        </ul>
      )}
    </li>
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
