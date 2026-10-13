import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Image as ImageIcon } from 'lucide-react';
import { errorMessage, getCachedDiagram, hasSize, renderDiagram, type DiagramResult } from '../lib/mermaid-render';
import { DIAGRAM_FONT_SIZE, type DiagramTheme } from '../lib/mermaid-theme';
import { embedBundledFonts, svgToPng } from '../lib/diagram-image';
import { DIAGRAM_BLOCK_CLASS, DIAGRAM_ERROR_CLASS, DIAGRAM_SOURCE_ATTR } from '../lib/diagram-export';

interface MermaidBlockProps {
  source: string;
  theme: DiagramTheme;
  /** The line the fence starts on, which palette picks look for. */
  line?: number;
  /** Shown in place of the diagram when the source doesn't render. */
  fallback: React.ReactNode;
}

type Copied = 'source' | 'image' | null;

const COPIED_FEEDBACK_MS = 2000;

export function MermaidBlock({ source, theme, line, fallback }: MermaidBlockProps) {
  // The render for exactly this source and theme, if it has been drawn before.
  // Looked up while rendering, so a cached diagram paints on the first frame.
  const current = getCachedDiagram(source, theme);
  // The last result shown. While a new render is pending (theme change, or an
  // edit picked up by live reload) it stays up instead of a placeholder, so
  // the page doesn't collapse and jump under the reader.
  const [latest, setLatest] = useState<DiagramResult | null>(current ?? null);
  if (current && current !== latest) setLatest(current);
  const result = current ?? latest;

  const [copied, setCopied] = useState<Copied>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (getCachedDiagram(source, theme)) return;
    let cancelled = false;
    renderDiagram(source, theme).then(
      (next) => {
        if (!cancelled) setLatest(next);
      },
      (err) => {
        if (!cancelled) setLatest({ ok: false, error: errorMessage(err) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [source, theme]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const showCopied = useCallback((what: Copied) => {
    setCopied(what);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
  }, []);

  const handleCopySource = useCallback(() => {
    navigator.clipboard.writeText(source);
    showCopied('source');
  }, [source, showCopied]);

  const handleCopyImage = useCallback(async () => {
    // Only the current render: a stale one is from the previous theme.
    if (!hasSize(current)) return;
    try {
      const svg = await embedBundledFonts(current.svg);
      const png = await svgToPng(svg, current.width, current.height, {
        scale: 2,
        padding: 16,
        background: theme.background,
      });
      if (await window.electronAPI.writeClipboardImage(png.bytes, png.scale)) showCopied('image');
    } catch (err) {
      console.error('Copying diagram as image failed:', err);
    }
  }, [current, theme.background, showCopied]);

  // Diagram links (`click A href "…"`) would try to navigate the window, which
  // the app blocks. Open them in the browser, like Markdown links.
  const handleDiagramClick = useCallback((e: React.MouseEvent) => {
    const link = (e.target as Element).closest('a');
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute('href') ?? link.getAttribute('xlink:href');
    if (href) window.electronAPI.openExternal(href);
  }, []);

  if (result && !result.ok) {
    return (
      <div className="mermaid-error-block" data-line={line}>
        {fallback}
        <div className={DIAGRAM_ERROR_CLASS} role="note">
          <div className="mermaid-error-title">Couldn’t render this Mermaid diagram</div>
          <div className="mermaid-error-detail">{result.error}</div>
        </div>
      </div>
    );
  }

  const blockProps = { className: DIAGRAM_BLOCK_CLASS, [DIAGRAM_SOURCE_ATTR]: source, 'aria-busy': !current, 'data-line': line };

  return (
    <div {...blockProps}>
      <div className="code-block-actions">
        <button className="code-block-copy" onClick={handleCopySource} data-tooltip="Copy code" aria-label="Copy code">
          {copied === 'source' ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
        </button>
        <button
          className="code-block-copy"
          onClick={handleCopyImage}
          disabled={!hasSize(current)}
          data-tooltip="Copy as PNG"
          data-tooltip-placement="end"
          aria-label="Copy as PNG"
        >
          {copied === 'image' ? <Check size={14} strokeWidth={1.5} /> : <ImageIcon size={14} strokeWidth={1.5} />}
        </button>
      </div>
      {result ? (
        // Keyed per render so a new diagram swaps in an element, not just
        // innerHTML: the minimap only resyncs when HTML elements are added.
        <div
          key={result.id}
          className="mermaid-diagram"
          // Width in em so the diagram scales with zoom like the text around
          // it; CSS caps it at the column width.
          style={result.width > 0 ? { width: `${result.width / DIAGRAM_FONT_SIZE}em` } : undefined}
          onClick={handleDiagramClick}
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
      ) : (
        <div className="mermaid-loading" />
      )}
    </div>
  );
}
