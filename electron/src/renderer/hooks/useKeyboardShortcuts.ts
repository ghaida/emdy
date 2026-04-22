import { useEffect } from 'react';

interface ShortcutHandlers {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onOpen: () => void;
  onFind?: () => void;
  onNextMatch?: () => void;
  onPrevMatch?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handlers.onZoomIn();
      } else if (meta && e.key === '-') {
        e.preventDefault();
        handlers.onZoomOut();
      } else if (meta && e.key === '0') {
        e.preventDefault();
        handlers.onZoomReset();
      } else if (meta && e.key === 'o' && !e.shiftKey) {
        e.preventDefault();
        handlers.onOpen();
      } else if (meta && e.key === 'f' && handlers.onFind) {
        e.preventDefault();
        handlers.onFind();
      } else if (meta && e.key === 'g' && !e.shiftKey && handlers.onNextMatch) {
        e.preventDefault();
        handlers.onNextMatch();
      } else if (meta && e.key === 'g' && e.shiftKey && handlers.onPrevMatch) {
        e.preventDefault();
        handlers.onPrevMatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
