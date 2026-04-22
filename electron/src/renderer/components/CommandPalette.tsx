import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { perfMark, perfMeasure } from '../lib/perf';
import { useTransition } from '../hooks/useTransition';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAnnounce } from '../hooks/useAnnounce';

interface SearchResult {
  filePath: string;
  fileName: string;
  matchLine?: string;
  lineNumber?: number;
  type: 'file' | 'content';
}

type RenderableRow =
  | { kind: 'legacy-file'; filePath: string; fileName: string }
  | {
      kind: 'legacy-content';
      filePath: string;
      fileName: string;
      lineNumber: number;
      matchLine: string;
    }
  | { kind: 'in-file'; filePath: string; lineNumber: number; matchLine: string }
  | {
      kind: 'aggregated';
      filePath: string;
      fileName: string;
      matchCount: number;
      firstMatchSnippet: string;
      firstMatchLineNumber: number;
      subtitle: string | null;
    };

type PaletteItem =
  | { kind: 'header'; label: string; headerKey: string }
  | { kind: 'row'; row: RenderableRow; rowKey: string };

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onFileSelect: (filePath: string) => void;
  onFileSelectWithQuery?: (filePath: string, query: string, lineNumber?: number) => void;
  currentFilePath?: string | null;
  rootPath?: string | null;
}

const MATCH_COUNT_DISPLAY_CAP = 1000;

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

