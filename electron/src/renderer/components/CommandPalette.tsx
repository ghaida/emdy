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

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onFileSelect: (filePath: string) => void;
}

export function CommandPalette({ visible, onClose, onFileSelect }: CommandPaletteProps) {
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
    if (visible && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [visible]);

  // Close on Escape even if input doesn't have focus
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

  const handleSelect = useCallback((result: SearchResult) => {
    onFileSelect(result.filePath);
    onClose();
  }, [onFileSelect, onClose]);

  // Group results by type and build a flat list with group headers
  const { flatItems, resultIndices } = useMemo(() => {
    const fileResults = results.filter((r) => r.type === 'file');
    const contentResults = results.filter((r) => r.type === 'content');

    const flatItems: ({ kind: 'header'; label: string } | { kind: 'result'; result: SearchResult })[] = [];
    const resultIndices: number[] = []; // maps flat index to results array index

    let resultIdx = 0;
    if (fileResults.length > 0) {
      flatItems.push({ kind: 'header', label: 'Files' });
      for (const r of fileResults) {
        flatItems.push({ kind: 'result', result: r });
        resultIndices.push(results.indexOf(r));
      }
    }
    if (contentResults.length > 0) {
      flatItems.push({ kind: 'header', label: 'Content' });
      for (const r of contentResults) {
        flatItems.push({ kind: 'result', result: r });
        resultIndices.push(results.indexOf(r));
      }
    }

    return { flatItems, resultIndices };
  }, [results]);

  // Map selectedIndex (over all results) to the flat item for keyboard nav
  const selectableResults = flatItems.filter((item) => item.kind === 'result');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, selectableResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && selectableResults[selectedIndex]) {
      const item = selectableResults[selectedIndex];
      if (item.kind === 'result') handleSelect(item.result);
    }
  };

  // Precompute a selectable index for each flat item
  const selectableIndexMap = useMemo(() => {
    const map: number[] = [];
    let idx = -1;
    for (const item of flatItems) {
      if (item.kind === 'result') idx++;
      map.push(idx);
    }
    return map;
  }, [flatItems]);

  if (!mounted) return null;

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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files and content..."
            className="command-palette-input"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls="command-palette-listbox"
            aria-activedescendant={selectedIndex >= 0 && flatItems.length > 0 ? `command-palette-option-${selectedIndex}` : undefined}
            aria-autocomplete="list"
          />
          {searching && <span className="command-palette-spinner" />}
        </div>
        {flatItems.length > 0 && (
          <div className="command-palette-results" role="listbox" id="command-palette-listbox">
            {flatItems.map((item, i) => {
              if (item.kind === 'header') {
                return (
                  <div key={`header-${item.label}`} className="command-palette-group-header" role="presentation">
                    {item.label}
                  </div>
                );
              }
              const idx = selectableIndexMap[i];
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={`${item.result.filePath}:${item.result.lineNumber ?? 'file'}`}
                  className={`command-palette-result${isSelected ? ' selected' : ''}`}
                  onClick={() => handleSelect(item.result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="option"
                  id={`command-palette-option-${idx}`}
                  aria-selected={isSelected}
                >
                  <span className="command-palette-result-file">{item.result.fileName}</span>
                  {item.result.matchLine && (
                    <span className="command-palette-result-line">
                      {item.result.lineNumber && <span className="command-palette-result-lineno">:{item.result.lineNumber}</span>}
                      {' '}{item.result.matchLine.trim()}
                    </span>
                  )}
                </button>
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
