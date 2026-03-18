import React, { useRef, useEffect, useCallback, useState } from 'react';

interface MinimapProps {
  visible: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function Minimap({ visible, contentRef, scrollContainerRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportTop, setViewportTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const isDragging = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const content = contentRef.current;
    const container = scrollContainerRef.current;
    const minimap = containerRef.current;
    if (!canvas || !content || !container || !minimap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 140;
    const minimapHeight = minimap.clientHeight;
    const totalContentHeight = content.scrollHeight;
    const visibleHeight = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = minimapHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${minimapHeight}px`;
    ctx.scale(dpr, dpr);

    setContentHeight(totalContentHeight);

    // Scale: map full document height to minimap panel height
    const scale = minimapHeight / totalContentHeight;

    // Clear
    ctx.clearRect(0, 0, width, minimapHeight);

    // Read minimap-specific colors from CSS custom properties
    const style = getComputedStyle(document.documentElement);
    const headingColor = style.getPropertyValue('--minimap-heading').trim() || '#6B7B8A';
    const textColor = style.getPropertyValue('--minimap-text').trim() || '#A0A8B0';
    const codeColor = style.getPropertyValue('--minimap-code').trim() || '#D8DDE2';

    // Compute element positions relative to the content top (not affected by scroll)
    const contentTop = content.offsetTop;
    const elements = content.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, blockquote, table, ul, ol, img, hr');

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      // Get position relative to the scrollable content
      let top = 0;
      let node: HTMLElement | null = htmlEl;
      while (node && node !== content) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      const h = Math.max(htmlEl.offsetHeight * scale, 1);
      const y = top * scale;

      const tag = el.tagName.toLowerCase();
      if (tag.startsWith('h')) {
        ctx.fillStyle = headingColor;
        ctx.globalAlpha = 0.7;
        const level = parseInt(tag[1]) || 1;
        ctx.fillRect(10, y, Math.min(width - 20, 50 + (6 - level) * 14), Math.max(h, 2));
        ctx.globalAlpha = 1;
      } else if (tag === 'pre') {
        ctx.fillStyle = codeColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(10, y, width - 20, h);
        ctx.globalAlpha = 1;
      } else if (tag === 'blockquote') {
        ctx.fillStyle = codeColor;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(14, y, width - 28, h);
        ctx.globalAlpha = 1;
      } else if (tag === 'hr') {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(10, y, width - 20, 1);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(10, y, width - 20, h);
        ctx.globalAlpha = 1;
      }
    });

    // Viewport indicator — tracks scroll position within the minimap
    const vpTop = container.scrollTop * scale;
    const vpHeight = visibleHeight * scale;
    setViewportTop(vpTop);
    setViewportHeight(vpHeight);
  }, [contentRef, scrollContainerRef]);

  useEffect(() => {
    if (!visible) return;

    // Initial draw after layout settles
    const timer = setTimeout(draw, 50);

    const container = scrollContainerRef.current;
    if (!container) return () => clearTimeout(timer);

    const onScroll = () => requestAnimationFrame(draw);

    container.addEventListener('scroll', onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(draw));
    resizeObserver.observe(container);
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => {
      clearTimeout(timer);
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, [visible, draw, scrollContainerRef, contentRef]);

  const scrollToY = useCallback((clientY: number) => {
    const container = scrollContainerRef.current;
    const minimap = containerRef.current;
    if (!container || !minimap || contentHeight === 0) return;

    const rect = minimap.getBoundingClientRect();
    const y = clientY - rect.top;
    const minimapHeight = minimap.clientHeight;
    const scale = minimapHeight / contentHeight;
    const scrollTo = y / scale - container.clientHeight / 2;
    container.scrollTop = Math.max(0, scrollTo);
  }, [scrollContainerRef, contentHeight]);

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

  if (!visible) return null;

  return (
    <div className="minimap" ref={containerRef} onMouseDown={handleMouseDown}>
      <canvas ref={canvasRef} />
      <div
        className="minimap-viewport"
        style={{
          top: `${viewportTop}px`,
          height: `${Math.max(viewportHeight, 20)}px`,
        }}
      />
    </div>
  );
}
