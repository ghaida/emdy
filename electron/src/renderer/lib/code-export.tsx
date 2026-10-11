// Code blocks carry their syntax colors as inline styles from the live theme
// (react-syntax-highlighter inlines them and drops the token classes), so a
// dark theme printed, and pasted, light-gray code on a light page. Output that
// leaves the app (Print, PDF, Copy RTF) highlights them again in the print
// palette.

import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { buildPrismTheme } from './prism-theme';
import { PRINT_PALETTE } from './print-palette';

/** Syntax-highlighted code (CodeBlock's output), as opposed to inline code or
 * a fence without a language. */
export const HIGHLIGHTED_CODE_SELECTOR = '.code-block-wrapper code[class*="language-"]';

const LANGUAGE_PATTERN = /language-(\w+)/;

let printTheme: ReturnType<typeof buildPrismTheme> | null = null;

/** Re-highlight each syntax-highlighted code block under `root`, a detached
 * clone of the document, in the print palette. */
export function highlightCodeForExport(root: HTMLElement): void {
  const codes = root.querySelectorAll<HTMLElement>(HIGHLIGHTED_CODE_SELECTOR);
  if (codes.length === 0) return;
  if (!printTheme) printTheme = buildPrismTheme(PRINT_PALETTE);
  const theme = printTheme;

  const container = document.createElement('div');
  const reactRoot = createRoot(container);
  try {
    codes.forEach((code) => {
      const language = LANGUAGE_PATTERN.exec(code.className)?.[1];
      const highlighted = code.parentElement;
      if (!language || !highlighted) return;
      flushSync(() =>
        reactRoot.render(
          <SyntaxHighlighter style={theme} language={language} PreTag="div">
            {code.textContent ?? ''}
          </SyntaxHighlighter>
        )
      );
      const printed = container.firstElementChild;
      if (printed) highlighted.replaceWith(printed.cloneNode(true));
    });
  } finally {
    reactRoot.unmount();
  }
}
