import React, { useMemo, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { buildPrismTheme } from '../lib/prism-theme';
import type { ColorScale } from '../lib/color-themes';

interface MarkdownViewProps {
  content: string;
  colors: ColorScale;
  filePath?: string | null;
  style?: React.CSSProperties;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

export const MarkdownView = React.memo(function MarkdownView({ content, colors, filePath, style, contentRef }: MarkdownViewProps) {
  const codeTheme = useMemo(() => buildPrismTheme(colors), [colors]);

  return (
    <div className="markdown-view" style={style} ref={contentRef}>
      <article className="markdown-body">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
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
              const match = /language-(\w+)/.exec(className || '');
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
              // Resolve relative paths to local-file:// URLs
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
          }}
        >
          {content}
        </Markdown>
      </article>
    </div>
  );
});

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
