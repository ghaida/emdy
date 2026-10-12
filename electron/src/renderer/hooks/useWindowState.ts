import { useEffect, type RefObject } from 'react';

const SCROLL_REPORT_DELAY_MS = 500;

interface WindowStateOptions {
  filePath: string | null;
  dirPath: string | null;
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** Returns the scroll position to report. */
  getScrollTop: () => number;
}

/**
 * Tells the main process what this window shows, so files opened from outside
 * only go to windows that are still empty and the window can come back after
 * a restart. A window on the welcome screen reports nothing.
 */
export function useWindowState({ filePath, dirPath, scrollContainerRef, getScrollTop }: WindowStateOptions) {
  useEffect(() => {
    if (filePath === null && dirPath === null) return;
    const report = () => {
      window.electronAPI.reportWindowState({ filePath, dirPath, scrollTop: getScrollTop() });
    };
    report();

    // Scroll events don't bubble, and the content area remounts when the
    // spinner or an error replaces it, so listen on the document in the
    // capture phase and check the target.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = (event: Event) => {
      if (event.target !== scrollContainerRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(report, SCROLL_REPORT_DELAY_MS);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      if (timer) clearTimeout(timer);
    };
  }, [filePath, dirPath, scrollContainerRef, getScrollTop]);
}
