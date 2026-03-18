import React, { useState, useEffect, useRef, useCallback } from 'react';

interface FindBarProps {
  visible: boolean;
  onClose: () => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export function FindBar({ visible, onClose, contentRef }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const clearHighlights = useCallback(() => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll('mark[data-find]');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  }, [contentRef]);

  const highlightMatches = useCallback((searchText: string) => {
    clearHighlights();
    if (!searchText.trim() || !contentRef.current) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
      null,
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      textNodes.push(node);
    }

    let count = 0;
    const lowerQuery = searchText.toLowerCase();

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);

      if (idx === -1) continue;

      const frag = document.createDocumentFragment();
      let lastIdx = 0;

      while (idx !== -1) {
        if (idx > lastIdx) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        }
        const mark = document.createElement('mark');
        mark.setAttribute('data-find', String(count));
        mark.textContent = text.slice(idx, idx + searchText.length);
        mark.style.background = 'var(--accent)';
        mark.style.color = 'white';
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 1px';
        frag.appendChild(mark);
        count++;
        lastIdx = idx + searchText.length;
        idx = lowerText.indexOf(lowerQuery, lastIdx);
      }

      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }

      textNode.parentNode?.replaceChild(frag, textNode);
    }

    setMatchCount(count);
    setCurrentMatch(count > 0 ? 1 : 0);

    // Scroll to first match
    if (count > 0) {
      scrollToMatch(0);
    }
  }, [contentRef, clearHighlights]);

  const scrollToMatch = (index: number) => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll('mark[data-find]');
    marks.forEach((m, i) => {
      (m as HTMLElement).style.background = i === index ? 'var(--accent)' : 'var(--accent-warm)';
      (m as HTMLElement).style.opacity = i === index ? '1' : '0.5';
    });
    if (marks[index]) {
      marks[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const goToNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = currentMatch < matchCount ? currentMatch : 1;
    setCurrentMatch(next);
    scrollToMatch(next - 1);
  }, [matchCount, currentMatch]);

  const goToPrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = currentMatch > 1 ? currentMatch - 1 : matchCount;
    setCurrentMatch(prev);
    scrollToMatch(prev - 1);
  }, [matchCount, currentMatch]);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
    if (!visible) {
      clearHighlights();
      setQuery('');
      setMatchCount(0);
      setCurrentMatch(0);
    }
  }, [visible, clearHighlights]);

  useEffect(() => {
    const timeout = setTimeout(() => highlightMatches(query), 150);
    return () => clearTimeout(timeout);
  }, [query, highlightMatches]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) goToPrev();
      else goToNext();
    }
  };

  if (!visible) return null;

  return (
    <div className="find-bar">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in document..."
        className="find-input"
      />
      <span className="find-count">
        {matchCount > 0 ? `${currentMatch}/${matchCount}` : query ? 'No matches' : ''}
      </span>
      <button className="find-btn" onClick={goToPrev} title="Previous (Shift+Enter)">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 7l3-4 3 4" />
        </svg>
      </button>
      <button className="find-btn" onClick={goToNext} title="Next (Enter)">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3l3 4 3-4" />
        </svg>
      </button>
      <button className="find-btn" onClick={onClose} title="Close (Esc)">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </div>
  );
}
