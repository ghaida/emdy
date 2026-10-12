// Output that leaves the app (Print, PDF, Copy RTF) takes its code blocks from
// the live document, and they need three fixes on the way out. Their buttons
// go. A block cut short on screen (see CodeBlock) gets its full code back. And
// a dark theme's colors, which react-syntax-highlighter inlines on every token,
// would print, and paste, light-gray code on a light page, so a dark theme's
// code is highlighted again in the print palette. A light theme's colors work
// on paper and stay.

import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { ColorScale } from './color-themes';
import { buildPrismTheme } from './prism-theme';
import { PRINT_PALETTE } from './print-palette';

/** The theme the document is shown in. */
export interface ViewTheme {
  colors: ColorScale;
  appearance: 'light' | 'dark';
}

/** CodeBlock's wrapper, around a fenced block with a language. */
export const CODE_BLOCK_SELECTOR = '.code-block-wrapper';

/** Holds the full code of a block cut short on screen. */
export const FULL_CODE_ATTR = 'data-full-code';

const CONTROLS_SELECTOR = '.code-block-copy, .code-block-show-all';
const LANGUAGE_PATTERN = /language-(\w+)/;

const prismThemes = new WeakMap<ColorScale, ReturnType<typeof buildPrismTheme>>();

function prismThemeFor(colors: ColorScale): ReturnType<typeof buildPrismTheme> {
  let theme = prismThemes.get(colors);
  if (!theme) {
    theme = buildPrismTheme(colors);
    prismThemes.set(colors, theme);
  }
  return theme;
}

/** Prepare the code blocks under `root`, a detached clone of the document, for
 * export from `theme`. Without a theme, code goes out in the print palette. */
export function prepareCodeForExport(root: HTMLElement, theme?: ViewTheme): void {
  root.querySelectorAll(CONTROLS_SELECTOR).forEach((control) => control.remove());

  const keptColors = theme?.appearance === 'light' ? theme.colors : null;
  const jobs: { highlighted: Element; language: string; code: string }[] = [];
  root.querySelectorAll(CODE_BLOCK_SELECTOR).forEach((block) => {
    const fullCode = block.getAttribute(FULL_CODE_ATTR);
    block.removeAttribute(FULL_CODE_ATTR);
    // Already complete, in colors that can stay.
    if (keptColors && fullCode === null) return;
    const code = block.querySelector('code[class*="language-"]');
    const language = code && LANGUAGE_PATTERN.exec(code.className)?.[1];
    const highlighted = code?.parentElement;
    if (!code || !language || !highlighted) return;
    jobs.push({ highlighted, language, code: fullCode ?? code.textContent ?? '' });
  });
  if (jobs.length === 0) return;

  // One render for all blocks. Rendering them one after another into the same
  // root makes each an update of the last, which for a long block measured
  // several times slower than mounting it.
  const style = prismThemeFor(keptColors ?? PRINT_PALETTE);
  const container = document.createElement('div');
  const reactRoot = createRoot(container);
  try {
    flushSync(() =>
      reactRoot.render(
        jobs.map((job, i) => (
          <SyntaxHighlighter key={i} style={style} language={job.language} PreTag="div">
            {job.code}
          </SyntaxHighlighter>
        ))
      )
    );
    jobs.forEach((job, i) => {
      const exported = container.children[i];
      if (exported) job.highlighted.replaceWith(exported.cloneNode(true));
    });
  } finally {
    reactRoot.unmount();
  }
}
