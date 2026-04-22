import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTransition } from '../hooks/useTransition';
import { useAnnounce } from '../hooks/useAnnounce';

export type FindBarMode = 'multi-persistent' | 'zero' | 'over-cap';

interface FindBarProps {
  visible: boolean;
  query: string;
  currentIndex: number;
  totalMatches: number;
  isCapped: boolean;
  mode: FindBarMode;
  pulseNonce?: number;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function FindBar({
  visible,
  query,
  currentIndex,
  totalMatches,
  isCapped,
  mode,
  pulseNonce,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: FindBarProps) {
  const { mounted, active } = useTransition(visible);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const { announce } = useAnnounce();
  const [pulsing, setPulsing] = useState(false);
  const [inputValue, setInputValue] = useState(query);
  const lastExternalQueryRef = useRef(query);

  useEffect(() => {
    if (query !== lastExternalQueryRef.current) {
      lastExternalQueryRef.current = query;
      setInputValue(query);
    }
  }, [query]);

  useEffect(() => {
    if (!visible) return;
    previousFocusRef.current = document.activeElement;
    const frame = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    if (prev instanceof HTMLElement && document.contains(prev)) {
      prev.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'zero' || totalMatches === 0) {
      announce('No matches');
      return;
    }
    const term = query.trim();
    const description = term ? `for ${term}` : '';
    announce(`Find bar opened. ${totalMatches} matches ${description}`.trim() + '.');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pulseNonce === undefined || pulseNonce === 0) return;
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), 200);
    return () => clearTimeout(timer);
  }, [pulseNonce]);

  if (!mounted) return null;

  const cycleDisabled = totalMatches <= 1 || mode === 'zero';
  const phase = !visible ? 'exiting' : !active ? 'entering' : '';

  const showCappedCounter = isCapped || mode === 'over-cap';
  const counterText = (() => {
    if (mode === 'zero' || totalMatches === 0) return 'No matches';
    const display = currentIndex + 1;
    if (showCappedCounter) return `${display} of 1,000+`;
    return `${display} of ${totalMatches}`;
  })();
  const counterTooltip = showCappedCounter
    ? 'Showing first 1,000 matches. Refine your search to see more.'
    : undefined;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (cycleDisabled) return;
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleBarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="find-bar-wrapper">
      <div
        className={`find-bar${phase ? ` ${phase}` : ''}`}
        role="search"
        aria-label="Find in document"
        onKeyDown={handleBarKeyDown}
      >
        <input
          ref={inputRef}
          type="text"
          className="find-bar-input"
          value={inputValue}
          placeholder="Find in document"
          aria-label="Find in document"
          aria-describedby="find-bar-counter"
          onChange={(e) => {
            const v = e.target.value;
            setInputValue(v);
            lastExternalQueryRef.current = v;
            onQueryChange(v);
          }}
          onKeyDown={handleInputKeyDown}
        />
        <span
          id="find-bar-counter"
          className={`find-bar-counter${pulsing ? ' pulse' : ''}`}
          aria-live="polite"
          aria-atomic="true"
          title={counterTooltip}
        >
          {counterText}
        </span>
        <div className="find-bar-nav">
          <button
            type="button"
            className="find-bar-btn"
            aria-label="Previous match"
            onClick={onPrev}
            disabled={cycleDisabled}
          >
            <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="find-bar-btn"
            aria-label="Next match"
            onClick={onNext}
            disabled={cycleDisabled}
          >
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="find-bar-btn"
          aria-label="Close find bar"
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
