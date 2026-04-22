import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { perfMark, perfMeasure } from '../lib/perf';

interface MinimapProps {
  visible: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  matchPositions?: number[];
  currentMatchIndex?: number | null;
}

export function Minimap({
  visible,
  contentRef,
  scrollContainerRef,
  matchPositions = [],
  currentMatchIndex = null,
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cloneWrapperRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportReady, setViewportReady] = useState(false);
  const [scale, setScale] = useState(0.12);
  const isDragging = useRef(false);

  const syncContent = useCallback(() => {
    perfMark('minimap-sync-start');
    const content = contentRef.current;
    const container = scrollContainerRef.current;
    const clone = cloneRef.current;
    const wrapper = cloneWrapperRef.current;
    const minimap = containerRef.current;
    if (!content || !container || !clone || !wrapper || !minimap) return;

    const markdownBody = content.querySelector('.markdown-body') as HTMLElement | null;
    if (!markdownBody) return;

    const originalWidth = markdownBody.offsetWidth;
    const minimapStyle = getComputedStyle(minimap);
    const minimapInnerWidth = minimap.clientWidth
      - parseFloat(minimapStyle.paddingLeft)
      - parseFloat(minimapStyle.paddingRight);

    if (originalWidth <= 0 || minimapInnerWidth <= 0) return;

    // Scale against the natural max content width rather than the actual
    // rendered width. Keeps the thumbnail — both text size and text width —
    // stable as the window resizes. Falls back to actual if the content
    // happens to be narrower than the reference.
    const REFERENCE_WIDTH = 680; // matches --content-max-width
    const refWidth = Math.max(originalWidth, REFERENCE_WIDTH);
    const nextScale = minimapInnerWidth / refWidth;
    setScale(nextScale);

    clone.style.transform = `scale(${nextScale})`;
    clone.style.transformOrigin = 'top left';
    clone.style.width = `${refWidth}px`;

    while (clone.firstChild) clone.removeChild(clone.firstChild);
    const cloned = markdownBody.cloneNode(true) as HTMLElement;
    clone.appendChild(cloned);

    const sourceHeight = container.scrollHeight;
    wrapper.style.height = `${sourceHeight * nextScale}px`;
    perfMeasure('minimap-sync', 'minimap-sync-start');
  }, [contentRef, scrollContainerRef]);

  const syncViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    const minimap = containerRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!container || !content || !minimap || !wrapper) return;

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const minimapContentHeight = wrapper.offsetHeight;

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
  }, [scrollContainerRef, contentRef]);

  useEffect(() => {
    if (!visible) setViewportReady(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    syncContent();

    const content = contentRef.current;
    if (!content) return;

    // Only re-sync when structural content changes. Skip mutations caused by
    // the find walker (inserting/removing <mark> wrappers, and the text-node
    // splits those mutations entail) — those don't change what the minimap
    // should render, and cloning a 62k-word body on every keystroke is brutal.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement && node.tagName !== 'MARK') {
            syncContent();
            return;
          }
        }
        for (const node of m.removedNodes) {
          if (node instanceof HTMLElement && node.tagName !== 'MARK') {
            syncContent();
            return;
          }
        }
      }
    });
    observer.observe(content, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [visible, syncContent, contentRef]);

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
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => {
      clearTimeout(fallback);
      minimap?.removeEventListener('transitionend', onTransitionEnd);
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [visible, syncViewport, syncContent, scrollContainerRef, contentRef]);

  const ticks = useMemo(() => {
    if (matchPositions.length === 0 || scale <= 0) return [];
    const scaled = matchPositions.map((p, i) => ({
      y: p * scale,
      isCurrent: i === currentMatchIndex,
    }));
    const sorted = scaled.slice().sort((a, b) => a.y - b.y);
    const out: typeof sorted = [];
    for (const t of sorted) {
      const last = out[out.length - 1];
      if (last && t.y - last.y < 4 && !t.isCurrent) continue;
      out.push(t);
    }
    return out;
  }, [matchPositions, currentMatchIndex, scale]);

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
        <div
          className="minimap-content"
          ref={cloneRef}
        />
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
