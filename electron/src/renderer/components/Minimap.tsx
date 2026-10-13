import React, { useRef, useEffect, useCallback, useState } from 'react';
import { perfMark, perfMeasure } from '../lib/perf';
import { CONTENT_WIDTHS, type ContentWidth } from '../lib/types';

interface MinimapProps {
  visible: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  contentWidth: ContentWidth;
  currentMatchIndex?: number | null;
}

interface TickInfo {
  y: number;
  isCurrent: boolean;
  /** The matches this tick stands for: marks less than 4px below it share it. */
  markIndexes: number[];
}

/** Quiet period before re-cloning the document after it changes. */
const SYNC_SETTLE_MS = 150;
/** Longest a pending re-clone can be postponed by continuing changes. */
const SYNC_MAX_WAIT_MS = 1000;

export function Minimap({
  visible,
  contentRef,
  scrollContainerRef,
  contentWidth,
  currentMatchIndex = null,
}: MinimapProps) {
  // Read through a ref so the sync callbacks keep one identity across Cmd+G.
  const currentMatchIndexRef = useRef(currentMatchIndex);
  currentMatchIndexRef.current = currentMatchIndex;
  const containerRef = useRef<HTMLDivElement>(null);
  const cloneWrapperRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportReady, setViewportReady] = useState(false);
  const [ticks, setTicks] = useState<TickInfo[]>([]);
  const isDragging = useRef(false);

  // Clone at the content-width reference (fixed per setting). Clone never re-wraps
  // based on real window width — wrapping and visual positions are stable. Match ticks
  // are read from the clone's own <mark> elements so they always land on cloned text.
  const refWidth = CONTENT_WIDTHS[contentWidth];

  const readTicksFromClone = useCallback(() => {
    const clone = cloneRef.current;
    if (!clone) return;
    const wrapper = clone.firstElementChild as HTMLElement | null;
    if (!wrapper) {
      setTicks([]);
      return;
    }
    const marks = Array.from(wrapper.querySelectorAll('mark')) as HTMLElement[];
    if (marks.length === 0) {
      setTicks([]);
      return;
    }
    const wrapperTop = wrapper.getBoundingClientRect().top;
    const collected: TickInfo[] = marks.map((mark, i) => ({
      y: mark.getBoundingClientRect().top - wrapperTop,
      isCurrent: i === currentMatchIndexRef.current,
      markIndexes: [i],
    }));
    collected.sort((a, b) => a.y - b.y);
    const out: TickInfo[] = [];
    for (const t of collected) {
      const last = out[out.length - 1];
      if (last && t.y - last.y < 4) {
        last.markIndexes.push(...t.markIndexes);
        if (t.isCurrent) last.isCurrent = true;
        continue;
      }
      out.push(t);
    }
    setTicks(out);
  }, []);

  // Fits the clone to the minimap's width. The clone is laid out at refWidth
  // whatever that width is, so a new width only rescales it: no new copy.
  const applyScale = useCallback(() => {
    const clone = cloneRef.current;
    const wrapper = cloneWrapperRef.current;
    const minimap = containerRef.current;
    if (!clone || !wrapper || !minimap) return;
    const cloned = clone.firstElementChild as HTMLElement | null;
    if (!cloned) return;

    const minimapStyle = getComputedStyle(minimap);
    const minimapInnerWidth = minimap.clientWidth
      - parseFloat(minimapStyle.paddingLeft)
      - parseFloat(minimapStyle.paddingRight);
    if (minimapInnerWidth <= 0) return;

    const scale = minimapInnerWidth / refWidth;
    clone.style.transform = `scale(${scale})`;
    wrapper.style.height = `${cloned.offsetHeight * scale}px`;
    readTicksFromClone();
  }, [refWidth, readTicksFromClone]);

  // Copies the document: when it or its marks change, and once on opening,
  // since a closed minimap doesn't watch it.
  const syncContent = useCallback(() => {
    perfMark('minimap-sync-start');
    const content = contentRef.current;
    const clone = cloneRef.current;
    if (!content || !clone) return;

    const markdownBody = content.querySelector('.markdown-body') as HTMLElement | null;
    if (!markdownBody) return;

    clone.style.transformOrigin = 'top left';
    clone.style.width = `${refWidth}px`;

    while (clone.firstChild) clone.removeChild(clone.firstChild);
    clone.appendChild(markdownBody.cloneNode(true));

    applyScale();
    perfMeasure('minimap-sync', 'minimap-sync-start');
  }, [contentRef, refWidth, applyScale]);

  const syncViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    const minimap = containerRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!container || !minimap || !wrapper) return;

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const minimapContentHeight = wrapper.offsetHeight;
    if (scrollHeight <= 0 || minimapContentHeight <= 0) return;

    const vpHeight = (clientHeight / scrollHeight) * minimapContentHeight;
    const scrollRange = scrollHeight - clientHeight;
    const vpTop = scrollRange > 0
      ? (scrollTop / scrollRange) * (minimapContentHeight - vpHeight)
      : 0;

    setViewportTop(vpTop);
    setViewportHeight(vpHeight);

    if (!isDragging.current) {
      const minimapVisibleHeight = minimap.clientHeight;
      const vpCenter = vpTop + vpHeight / 2;
      const targetScroll = vpCenter - minimapVisibleHeight / 2;
      minimap.scrollTop = Math.max(0, targetScroll);
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    if (!visible) setViewportReady(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    syncContent();

    const content = contentRef.current;
    if (!content) return;

    // Content changes in bursts (diagrams finishing one at a time, find marks
    // going in), and every sync deep-clones the whole document. Coalesce them:
    // sync once things settle, but at least once a second during a long burst.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let firstPendingAt = 0;
    const scheduleSync = () => {
      const now = performance.now();
      if (timer === undefined) firstPendingAt = now;
      else clearTimeout(timer);
      const delay = Math.min(SYNC_SETTLE_MS, Math.max(0, firstPendingAt + SYNC_MAX_WAIT_MS - now));
      timer = setTimeout(() => {
        timer = undefined;
        syncContent();
      }, delay);
    };

    const observer = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of [...m.addedNodes, ...m.removedNodes]) {
          if (node instanceof HTMLElement) { changed = true; break; }
        }
        if (changed) break;
      }
      if (changed) scheduleSync();
    });
    observer.observe(content, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [visible, syncContent, contentRef]);

  // An image in the copy that arrives after the copy was measured makes it
  // taller with no change to the document: measure it again, once a frame.
  // load and error don't bubble, so the listener catches them on the way down.
  useEffect(() => {
    if (!visible) return;
    const clone = cloneRef.current;
    if (!clone) return;
    let frame = 0;
    const remeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        applyScale();
        syncViewport();
      });
    };
    clone.addEventListener('load', remeasure, true);
    clone.addEventListener('error', remeasure, true);
    return () => {
      cancelAnimationFrame(frame);
      clone.removeEventListener('load', remeasure, true);
      clone.removeEventListener('error', remeasure, true);
    };
  }, [visible, applyScale, syncViewport]);

  // A step to another match only moves which match is current: the tick, and
  // the clone's copy of the mark, which the document's styles show as current.
  useEffect(() => {
    setTicks((prev) => prev.map((t) => ({
      ...t,
      isCurrent: currentMatchIndex !== null && t.markIndexes.includes(currentMatchIndex),
    })));
    const clone = cloneRef.current;
    if (!clone) return;
    clone.querySelectorAll('mark[data-current]').forEach((m) => m.removeAttribute('data-current'));
    if (currentMatchIndex !== null) clone.querySelectorAll('mark')[currentMatchIndex]?.setAttribute('data-current', 'true');
  }, [currentMatchIndex]);

  useEffect(() => {
    if (!visible) return;
    const minimap = containerRef.current;
    const container = scrollContainerRef.current;
    if (!container) return;

    // The MutationObserver effect takes the copy; this fits it to the column
    // once the column has finished opening.
    let synced = false;
    const initialSync = () => {
      if (synced) return;
      synced = true;
      applyScale();
      syncViewport();
      setViewportReady(true);
    };

    let fallback: ReturnType<typeof setTimeout> | undefined;
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'width') {
        clearTimeout(fallback);
        initialSync();
      }
    };
    if (minimap) {
      minimap.addEventListener('transitionend', onTransitionEnd);
      fallback = setTimeout(initialSync, 200);
    }

    const onScroll = () => requestAnimationFrame(syncViewport);
    container.addEventListener('scroll', onScroll, { passive: true });

    // The clone is laid out at a fixed reference width, so only the minimap's
    // own width changes its scale, which needs no new copy (the column widens
    // every frame while it opens); everything else just moves the viewport.
    let lastMinimapWidth = minimap?.clientWidth ?? 0;
    const resizeObserver = new ResizeObserver(() => {
      const width = minimap?.clientWidth ?? 0;
      if (width !== lastMinimapWidth) {
        lastMinimapWidth = width;
        applyScale();
      }
      requestAnimationFrame(syncViewport);
    });
    resizeObserver.observe(container);
    if (minimap) resizeObserver.observe(minimap);

    return () => {
      clearTimeout(fallback);
      minimap?.removeEventListener('transitionend', onTransitionEnd);
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [visible, syncViewport, applyScale, scrollContainerRef]);

  const scrollToY = useCallback((clientY: number) => {
    const container = scrollContainerRef.current;
    const minimap = containerRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!container || !minimap || !wrapper) return;

    const rect = minimap.getBoundingClientRect();
    const y = clientY - rect.top + minimap.scrollTop;
    const minimapContentHeight = wrapper.offsetHeight;
    if (minimapContentHeight <= 0) return;

    const vpHeight = (container.clientHeight / container.scrollHeight) * minimapContentHeight;
    const adjustedY = y - vpHeight / 2;
    const usableHeight = minimapContentHeight - vpHeight;
    const scrollRange = container.scrollHeight - container.clientHeight;
    if (usableHeight <= 0) return;
    const fraction = Math.max(0, Math.min(1, adjustedY / usableHeight));
    container.scrollTop = fraction * scrollRange;
  }, [scrollContainerRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    scrollToY(e.clientY);
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      scrollToY(moveEvent.clientY);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [scrollToY]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop += e.deltaY;
  }, [scrollContainerRef]);

  return (
    <div
      className={`minimap${visible ? ' open' : ''}`}
      aria-hidden="true"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      <div className="minimap-scaler" ref={cloneWrapperRef}>
        <div className="minimap-content" ref={cloneRef} />
        {ticks.length > 0 && (
          <div className="minimap-match-layer">
            {ticks.map((t, i) => (
              <div
                key={i}
                className={`minimap-tick${t.isCurrent ? ' current' : ''}`}
                style={{ top: `${t.y}px`, height: t.isCurrent ? '3px' : '2px' }}
              />
            ))}
          </div>
        )}
      </div>
      {viewportReady && (
        <div
          className="minimap-viewport"
          style={{
            top: `${viewportTop}px`,
            height: `${Math.max(viewportHeight, 8)}px`,
          }}
        />
      )}
    </div>
  );
}
