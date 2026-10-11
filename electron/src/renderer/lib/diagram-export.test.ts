import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiagramResult } from './mermaid-render';
import {
  DIAGRAM_SOURCE_ATTR,
  diagramAlt,
  exportNeedsRendering,
  getExportDiagramTheme,
  inlineDiagramsForCopy,
  inlineDiagramsForPrint,
  renderCopyImages,
  renderExportDiagrams,
  type DiagramImage,
} from './diagram-export';
import { standaloneSvg } from './diagram-image';
import { SYSTEM_FONT_FAMILY } from './mermaid-theme';

const render = vi.hoisted(() => ({ renderDiagram: vi.fn(), getCachedDiagram: vi.fn() }));
vi.mock('./mermaid-render', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mermaid-render')>()),
  ...render,
}));

const png = vi.hoisted(() => vi.fn());
vi.mock('./diagram-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./diagram-image')>()),
  svgToPng: png,
}));

const SVG =
  '<svg id="emdy-mermaid-1" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart" ' +
  'style="max-width: 200px;" viewBox="0 0 200 100"><title>Checkout flow</title><g stroke-width="2"></g></svg>';
const RENDERED: DiagramResult = { ok: true, id: 'emdy-mermaid-1', svg: SVG, width: 200, height: 100 };

/** A markdown body with one diagram block per source, shaped like MermaidBlock's output. */
function bodyWith(...sources: string[]): HTMLElement {
  const body = document.createElement('div');
  body.className = 'markdown-body';
  for (const source of sources) {
    const block = document.createElement('div');
    block.className = 'mermaid-block';
    block.setAttribute(DIAGRAM_SOURCE_ATTR, source);
    block.innerHTML =
      '<div class="code-block-actions"><button class="code-block-copy">copy</button></div>' +
      `<div class="mermaid-diagram">${SVG}</div>`;
    body.appendChild(block);
  }
  return body;
}

/** A failed diagram, shaped like MermaidBlock's error state. */
function errorBlock(source: string): string {
  return (
    `<div class="mermaid-error-block"><pre><code>${source}</code></pre>` +
    '<div class="mermaid-error" role="note"><div>Couldn’t render this Mermaid diagram</div><div>Parse error</div></div></div>'
  );
}

function parseXml(svg: string): Element {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc.documentElement;
}

beforeEach(() => {
  render.renderDiagram.mockReset();
  render.renderDiagram.mockResolvedValue(RENDERED);
  render.getCachedDiagram.mockReset();
  png.mockReset();
  png.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), scale: 2 });
});

describe('renderExportDiagrams', () => {
  it('does nothing, and never loads Mermaid, without diagrams', async () => {
    const body = document.createElement('div');
    body.innerHTML = '<p>No diagrams here</p><pre><code>graph TD</code></pre>';
    expect((await renderExportDiagrams(body)).size).toBe(0);
    expect((await renderExportDiagrams(null)).size).toBe(0);
    expect(render.renderDiagram).not.toHaveBeenCalled();
  });

  it('renders each distinct source once with the neutral system-font theme', async () => {
    const results = await renderExportDiagrams(bodyWith('graph TD\n  A-->B', 'pie', 'graph TD\n  A-->B'));
    expect(render.renderDiagram).toHaveBeenCalledTimes(2);
    expect(render.renderDiagram).toHaveBeenCalledWith('graph TD\n  A-->B', getExportDiagramTheme());
    expect(getExportDiagramTheme().fontFamily).toBe(SYSTEM_FONT_FAMILY);
    expect([...results.keys()]).toEqual(['graph TD\n  A-->B', 'pie']);
  });

  it('records a failed render instead of rejecting', async () => {
    render.renderDiagram.mockRejectedValue(new Error('chunk failed to load'));
    const results = await renderExportDiagrams(bodyWith('pie'));
    expect(results.get('pie')).toEqual({ ok: false, error: 'chunk failed to load' });
  });
});

describe('exportNeedsRendering', () => {
  it('is true only when a diagram has no print render cached yet', () => {
    expect(exportNeedsRendering(null)).toBe(false);
    expect(exportNeedsRendering(document.createElement('div'))).toBe(false);

    render.getCachedDiagram.mockReturnValue(undefined);
    expect(exportNeedsRendering(bodyWith('pie'))).toBe(true);

    render.getCachedDiagram.mockReturnValue(RENDERED);
    expect(exportNeedsRendering(bodyWith('pie'))).toBe(false);
    expect(render.getCachedDiagram).toHaveBeenCalledWith('pie', getExportDiagramTheme());
  });
});

describe('renderCopyImages', () => {
  it('draws on the print surface at twice the pasted size', async () => {
    const images = await renderCopyImages(bodyWith('graph TD'));

    expect(png).toHaveBeenCalledWith(SVG, 200, 100, {
      scale: 2,
      padding: 8,
      background: getExportDiagramTheme().background,
    });
    expect(images.get('graph TD')).toEqual({
      src: 'data:image/png;base64,AQID',
      width: 216,
      height: 116,
      alt: 'Checkout flow',
    });
  });

  it('scales a wide diagram down to the pasted width before rasterizing', async () => {
    render.renderDiagram.mockResolvedValue({ ...RENDERED, width: 1264, height: 584 });
    const images = await renderCopyImages(bodyWith('wide'));

    // 1264 + 16 padding = 1280 wide, pasted at 640: half size, so 1x pixels.
    expect(png).toHaveBeenCalledWith(SVG, 1264, 584, expect.objectContaining({ scale: 1 }));
    expect(images.get('wide')).toMatchObject({ width: 640, height: 300 });
  });

  it('pastes source for failed, unmeasurable, or unrasterizable diagrams', async () => {
    render.renderDiagram.mockImplementation(async (source: string) => {
      if (source === 'broken') return { ok: false, error: 'Parse error' };
      if (source === 'info') return { ...RENDERED, height: 0 };
      return RENDERED;
    });
    png.mockRejectedValue(new Error('decode failed'));

    const images = await renderCopyImages(bodyWith('broken', 'info', 'graph TD'));

    expect([...images.values()]).toEqual([null, null, null]);
    expect(png).toHaveBeenCalledTimes(1);
  });
});

