import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, screen, act } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';
import { warm } from '../lib/color-themes';
import { buildDiagramTheme } from '../lib/mermaid-theme';
import { resetMermaidForTests } from '../lib/mermaid-render';

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock('mermaid', () => ({ default: mermaid }));

const image = vi.hoisted(() => ({
  embedBundledFonts: vi.fn(async (svg: string) => svg),
  svgToPng: vi.fn(async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), scale: 2 })),
}));
vi.mock('../lib/diagram-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/diagram-image')>()),
  ...image,
}));

const SOURCE = 'graph TD\n  A-->B';
const doc = (source: string) => `Before\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\nAfter`;
const DOC = doc(SOURCE);
const svg = (id: string, size = 'viewBox="0 0 120 80"') =>
  `<svg id="${id}" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 120px;" ${size}><g class="node"></g></svg>`;
const SVG = svg('m');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const writeText = vi.fn();
const writeClipboardImage = vi.fn(async () => true);
const openExternal = vi.fn(async () => undefined);

beforeEach(() => {
  resetMermaidForTests();
  mermaid.initialize.mockReset();
  mermaid.render.mockReset();
  mermaid.render.mockResolvedValue({ svg: SVG });
  image.svgToPng.mockClear();
  image.embedBundledFonts.mockClear();
  writeText.mockClear();
  writeClipboardImage.mockClear();
  openExternal.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  (window as unknown as { electronAPI: Partial<Window['electronAPI']> }).electronAPI = { writeClipboardImage, openExternal };
});

const pngButton = () => screen.getByRole('button', { name: 'Copy diagram as PNG' }) as HTMLButtonElement;

describe('Mermaid blocks in MarkdownView', () => {
  it('renders a mermaid fence as a diagram in a code-style container', async () => {
    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);

    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());
    const block = container.querySelector('.mermaid-block')!;
    expect(block.getAttribute('data-mermaid-source')).toBe(SOURCE);
    expect(block.getAttribute('aria-busy')).toBe('false');
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

  it('copies the diagram source', () => {
    render(<MarkdownView content={DOC} colors={warm.light} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy diagram source' }));
    expect(writeText).toHaveBeenCalledWith(SOURCE);
  });

  it('copies a 2x PNG on the code-block background through the main process', async () => {
    const { container } = render(<MarkdownView content={DOC} colors={warm.dark} />);
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());

    fireEvent.click(pngButton());

    await waitFor(() => expect(writeClipboardImage).toHaveBeenCalledWith(new Uint8Array([137, 80, 78, 71]), 2));
    expect(image.embedBundledFonts).toHaveBeenCalledWith(SVG);
    expect(image.svgToPng).toHaveBeenCalledWith(SVG, 120, 80, {
      scale: 2,
      padding: 16,
      background: buildDiagramTheme(warm.dark).background,
    });
  });

  it('cannot copy a PNG of a diagram without a measurable size', async () => {
    mermaid.render.mockResolvedValue({ svg: svg('info', '') });
    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);
    await waitFor(() => expect(container.querySelector('.mermaid-diagram svg')).not.toBeNull());
    expect(pngButton().disabled).toBe(true);
  });

  it('keeps the previous diagram up while the new theme renders', async () => {
    const { container, rerender } = render(<MarkdownView content={DOC} colors={warm.light} />);
    await waitFor(() => expect(container.querySelector('#m')).not.toBeNull());
    const block = container.querySelector('.mermaid-block');

    const dark = deferred<{ svg: string }>();
    mermaid.render.mockReturnValue(dark.promise);
    rerender(<MarkdownView content={DOC} colors={warm.dark} />);

    // Same block, old diagram still showing, no placeholder, nothing stale to copy.
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2));
    expect(container.querySelector('.mermaid-block')).toBe(block);
    expect(container.querySelector('#m')).not.toBeNull();
    expect(container.querySelector('.mermaid-loading')).toBeNull();
    expect(block!.getAttribute('aria-busy')).toBe('true');
    expect(pngButton().disabled).toBe(true);
    expect(mermaid.initialize.mock.calls.at(-1)![0].themeVariables.darkMode).toBe(true);

    await act(async () => dark.resolve({ svg: svg('dark') }));
    expect(container.querySelector('#dark')).not.toBeNull();
    expect(container.querySelector('#m')).toBeNull();
    expect(pngButton().disabled).toBe(false);
  });

  it('never shows the previous file\'s diagram in the next file', async () => {
    const { container, rerender } = render(<MarkdownView content={DOC} colors={warm.light} filePath="/a.md" />);
    await waitFor(() => expect(container.querySelector('#m')).not.toBeNull());

    mermaid.render.mockReturnValue(deferred<{ svg: string }>().promise);
    rerender(<MarkdownView content={doc('pie\n  "x" : 1')} colors={warm.light} filePath="/b.md" />);

    expect(container.querySelector('#m')).toBeNull();
    expect(container.querySelector('.mermaid-loading')).not.toBeNull();
  });

  it('opens diagram links in the browser instead of navigating', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg id="l" viewBox="0 0 10 10"><a href="https://example.com/docs"><text id="label">Docs</text></a></svg>',
    });
    const { container } = render(<MarkdownView content={DOC} colors={warm.light} />);
    await waitFor(() => expect(container.querySelector('#label')).not.toBeNull());

    const notCancelled = fireEvent.click(container.querySelector('#label')!);

    expect(notCancelled).toBe(false);
    expect(openExternal).toHaveBeenCalledWith('https://example.com/docs');
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
