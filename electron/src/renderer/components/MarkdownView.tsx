import React, { useMemo, useState, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { buildPrismTheme } from '../lib/prism-theme';
import type { ColorScale } from '../lib/color-themes';
import { findMatches, clearMatches } from '../lib/find-walker';
import { findScrollParent } from '../lib/find-scroller';

const REMARK_PLUGINS = [remarkGfm];
const MemoMarkdown = React.memo(Markdown);

export type HighlightMode = 'multi-persistent' | 'none';

export interface HighlightState {
  query: string;
  currentIndex: number;
  mode: HighlightMode;
  dismissing?: boolean;
}

export interface MarkdownViewHandle {
  scrollToMatch(index: number): void;
  getMatchCount(): number;
  focusMatchAtLine(lineNumber: number): number | null;
}

interface MarkdownViewProps {
  content: string;
  colors: ColorScale;
  filePath?: string | null;
  style?: React.CSSProperties;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  highlight?: HighlightState | null;
  onMatchesChanged?: (count: number, isCapped: boolean, positions: number[]) => void;
}

const MAX_MATCHES = 1000;
const LANGUAGE_PATTERN = /language-(\w+)/;

export const MarkdownView = React.memo(
  React.forwardRef<MarkdownViewHandle, MarkdownViewProps>(function MarkdownView(
    { content, colors, filePath, style, contentRef, highlight, onMatchesChanged },
    ref
  ) {
    const codeTheme = useMemo(() => buildPrismTheme(colors), [colors]);
    const bodyRef = useRef<HTMLElement | null>(null);
    const matchElementsRef = useRef<HTMLElement[]>([]);
    const onMatchesChangedRef = useRef(onMatchesChanged);

    useEffect(() => {
      onMatchesChangedRef.current = onMatchesChanged;
    }, [onMatchesChanged]);

    useLayoutEffect(() => {
      const root = bodyRef.current;
      if (!root) return;
      matchElementsRef.current = [];
      const query = highlight?.query ?? '';
      const mode = highlight?.mode ?? 'none';
      if (!query || mode === 'none') {
        clearMatches(root);
        onMatchesChangedRef.current?.(0, false, []);
        return;
      }
      const { marks, isCapped } = findMatches(root, query, MAX_MATCHES);
      matchElementsRef.current = marks;
      const baseTop = root.getBoundingClientRect().top;
      const positions = marks.map((m) => m.getBoundingClientRect().top - baseTop);
      onMatchesChangedRef.current?.(marks.length, isCapped, positions);
      return () => {
        clearMatches(root);
        matchElementsRef.current = [];
      };
    }, [content, highlight?.query, highlight?.mode]);

    useLayoutEffect(() => {
      const marks = matchElementsRef.current;
      marks.forEach((m) => m.removeAttribute('data-current'));
      if (!highlight) return;
      const current = marks[highlight.currentIndex];
      if (current) current.setAttribute('data-current', 'true');
    }, [highlight?.currentIndex]);

    useLayoutEffect(() => {
      const marks = matchElementsRef.current;
      const dismissing = highlight?.dismissing === true;
      marks.forEach((m) => {
        if (dismissing) m.setAttribute('data-dismissed', 'true');
        else m.removeAttribute('data-dismissed');
      });
    }, [highlight?.dismissing]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToMatch(index: number) {
          const el = matchElementsRef.current[index];
          if (!el) return;
          const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          const scroller = findScrollParent(el);
          if (!scroller) {
            el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
            return;
          }
          const elRect = el.getBoundingClientRect();
          const scrollerRect = scroller.getBoundingClientRect();
          const offsetWithinScroller = elRect.top - scrollerRect.top + scroller.scrollTop;
          const target = offsetWithinScroller - scroller.clientHeight / 3;
          scroller.scrollTo({ top: target, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        },
        getMatchCount() {
          return matchElementsRef.current.length;
        },
        focusMatchAtLine(lineNumber: number) {
          const root = bodyRef.current;
          const marks = matchElementsRef.current;
          if (!root || marks.length === 0) return null;
          const blocks = Array.from(root.children);
          if (blocks.length === 0) return null;
          const blockIdx = Math.min(Math.max(lineNumber - 1, 0), blocks.length - 1);
          const block = blocks[blockIdx];
          for (let i = 0; i < marks.length; i++) {
            if (block.contains(marks[i])) return i;
            const pos = block.compareDocumentPosition(marks[i]);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return i;
          }
          return null;
        },
      }),
      []
    );

    const components = useMemo<Components>(() => ({
      li({ children, ...props }) {
        const childArray = React.Children.toArray(children);
        const hasCheckbox = childArray.some(
          (child) => React.isValidElement(child) && (child as React.ReactElement<{ type?: string }>).props?.type === 'checkbox'
        );
        if (hasCheckbox) {
          const checkbox = childArray.find(
            (child) => React.isValidElement(child) && (child as React.ReactElement<{ type?: string }>).props?.type === 'checkbox'
          );
          const rest = childArray.filter((child) => child !== checkbox);
          return (
            <li {...props} className="task-list-item">
              {checkbox}
              <div className="task-list-text">{rest}</div>
            </li>
          );
        }
        return <li {...props}>{children}</li>;
      },
      code({ className, children, ...props }) {
        const match = (className || '').match(LANGUAGE_PATTERN);
        const codeString = String(children).replace(/\n$/, '');
        if (match) {
          return (
            <CodeBlock language={match[1]} codeTheme={codeTheme}>
              {codeString}
            </CodeBlock>
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      a({ href, children, ...props }) {
        return (
          <a
            href={href}
            {...props}
            onClick={(e) => {
              if (href) {
                e.preventDefault();
                window.electronAPI.openExternal(href);
              }
            }}
          >
            {children}
          </a>
        );
      },
      img({ src, alt, ...props }) {
        let resolvedSrc = src || '';
        if (filePath && resolvedSrc && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('data:') && !resolvedSrc.startsWith('file:')) {
          const dir = filePath.replace(/\/[^/]+$/, '');
          resolvedSrc = `local-file://${dir}/${encodeURIComponent(resolvedSrc).replace(/%2F/g, '/')}`;
        }
        return <img src={resolvedSrc} alt={alt || ''} {...props} />;
      },
      table({ children, ...props }) {
        return (
          <div className="table-wrapper">
            <table {...props}>{children}</table>
          </div>
        );
      },
    }), [filePath, codeTheme]);

    return (
      <div className="markdown-view" style={style} ref={contentRef}>
        <article className="markdown-body" ref={bodyRef}>
          <MemoMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
            {content}
          </MemoMarkdown>
        </article>
      </div>
    );
  })
);

const MAX_HIGHLIGHTED_LINES = 200;

function CodeBlock({ language, codeTheme, children }: {
  language: string;
  codeTheme: Record<string, React.CSSProperties>;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  const lineCount = children.split('\n').length;
  const isTruncated = !showAll && lineCount > MAX_HIGHLIGHTED_LINES;
  const displayContent = isTruncated
    ? children.split('\n').slice(0, MAX_HIGHLIGHTED_LINES).join('\n')
    : children;

  return (
    <div className="code-block-wrapper">
      <button className="code-block-copy" onClick={handleCopy} title="Copy code" aria-label="Copy code">
        {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
      </button>
      <SyntaxHighlighter
        style={codeTheme}
        language={language}
        PreTag="div"
      >
        {displayContent}
      </SyntaxHighlighter>
      {isTruncated && (
        <button className="code-block-show-all" onClick={() => setShowAll(true)}>
          Show all {lineCount} lines
        </button>
      )}
    </div>
  );
}
