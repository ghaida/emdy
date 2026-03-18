import React, { useState, useEffect, useRef, useCallback } from 'react';

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

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [visible]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const searchResults = await window.electronAPI.searchEverything(q);
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

  const handleSelect = useCallback((result: SearchResult) => {
    onFileSelect(result.filePath);
    onClose();
  }, [onFileSelect, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!visible) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
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
          />
          {searching && <span className="command-palette-spinner" />}
        </div>
        {results.length > 0 && (
          <div className="command-palette-results">
            {results.map((result, i) => (
              <button
                key={`${result.filePath}:${result.lineNumber ?? 'file'}`}
                className={`command-palette-result${i === selectedIndex ? ' selected' : ''}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="command-palette-result-file">{result.fileName}</span>
                {result.matchLine && (
                  <span className="command-palette-result-line">
                    {result.lineNumber && <span className="command-palette-result-lineno">:{result.lineNumber}</span>}
                    {' '}{result.matchLine.trim()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {query && !searching && results.length === 0 && (
          <div className="command-palette-empty">No results</div>
        )}
      </div>
    </div>
  );
}
