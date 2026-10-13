import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { buildPrismTheme } from '../lib/prism-theme';
import { FULL_CODE_ATTR } from '../lib/code-export';
import type { ColorScale } from '../lib/color-themes';
import { findMatches, clearMatches } from '../lib/find-walker';
import { findScrollParent } from '../lib/find-scroller';
import { buildInjectionMap, TOKEN_CATEGORIES, type DesignTokens, type TokenCategory } from '../lib/design-md';
import { stripFrontMatter } from '../lib/front-matter';
import { localImageUrl } from '../lib/image-url';
import { remarkHideComments } from '../lib/remark-hide-comments';
import { buildDiagramTheme, type DiagramTheme } from '../lib/mermaid-theme';
import { TokenVisualization } from './design/TokenVisualization';
import { MermaidBlock } from './MermaidBlock';

const REMARK_PLUGINS = [remarkGfm, remarkHideComments];
const MemoMarkdown = React.memo(Markdown);

const CATEGORY_LABELS: Record<TokenCategory, string> = {
  colors: 'Colors',
  typography: 'Typography',
  spacing: 'Spacing',
  rounded: 'Rounded',
  components: 'Components',
};

// Find splits text nodes React owns; if React patched those in place on a
// content change, pieces of the old document would survive into the new one.
// So a change of document while find has marks in it (a live reload, or going
// back to an earlier document, included) gets a fresh DOM subtree. Without
// marks React patches in place, so a reload keeps a diagram on screen while it
// renders again and an expanded code block open. Remounting was chosen over
// moving find to the CSS Highlight API. The design tokens count as content: a
// front-matter edit changes them and not the body.
function documentKey(body: string, filePath: string | null | undefined, designTokens: DesignTokens | null | undefined): string {
  const text = designTokens ? `${JSON.stringify(designTokens)}\n${body}` : body;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${filePath ?? ''}:${text.length}:${hash}`;
}

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
  designTokens?: DesignTokens | null;
  /** Show token categories no section heading names in a section at the end. */
  designAppendix?: boolean;
}

const MAX_MATCHES = 1000;
const LANGUAGE_PATTERN = /language-(\w+)/;

// Structural slice of a hast node, enough to read a fenced block's language and text.
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

/** The source of a ```mermaid fence, or null for any other <pre>. */
function mermaidSource(pre: HastNode | undefined): string | null {
  const code = pre?.children?.find((child) => child.type === 'element');
  if (code?.tagName !== 'code') return null;
  const classes = code.properties?.className;
  const isMermaid = Array.isArray(classes) && classes.some((c) => String(c).toLowerCase() === 'language-mermaid');
  return isMermaid ? textContent(code).replace(/\n$/, '') : null;
}

interface FenceContextValue {
  codeTheme: Record<string, React.CSSProperties>;
  diagramTheme: DiagramTheme;
  filePath?: string | null;
}

const FenceContext = createContext<FenceContextValue | null>(null);

// Lives outside MarkdownView so its identity never changes: a new `pre`
// component on every theme change would remount every diagram and drop it to a
// placeholder while it re-renders. Themes arrive through context instead.
function Pre({ node, children, ...props }: React.ComponentProps<'pre'> & ExtraProps) {
  const fence = useContext(FenceContext);
  const source = mermaidSource(node);
  if (source === null || !fence) return <pre {...props}>{children}</pre>;
  return (
    <MermaidBlock
      // Remount per file, so a block reused by the next document never shows
      // the previous document's diagram while its own renders.
      key={fence.filePath ?? ''}
      source={source}
      theme={fence.diagramTheme}
      fallback={
        <pre {...props}>
          <CodeBlock language="mermaid" codeTheme={fence.codeTheme}>
            {source}
          </CodeBlock>
        </pre>
      }
    />
  );
}

export const MarkdownView = React.memo(
  React.forwardRef<MarkdownViewHandle, MarkdownViewProps>(function MarkdownView(
    { content, colors, filePath, style, contentRef, highlight, onMatchesChanged, designTokens, designAppendix = true },
    ref
  ) {
    const codeTheme = useMemo(() => buildPrismTheme(colors), [colors]);
    const diagramTheme = useMemo(() => buildDiagramTheme(colors), [colors]);
    const fence = useMemo(() => ({ codeTheme, diagramTheme, filePath }), [codeTheme, diagramTheme, filePath]);
    const body = useMemo(() => stripFrontMatter(content), [content]);
    const docKey = useMemo(() => documentKey(body, filePath, designTokens), [body, filePath, designTokens]);

    const injectionMap = useMemo(
      () => (designTokens ? buildInjectionMap(body, designTokens) : null),
      [body, designTokens]
    );

    const appendixCategories = useMemo(() => {
      if (!designTokens || !injectionMap || !designAppendix) return [];
      const injected = new Set([...injectionMap.values()].flat());
      return TOKEN_CATEGORIES.filter(
        (cat) => !injected.has(cat) && designTokens[cat] && Object.keys(designTokens[cat] as object).length > 0
      );
    }, [designTokens, injectionMap, designAppendix]);
    const bodyRef = useRef<HTMLElement | null>(null);
    const matchElementsRef = useRef<HTMLElement[]>([]);
    // The document subtree's key is a generation that moves on when the document
    // changes while find has marks in it. The change is judged against the last
    // render's document, not the one the subtree was mounted for: after an
    // in-place patch those differ, and going back to the mounted one must still
    // remount. Reading the marks during render is deliberate: they're the ones
    // the last commit left, in the DOM React is about to patch.
    const shownKeyRef = useRef(docKey);
    const generationRef = useRef(0);
    if (docKey !== shownKeyRef.current) {
      if (matchElementsRef.current.length > 0) generationRef.current += 1;
      shownKeyRef.current = docKey;
    }
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
    }, [docKey, highlight?.query, highlight?.mode]);

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
      h2({ node, children, ...props }) {
        const line = node?.position?.start.line;
        const categories = line !== undefined && injectionMap ? injectionMap.get(line) : undefined;
        if (categories && designTokens) {
          return (
            <>
              <h2 {...props}>{children}</h2>
              {categories.map((category) => (
                <TokenVisualization key={category} category={category} tokens={designTokens} />
              ))}
            </>
          );
        }
        return <h2 {...props}>{children}</h2>;
      },
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
      pre: Pre,
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
        const resolvedSrc = filePath && src ? localImageUrl(src, filePath) : src || '';
        return <img src={resolvedSrc} alt={alt || ''} {...props} />;
      },
      table({ children, ...props }) {
        return (
          <div className="table-wrapper">
            <table {...props}>{children}</table>
          </div>
        );
      },
    }), [filePath, codeTheme, injectionMap, designTokens]);

    return (
      <div className="markdown-view" style={style} ref={contentRef}>
        <article className="markdown-body" ref={bodyRef}>
          <React.Fragment key={generationRef.current}>
            {designTokens?.name ? (
              <header className="design-header">
                <h1>{designTokens.name}</h1>
                {designTokens.description && <p className="design-header-desc">{designTokens.description}</p>}
              </header>
            ) : null}
            <FenceContext.Provider value={fence}>
              <MemoMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
                {body}
              </MemoMarkdown>
            </FenceContext.Provider>
            {appendixCategories.length > 0 && designTokens && (
              <section className="design-appendix">
                {appendixCategories.map((cat) => (
                  <div key={cat}>
                    <h2>{CATEGORY_LABELS[cat]}</h2>
                    <TokenVisualization category={cat} tokens={designTokens} />
                  </div>
                ))}
              </section>
            )}
          </React.Fragment>
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
  // Print, PDF and Copy take a block cut short in full (see code-export).
  const wrapperProps = { className: 'code-block-wrapper', [FULL_CODE_ATTR]: isTruncated ? children : undefined };

  return (
    <div {...wrapperProps}>
      <button
        className="code-block-copy"
        onClick={handleCopy}
        data-tooltip="Copy code"
        data-tooltip-placement="left"
        aria-label="Copy code"
      >
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