describe('inlineDiagramsForPrint', () => {
  it('replaces the live diagram with a standalone SVG image', () => {
    const body = bodyWith('graph TD');
    inlineDiagramsForPrint(body, new Map([['graph TD', RENDERED]]));

    const block = body.querySelector('.mermaid-block')!;
    expect(block.hasAttribute(DIAGRAM_SOURCE_ATTR)).toBe(false);
    expect(block.querySelector('.code-block-actions')).toBeNull();
    expect(block.querySelector('svg')).toBeNull();
    const img = block.querySelector('img')!;
    expect(img.className).toBe('mermaid-image');
    const src = img.getAttribute('src')!;
    expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    const root = parseXml(decodeURIComponent(src.slice(src.indexOf(',') + 1)));
    expect(root.getAttribute('width')).toBe('200');
    expect(root.getAttribute('height')).toBe('100');
    expect(img.width).toBe(200);
    expect(img.height).toBe(100);
    expect(img.alt).toBe('Checkout flow');
  });

  it('falls back to the source as a code block without a usable render', () => {
    const body = bodyWith('graph TD', 'broken', 'info');
    inlineDiagramsForPrint(
      body,
      new Map<string, DiagramResult>([
        ['broken', { ok: false, error: 'Parse error' }],
        ['info', { ...RENDERED, height: 0 }],
      ])
    );

    expect(body.querySelector('.mermaid-block')).toBeNull();
    const codes = [...body.querySelectorAll('pre > code.language-mermaid')].map((c) => c.textContent);
    expect(codes).toEqual(['graph TD', 'broken', 'info']);
  });

  it('drops the error note under a failed diagram and keeps its source', () => {
    const body = document.createElement('div');
    body.innerHTML = errorBlock('graph TD');
    inlineDiagramsForPrint(body, new Map());
    expect(body.querySelector('.mermaid-error')).toBeNull();
    expect(body.textContent).toBe('graph TD');
  });
});

describe('inlineDiagramsForCopy', () => {
  it('replaces each diagram block with a paragraph holding its PNG', () => {
    const body = bodyWith('graph TD');
    const image: DiagramImage = { src: 'data:image/png;base64,AAAA', width: 216, height: 116, alt: 'Diagram' };
    inlineDiagramsForCopy(body, new Map([['graph TD', image]]));

    expect(body.querySelector('.mermaid-block')).toBeNull();
    expect(body.innerHTML).toBe('<p><img src="data:image/png;base64,AAAA" width="216" height="116" alt="Diagram"></p>');
  });

  it('pastes the source when there is no image', () => {
    const body = bodyWith('graph TD');
    inlineDiagramsForCopy(body, new Map([['graph TD', null]]));
    expect(body.innerHTML).toBe('<pre><code class="language-mermaid">graph TD</code></pre>');
  });

  it('drops the error note under a failed diagram', () => {
    const body = document.createElement('div');
    body.innerHTML = errorBlock('graph TD');
    inlineDiagramsForCopy(body, new Map());
    expect(body.querySelector('.mermaid-error')).toBeNull();
    expect(body.querySelector('pre')!.textContent).toBe('graph TD');
  });
});

describe('standaloneSvg', () => {
  it('gives the root a fixed size and drops the inline max-width', () => {
    const root = parseXml(standaloneSvg(SVG, 200.123, 100));
    expect(root.getAttribute('width')).toBe('200.12');
    expect(root.getAttribute('height')).toBe('100');
    expect(root.getAttribute('style') ?? '').not.toContain('max-width');
    expect(root.getAttribute('viewBox')).toBe('0 0 200 100');
    expect(root.querySelector('g')!.getAttribute('stroke-width')).toBe('2');
  });

  it('turns Mermaid\'s HTML-style markup into XML an image can load', () => {
    const html =
      '<svg viewBox="0 0 10 10"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">' +
      'Line one<br>Line&nbsp;two</div></foreignObject></svg>';
    const root = parseXml(standaloneSvg(html, 10, 10));
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('div')!.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(root.querySelector('br')).not.toBeNull();
    expect(root.textContent).toBe('Line oneLine two');
  });
});

describe('diagramAlt', () => {
  it('uses the accessible title, or a generic label', () => {
    expect(diagramAlt(SVG)).toBe('Checkout flow');
    expect(diagramAlt('<svg><g></g></svg>')).toBe('Diagram');
  });

  it('ignores <title> tooltips nested inside the diagram', () => {
    expect(diagramAlt('<svg><g><title>Me</title></g></svg>')).toBe('Diagram');
  });

  it('decodes the escaped text Mermaid stores, even in HTML-style markup', () => {
    expect(diagramAlt('<svg><title>Q&amp;amp;A flow</title><g><br></g></svg>')).toBe('Q&A flow');
  });
});
