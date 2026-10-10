import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Image as ImageIcon } from 'lucide-react';
import { errorMessage, getCachedDiagram, renderDiagram, type DiagramResult } from '../lib/mermaid-render';
import { DIAGRAM_FONT_SIZE, type DiagramTheme } from '../lib/mermaid-theme';
import { embedBundledFonts, svgToPng } from '../lib/diagram-image';

interface MermaidBlockProps {
  source: string;
  theme: DiagramTheme;
  /** Shown in place of the diagram when the source doesn't render. */
  fallback: React.ReactNode;
}

type Copied = 'source' | 'image' | null;

const COPIED_FEEDBACK_MS = 2000;

export function MermaidBlock({ source, theme, fallback }: MermaidBlockProps) {
  // Seed from the cache so a remount (live reload, theme flip back) paints the
  // diagram on the first frame instead of a placeholder.
  const [result, setResult] = useState<DiagramResult | null>(() => getCachedDiagram(source, theme) ?? null);
  const [copied, setCopied] = useState<Copied>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const cached = getCachedDiagram(source, theme);
    if (cached) {
      setResult(cached);
      return;
    }
    // The previous diagram stays up until the new one is ready.
    let cancelled = false;
    renderDiagram(source, theme).then(
      (next) => {
        if (!cancelled) setResult(next);
      },
      (err) => {
        if (!cancelled) setResult({ ok: false, error: errorMessage(err) });
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
    if (!result?.ok) return;
    try {
      const svg = await embedBundledFonts(result.svg);
      const png = await svgToPng(svg, result.width, result.height, {
        scale: 2,
        padding: 16,
        background: theme.background,
      });
      if (await window.electronAPI.writeClipboardImage(png)) showCopied('image');
    } catch (err) {
      console.error('Copying diagram as image failed:', err);
    }
  }, [result, theme.background, showCopied]);

  if (result && !result.ok) {
    return (
      <div className="mermaid-error-block">
        {fallback}
        <div className="mermaid-error" role="note">
          <div className="mermaid-error-title">Couldn’t render this Mermaid diagram</div>
          <div className="mermaid-error-detail">{result.error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mermaid-block" data-mermaid-source={source} aria-busy={!result}>
      <div className="code-block-actions">
        <button
          className="code-block-copy"
          onClick={handleCopyImage}
          disabled={!result}
          title="Copy as PNG"
          aria-label="Copy diagram as PNG"
        >
          {copied === 'image' ? <Check size={14} strokeWidth={1.5} /> : <ImageIcon size={14} strokeWidth={1.5} />}
        </button>
        <button className="code-block-copy" onClick={handleCopySource} title="Copy source" aria-label="Copy diagram source">
          {copied === 'source' ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
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
          dangerouslySetInnerHTML={{ __html: result.svg }}
        />
      ) : (
        <div className="mermaid-loading" />
      )}
    </div>
  );
}
