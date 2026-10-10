import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';
import { warm } from '../lib/color-themes';
import { buildDiagramTheme } from '../lib/mermaid-theme';
import { resetMermaidForTests } from '../lib/mermaid-render';

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock('mermaid', () => ({ default: mermaid }));

const image = vi.hoisted(() => ({
  embedBundledFonts: vi.fn(async (svg: string) => svg),
  svgToPng: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
}));
vi.mock('../lib/diagram-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/diagram-image')>()),
  ...image,
}));

const SOURCE = 'graph TD\n  A-->B';
const DOC = `Before\n\n\`\`\`mermaid\n${SOURCE}\n\`\`\`\n\nAfter`;
const SVG = '<svg id="m" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 120px;" viewBox="0 0 120 80"><g class="node"></g></svg>';

const writeText = vi.fn();
const writeClipboardImage = vi.fn(async () => true);

beforeEach(() => {
  resetMermaidForTests();
  mermaid.initialize.mockReset();
  mermaid.render.mockReset();
  mermaid.render.mockResolvedValue({ svg: SVG });
  image.svgToPng.mockClear();
  writeText.mockClear();
  writeClipboardImage.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  (window as unknown as { electronAPI: Partial<Window['electronAPI']> }).electronAPI = { writeClipboardImage };
});

describe('Mermaid blocks in MarkdownView', () => {
  it('renders a mermaid fence as a diagram in a code-style container', async () => {
    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);

    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());
    const block = container.querySelector('.mermaid-block')!;
    expect(block.getAttribute('data-mermaid-source')).toBe(SOURCE);
    expect(container.querySelector('pre')).toBeNull();
    // Sized in em so it scales with zoom: 120px at the 16px base.
    expect((container.querySelector('.mermaid-diagram') as HTMLElement).style.width).toBe('7.5em');
    expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), SOURCE);
  });

  it('leaves other code fences alone', () => {
    const { container } = render(<MarkdownView content={'```js\nconst a = 1;\n```'} colors={warm.light} />);
    expect(container.querySelector('pre .code-block-wrapper')).not.toBeNull();
    expect(container.querySelector('.mermaid-block')).toBeNull();
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it('shows the source and the parse error when the diagram does not render', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error on line 2'));
    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);

    await waitFor(() => expect(container.querySelector('.mermaid-error-block')).not.toBeNull());
    expect(container.querySelector('.mermaid-block')).toBeNull();
    expect(container.querySelector('.mermaid-error-block pre')!.textContent).toContain('A-->B');
    expect(container.querySelector('.mermaid-error-detail')!.textContent).toBe('Parse error on line 2');
  });

  it('copies the diagram source', async () => {
    render(<MarkdownView content={DOC} colors={warm.light} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagram source' }));
    expect(writeText).toHaveBeenCalledWith(SOURCE);
  });

  it('copies a 2x PNG on the code-block background through the main process', async () => {
    const { container } = render(<MarkdownView content={DOC} colors={warm.dark} />);
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagram as PNG' }));

    await waitFor(() => expect(writeClipboardImage).toHaveBeenCalledWith(new Uint8Array([137, 80, 78, 71])));
    expect(image.embedBundledFonts).toHaveBeenCalledWith(SVG);
    expect(image.svgToPng).toHaveBeenCalledWith(SVG, 120, 80, {
      scale: 2,
      padding: 16,
      background: buildDiagramTheme(warm.dark).background,
    });
  });

  it('renders again in the new palette when the theme changes', async () => {
    const { container, rerender } = render(<MarkdownView content={DOC} colors={warm.light} />);
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());

    rerender(<MarkdownView content={DOC} colors={warm.dark} />);

    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2));
    const lastConfig = mermaid.initialize.mock.calls.at(-1)![0];
    expect(lastConfig.themeVariables.darkMode).toBe(true);
  });

  it('paints a cached diagram on the first frame after a remount', async () => {
    const first = render(<MarkdownView content={DOC} colors={warm.light} />);
    await waitFor(() => expect(first.container.querySelector('.mermaid-diagram svg')).not.toBeNull());
    first.unmount();

    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);
    expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull();
    expect(container.querySelector('.mermaid-loading')).toBeNull();
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });
});
