import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { buildPrismTheme } from '../lib/prism-theme';
import type { ColorScale } from '../lib/color-themes';

interface MarkdownViewProps {
  content: string;
  colors: ColorScale;
  style?: React.CSSProperties;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

export function MarkdownView({ content, colors, style, contentRef }: MarkdownViewProps) {
  const codeTheme = useMemo(() => buildPrismTheme(colors), [colors]);

  return (
    <div className="markdown-view" style={style} ref={contentRef}>
      <article className="markdown-body">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');

              if (match) {
                return (
                  <SyntaxHighlighter
                    style={codeTheme}
                    language={match[1]}
                    PreTag="div"
                  >
                    {codeString}
                  </SyntaxHighlighter>
                );
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </Markdown>
      </article>
    </div>
  );
}
