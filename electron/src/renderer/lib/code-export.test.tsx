import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownView } from '../components/MarkdownView';
import { warm, type ColorScale } from './color-themes';
import { parseRgba } from './color';
import { PRINT_PALETTE } from './print-palette';
import { FULL_CODE_ATTR, prepareCodeForExport } from './code-export';

const SHORT = '```js\nconst a = 1;\n```';
const LONG_CODE = Array.from({ length: 250 }, (_, i) => `log(${i + 1});`).join('\n');
const LONG = '```js\n' + LONG_CODE + '\n```';

function rgb(hex: string): string {
  const { r, g, b } = parseRgba(hex)!;
  return `rgb(${r}, ${g}, ${b})`;
}

/** A detached copy of the document as MarkdownView renders it in `colors`. */
function exportCopy(content: string, colors: ColorScale): HTMLElement {
  const { container, unmount } = render(<MarkdownView content={content} colors={colors} />);
  const copy = container.firstElementChild!.cloneNode(true) as HTMLElement;
  unmount();
  return copy;
}

function codeBlocks(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.code-block-wrapper code')];
}

function tokenColor(code: HTMLElement, text: string): string {
  return ([...code.querySelectorAll('span')].find((s) => s.textContent === text) as HTMLElement).style.color;
}

describe('prepareCodeForExport', () => {
  it("keeps a light theme's code as it is on screen, without the copy button", () => {
    const root = exportCopy(SHORT, warm.light);
    const onScreen = codeBlocks(root)[0].outerHTML;

    prepareCodeForExport(root, { colors: warm.light, appearance: 'light' });

    expect(codeBlocks(root)[0].outerHTML).toBe(onScreen);
    expect(tokenColor(codeBlocks(root)[0], 'const')).toBe(rgb(warm.light.codeKeyword));
    expect(root.querySelector('.code-block-copy')).toBeNull();
  });

  it('exports a block cut short on screen in full, in the light theme\'s colors', () => {
    const root = exportCopy(LONG, warm.light);
    expect(codeBlocks(root)[0].textContent!.split('\n')).toHaveLength(200);

    prepareCodeForExport(root, { colors: warm.light, appearance: 'light' });

    const code = codeBlocks(root)[0];
    expect(code.textContent).toBe(LONG_CODE);
    expect(tokenColor(code, 'log')).toBe(rgb(warm.light.codeFunction));
    expect(root.querySelector('.code-block-show-all')).toBeNull();
    expect(root.querySelector(`[${FULL_CODE_ATTR}]`)).toBeNull();
  });

  it("re-highlights a dark theme's code in the print palette, in full", () => {
    const root = exportCopy(`${SHORT}\n\n${LONG}`, warm.dark);

    prepareCodeForExport(root, { colors: warm.dark, appearance: 'dark' });

    const [short, long] = codeBlocks(root);
    expect(short.style.color).toBe(rgb(PRINT_PALETTE.textPrimary));
    expect(tokenColor(short, 'const')).toBe(rgb(PRINT_PALETTE.codeKeyword));
    expect(long.textContent).toBe(LONG_CODE);
    expect(tokenColor(long, 'log')).toBe(rgb(PRINT_PALETTE.codeFunction));
    expect(root.innerHTML).not.toContain(rgb(warm.dark.textPrimary));
    expect(root.querySelector('.code-block-copy, .code-block-show-all')).toBeNull();
  });

  it('exports code in the print palette when the theme is unknown', () => {
    const root = exportCopy(SHORT, warm.light);

    prepareCodeForExport(root);

    expect(tokenColor(codeBlocks(root)[0], 'const')).toBe(rgb(PRINT_PALETTE.codeKeyword));
  });
});
