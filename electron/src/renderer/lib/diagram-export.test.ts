import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiagramResult } from './mermaid-render';
import {
  DIAGRAM_SOURCE_ATTR,
  diagramAlt,
  getExportDiagramTheme,
  inlineDiagramsForCopy,
  inlineDiagramsForPrint,
  renderExportDiagrams,
  type DiagramImage,
} from './diagram-export';
import { standaloneSvg } from './diagram-image';
import { SYSTEM_FONT_FAMILY } from './mermaid-theme';

const render = vi.hoisted(() => vi.fn());
vi.mock('./mermaid-render', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mermaid-render')>()),
  renderDiagram: render,
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

beforeEach(() => {
  render.mockReset();
  render.mockResolvedValue(RENDERED);
});

describe('renderExportDiagrams', () => {
  it('does nothing, and never loads Mermaid, without diagrams', async () => {
    const body = document.createElement('div');
    body.innerHTML = '<p>No diagrams here</p><pre><code>graph TD</code></pre>';
    expect((await renderExportDiagrams(body)).size).toBe(0);
    expect((await renderExportDiagrams(null)).size).toBe(0);
    expect(render).not.toHaveBeenCalled();
  });

  it('renders each distinct source once with the neutral system-font theme', async () => {
    const results = await renderExportDiagrams(bodyWith('graph TD\n  A-->B', 'pie', 'graph TD\n  A-->B'));
    expect(render).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledWith('graph TD\n  A-->B', getExportDiagramTheme());
    expect(getExportDiagramTheme().fontFamily).toBe(SYSTEM_FONT_FAMILY);
    expect([...results.keys()]).toEqual(['graph TD\n  A-->B', 'pie']);
  });

  it('records a failed render instead of rejecting', async () => {
    render.mockRejectedValue(new Error('chunk failed to load'));
    const results = await renderExportDiagrams(bodyWith('pie'));
    expect(results.get('pie')).toEqual({ ok: false, error: 'chunk failed to load' });
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
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(img.getAttribute('src')!)).toContain('<svg width="200" height="100"');
    expect(img.width).toBe(200);
    expect(img.height).toBe(100);
    expect(img.alt).toBe('Checkout flow');
  });

  it('falls back to the source as a code block without a usable render', () => {
    const body = bodyWith('graph TD', 'broken');
    inlineDiagramsForPrint(body, new Map([['broken', { ok: false, error: 'Parse error' }]]));

    expect(body.querySelector('.mermaid-block')).toBeNull();
    const codes = [...body.querySelectorAll('pre > code.language-mermaid')].map((c) => c.textContent);
    expect(codes).toEqual(['graph TD', 'broken']);
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
});

describe('standaloneSvg', () => {
  it('gives the root a fixed size and drops the inline max-width', () => {
    const out = standaloneSvg(SVG, 200.123, 100);
    const root = /<svg[^>]*>/.exec(out)![0];
    expect(root).toContain('width="200.12" height="100"');
    expect(root).not.toContain('100%');
    expect(root).not.toContain('max-width');
    expect(root).toContain('viewBox="0 0 200 100"');
    expect(out).toContain('<g stroke-width="2">');
  });

  it('adds the SVG namespace when it is missing', () => {
    expect(standaloneSvg('<svg viewBox="0 0 1 1"></svg>', 1, 1)).toBe(
      '<svg width="1" height="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'
    );
  });
});

describe('diagramAlt', () => {
  it('uses the accessible title, or a generic label', () => {
    expect(diagramAlt(SVG)).toBe('Checkout flow');
    expect(diagramAlt('<svg><g></g></svg>')).toBe('Diagram');
  });
});