function relativeDir(filePath: string, rootPath: string | null): string {
  const dir = dirname(filePath);
  if (rootPath && dir.startsWith(rootPath)) {
    return dir.slice(rootPath.length).replace(/^\//, '');
  }
  return dir;
}

function formatMatchCount(count: number): string {
  if (count >= MATCH_COUNT_DISPLAY_CAP) return '1,000+ matches';
  if (count === 1) return '1 match';
  return `${count} matches`;
}

export function CommandPalette({
  visible,
  onClose,
  onFileSelect,
  onFileSelectWithQuery,
  currentFilePath,
  rootPath,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { mounted, active } = useTransition(visible);
  useFocusTrap(modalRef, visible);
  const { announce } = useAnnounce();

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [visible]);

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      if (node && visible) node.focus();
    },
    [visible]
  );

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      perfMark('search-start');
      const searchResults = await window.electronAPI.searchEverything(q);
      perfMeasure('search', 'search-start');
      setResults(searchResults);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 200);
    return () => clearTimeout(timeout);
  }, [query, search]);

  useEffect(() => {
    if (!visible) return;
    if (query.length === 0) return;
    const count = results.length;
    if (count > 0) {
      announce(`${count} result${count === 1 ? '' : 's'}`);
    } else if (!searching) {
      announce('No results');
    }
  }, [results, searching, visible, query, announce]);

  const flatItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    if (results.length === 0) return items;

    if (currentFilePath) {
      const currentFolder = dirname(currentFilePath);

      const inThisFile: SearchResult[] = [];
      const sameFolderResults: SearchResult[] = [];
      const otherFolderResults: SearchResult[] = [];
      for (const r of results) {
        if (r.type === 'content' && r.filePath === currentFilePath) {
          inThisFile.push(r);
        } else if (r.filePath !== currentFilePath && dirname(r.filePath) === currentFolder) {
          sameFolderResults.push(r);
        } else if (r.filePath !== currentFilePath) {
          otherFolderResults.push(r);
        }
      }

      if (inThisFile.length > 0) {
        items.push({ kind: 'header', label: 'In this file', headerKey: 'h-in-file' });
        for (const r of inThisFile) {
          if (r.lineNumber === undefined || r.matchLine === undefined) continue;
          items.push({
            kind: 'row',
            rowKey: `in-file:${r.filePath}:${r.lineNumber}`,
            row: {
              kind: 'in-file',
              filePath: r.filePath,
              lineNumber: r.lineNumber,
              matchLine: r.matchLine,
            },
          });
        }
      }

      type AggregatedRow = Extract<RenderableRow, { kind: 'aggregated' }>;
      const aggregated = (group: SearchResult[]): AggregatedRow[] => {
        const byPath = new Map<string, { row: AggregatedRow }>();
        for (const r of group) {
          if (r.type !== 'content') continue;
          const existing = byPath.get(r.filePath);
          if (existing) {
            existing.row.matchCount = Math.min(existing.row.matchCount + 1, MATCH_COUNT_DISPLAY_CAP);
          } else {
            byPath.set(r.filePath, {
              row: {
                kind: 'aggregated',
                filePath: r.filePath,
                fileName: r.fileName,
                matchCount: 1,
                firstMatchSnippet: r.matchLine ?? '',
                firstMatchLineNumber: r.lineNumber ?? 1,
                subtitle: null,
              },
            });
          }
        }
        for (const r of group) {
          if (r.type !== 'file') continue;
          if (byPath.has(r.filePath)) continue;
          byPath.set(r.filePath, {
            row: {
              kind: 'aggregated',
              filePath: r.filePath,
              fileName: r.fileName,
              matchCount: 0,
              firstMatchSnippet: '',
              firstMatchLineNumber: 0,
              subtitle: null,
            },
          });
        }
        return Array.from(byPath.values()).map((v) => v.row);
      };

      const sameFolderRows = aggregated(sameFolderResults);
      if (sameFolderRows.length > 0) {
        items.push({ kind: 'header', label: 'Other files in this folder', headerKey: 'h-same-folder' });
        for (const row of sameFolderRows) {
          items.push({
            kind: 'row',
            rowKey: `agg-same:${row.filePath}`,
            row: { ...row, subtitle: row.matchCount > 0 ? row.firstMatchSnippet : null },
          });
        }
      }

      const otherFolderRows = aggregated(otherFolderResults);
      if (otherFolderRows.length > 0) {
        items.push({ kind: 'header', label: 'Other folders', headerKey: 'h-other-folder' });
        for (const row of otherFolderRows) {
          items.push({
            kind: 'row',
            rowKey: `agg-other:${row.filePath}`,
            row: { ...row, subtitle: relativeDir(row.filePath, rootPath ?? null) || '/' },
          });
        }
      }

      return items;
    }

    const fileResults = results.filter((r) => r.type === 'file');
    const contentResults = results.filter((r) => r.type === 'content');

    if (fileResults.length > 0) {
      items.push({ kind: 'header', label: 'Files', headerKey: 'h-files' });
      for (const r of fileResults) {
        items.push({
          kind: 'row',
          rowKey: `legacy-file:${r.filePath}`,
          row: { kind: 'legacy-file', filePath: r.filePath, fileName: r.fileName },
        });
      }
    }
    if (contentResults.length > 0) {
      items.push({ kind: 'header', label: 'Content', headerKey: 'h-content' });
      for (const r of contentResults) {
        if (r.lineNumber === undefined || r.matchLine === undefined) continue;
        items.push({
          kind: 'row',
          rowKey: `legacy-content:${r.filePath}:${r.lineNumber}`,
          row: {
            kind: 'legacy-content',
            filePath: r.filePath,
            fileName: r.fileName,
            lineNumber: r.lineNumber,
            matchLine: r.matchLine,
          },
        });
      }
    }

    return items;
  }, [results, currentFilePath, rootPath]);

  const selectableRows = useMemo(
    () => flatItems.filter((item): item is Extract<PaletteItem, { kind: 'row' }> => item.kind === 'row'),
    [flatItems]
  );

  const selectableIndexMap = useMemo(() => {
    const map: number[] = [];
    let idx = -1;
    for (const item of flatItems) {
      if (item.kind === 'row') idx++;
      map.push(idx);
    }
    return map;
  }, [flatItems]);

  const dispatchSelection = useCallback(
    (row: RenderableRow) => {
      const dispatch = onFileSelectWithQuery;
      if (dispatch) {
        if (row.kind === 'in-file' || row.kind === 'legacy-content') {
          dispatch(row.filePath, query, row.lineNumber);
        } else {
          dispatch(row.filePath, query);
        }
      } else {
        onFileSelect(row.filePath);
      }
      onClose();
    },
    [onFileSelectWithQuery, onFileSelect, onClose, query]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, selectableRows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = selectableRows[selectedIndex];
      if (item) dispatchSelection(item.row);
    }
  };

  if (!mounted) return null;

  const placeholder = currentFilePath
    ? 'Search this file and folder…'
    : 'Search files and content…';

  return (
    <div className={`command-palette-overlay${active ? ' active' : ''}`} onClick={onClose}>
      <div
        ref={modalRef}
        className={`command-palette${active ? ' active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search files and content"
      >
        <div className="command-palette-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="command-palette-icon">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l4 4" />
          </svg>
          <input
            ref={setInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="command-palette-input"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="command-palette-listbox"
            aria-activedescendant={
              selectedIndex >= 0 && selectableRows.length > 0
                ? `command-palette-option-${selectedIndex}`
                : undefined
            }
            aria-autocomplete="list"
          />
          {searching && <span className="command-palette-spinner" />}
        </div>
        {flatItems.length > 0 && (
          <div className="command-palette-results" role="listbox" id="command-palette-listbox">
            {flatItems.map((item, i) => {
              if (item.kind === 'header') {
                return (
                  <div key={item.headerKey} className="command-palette-group-header" role="presentation">
                    {item.label}
                  </div>
                );
              }
              const idx = selectableIndexMap[i];
              const isSelected = idx === selectedIndex;
              return (
                <PaletteRow
                  key={item.rowKey}
                  row={item.row}
                  isSelected={isSelected}
                  id={`command-palette-option-${idx}`}
                  onSelect={() => dispatchSelection(item.row)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              );
            })}
          </div>
        )}
        {query && !searching && results.length === 0 && (
          <div className="command-palette-empty">No results</div>
        )}
      </div>
    </div>
  );
}

interface PaletteRowProps {
  row: RenderableRow;
  isSelected: boolean;
  id: string;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function PaletteRow({ row, isSelected, id, onSelect, onMouseEnter }: PaletteRowProps) {
  const isTwoLine = row.kind === 'aggregated';
  const className = `command-palette-result${isTwoLine ? ' command-palette-result-stacked' : ''}${
    isSelected ? ' selected' : ''
  }`;
  return (
    <button
      className={className}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      role="option"
      id={id}
      aria-selected={isSelected}
    >
      {row.kind === 'legacy-file' && (
        <span className="command-palette-result-file">{row.fileName}</span>
      )}
      {row.kind === 'legacy-content' && (
        <>
          <span className="command-palette-result-file">{row.fileName}</span>
          <span className="command-palette-result-line">
            <span className="command-palette-result-lineno">:{row.lineNumber}</span>{' '}
            {row.matchLine.trim()}
          </span>
        </>
      )}
      {row.kind === 'in-file' && (
        <>
          <span className="command-palette-result-lineno">:{row.lineNumber}</span>
          <span className="command-palette-result-line">{row.matchLine.trim()}</span>
        </>
      )}
      {row.kind === 'aggregated' && (
        <>
          <span className="command-palette-result-row-top">
            <span className="command-palette-result-file">{row.fileName}</span>
            {row.matchCount > 0 && (
              <span className="command-palette-result-count">{formatMatchCount(row.matchCount)}</span>
            )}
          </span>
          {row.subtitle && (
            <span className="command-palette-result-subtitle">{row.subtitle.trim()}</span>
          )}
        </>
      )}
    </button>
  );
}
