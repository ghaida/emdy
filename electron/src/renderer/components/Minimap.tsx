import React, { useRef, useEffect, useCallback, useState } from 'react';
import { perfMark, perfMeasure } from '../lib/perf';
import { CONTENT_WIDTHS, type ContentWidth } from '../lib/types';

interface MinimapProps {
  visible: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  contentWidth: ContentWidth;
  matchPositions?: number[];
  currentMatchIndex?: number | null;
}

interface TickInfo {
  y: number;
  isCurrent: boolean;
}

export function Minimap({
  visible,
  contentRef,
  scrollContainerRef,
  contentWidth,
  matchPositions = [],
  currentMatchIndex = null,
}: MinimapProps) {
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
      isCurrent: i === currentMatchIndex,
    }));
    collected.sort((a, b) => a.y - b.y);
    const out: TickInfo[] = [];
    for (const t of collected) {
      const last = out[out.length - 1];
      if (last && t.y - last.y < 4 && !t.isCurrent) continue;
      out.push(t);
    }
    setTicks(out);
  }, [currentMatchIndex]);

  const syncContent = useCallback(() => {
    perfMark('minimap-sync-start');
    const content = contentRef.current;
    const clone = cloneRef.current;
    const wrapper = cloneWrapperRef.current;
    const minimap = containerRef.current;
    if (!content || !clone || !wrapper || !minimap) return;

    const markdownBody = content.querySelector('.markdown-body') as HTMLElement | null;
    if (!markdownBody) return;

    const minimapStyle = getComputedStyle(minimap);
    const minimapInnerWidth = minimap.clientWidth
      - parseFloat(minimapStyle.paddingLeft)
      - parseFloat(minimapStyle.paddingRight);
    if (minimapInnerWidth <= 0) return;

    const scale = minimapInnerWidth / refWidth;

    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = 'top left';
    clone.style.width = `${refWidth}px`;

    while (clone.firstChild) clone.removeChild(clone.firstChild);
    const cloned = markdownBody.cloneNode(true) as HTMLElement;
    clone.appendChild(cloned);

    const clonedLayoutHeight = cloned.offsetHeight;
    wrapper.style.height = `${clonedLayoutHeight * scale}px`;

    readTicksFromClone();
    perfMeasure('minimap-sync', 'minimap-sync-start');
  }, [contentRef, refWidth, readTicksFromClone]);

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

    const observer = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of [...m.addedNodes, ...m.removedNodes]) {
          if (node instanceof HTMLElement) { changed = true; break; }
        }
        if (changed) break;
      }
      if (changed) syncContent();
    });
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [visible, syncContent, contentRef]);

  useEffect(() => {
    if (!visible) return;
    readTicksFromClone();
  }, [visible, currentMatchIndex, readTicksFromClone]);

  useEffect(() => {
    if (!visible) return;
    syncContent();
  }, [visible, matchPositions.length, syncContent]);

  useEffect(() => {
    if (!visible) return;
    const minimap = containerRef.current;
    const container = scrollContainerRef.current;
    if (!container) return;

    let synced = false;
    const initialSync = () => {
      if (synced) return;
      synced = true;
      syncContent();
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

    const resizeObserver = new ResizeObserver(() => {
      syncContent();
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
  }, [visible, syncViewport, syncContent, scrollContainerRef]);

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
