import React, { useRef, useEffect, useCallback, useState } from 'react';

const SCALE = 0.12;

interface MinimapProps {
  visible: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function Minimap({ visible, contentRef, scrollContainerRef }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cloneWrapperRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const isDragging = useRef(false);

  // Clone the markdown body content into the minimap
  const syncContent = useCallback(() => {
    const content = contentRef.current;
    const clone = cloneRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!content || !clone || !wrapper) return;

    // Find the .markdown-body inside the content ref
    const markdownBody = content.querySelector('.markdown-body');
    if (!markdownBody) return;

    // Clone via DOM methods (safe — this is our own rendered content)
    while (clone.firstChild) clone.removeChild(clone.firstChild);
    const cloned = markdownBody.cloneNode(true) as HTMLElement;
    clone.appendChild(cloned);

    // Set wrapper height to the scaled content height
    const sourceHeight = content.scrollHeight;
    wrapper.style.height = `${sourceHeight * SCALE}px`;
  }, [contentRef]);

  // Sync viewport indicator and minimap scroll position
  const syncViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    const minimap = containerRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!container || !content || !minimap || !wrapper) return;

    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const minimapContentHeight = wrapper.offsetHeight; // content.scrollHeight * SCALE

    // Map viewport proportionally: the minimap represents the full scrollable area
    const vpHeight = (clientHeight / scrollHeight) * minimapContentHeight;
    const scrollRange = scrollHeight - clientHeight;
    const vpTop = scrollRange > 0
      ? (scrollTop / scrollRange) * (minimapContentHeight - vpHeight)
      : 0;

    setViewportTop(vpTop);
    setViewportHeight(vpHeight);

    // Auto-scroll minimap to keep viewport indicator visible
    const minimapVisibleHeight = minimap.clientHeight;
    const vpCenter = vpTop + vpHeight / 2;
    const targetScroll = vpCenter - minimapVisibleHeight / 2;
    minimap.scrollTop = Math.max(0, targetScroll);
  }, [scrollContainerRef, contentRef]);

  // Sync content on mount and when DOM changes
  useEffect(() => {
    if (!visible) return;
    syncContent();

    const content = contentRef.current;
    if (!content) return;

    const observer = new MutationObserver(syncContent);
    observer.observe(content, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [visible, syncContent, contentRef]);

  // Sync viewport on scroll/resize
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(syncViewport, 50);
    const container = scrollContainerRef.current;
    if (!container) return () => clearTimeout(timer);

    const onScroll = () => requestAnimationFrame(syncViewport);
    container.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      syncContent();
      requestAnimationFrame(syncViewport);
    });
    resizeObserver.observe(container);
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [visible, syncViewport, syncContent, scrollContainerRef, contentRef]);

  // Click/drag to navigate
  const scrollToY = useCallback((clientY: number) => {
    const container = scrollContainerRef.current;
    const minimap = containerRef.current;
    const wrapper = cloneWrapperRef.current;
    if (!container || !minimap || !wrapper) return;

    const rect = minimap.getBoundingClientRect();
    const y = clientY - rect.top + minimap.scrollTop;
    const minimapContentHeight = wrapper.offsetHeight;
    if (minimapContentHeight <= 0) return;

    // Map click position proportionally to scroll position
    const clickFraction = y / minimapContentHeight;
    const scrollRange = container.scrollHeight - container.clientHeight;
    container.scrollTop = clickFraction * scrollRange;
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
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      <div className="minimap-scaler" ref={cloneWrapperRef}>
        <div
          className="minimap-content"
          ref={cloneRef}
          style={{
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            width: `${1 / SCALE * 100}%`,
          }}
        />
      </div>
      <div
        className="minimap-viewport"
        style={{
          top: `${viewportTop}px`,
          height: `${Math.max(viewportHeight, 8)}px`,
        }}
      />
    </div>
  );
}
