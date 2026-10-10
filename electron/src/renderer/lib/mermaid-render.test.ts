import { describe, it, expect, vi, beforeEach } from 'vitest';
import { themes } from './color-themes';
import { buildDiagramTheme } from './mermaid-theme';
import {
  fillMarkersWith,
  getCachedDiagram,
  measureSvg,
  renderDiagram,
  resetMermaidForTests,
} from './mermaid-render';

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock('mermaid', () => ({ default: mermaid }));

const light = buildDiagramTheme(themes.warm.light);
const dark = buildDiagramTheme(themes.warm.dark);

const svg = (width = 120, height = 80) =>
  `<svg id="d" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: ${width}px;" viewBox="0 0 ${width} ${height}"><g></g></svg>`;

beforeEach(() => {
  resetMermaidForTests();
  mermaid.initialize.mockReset();
  mermaid.render.mockReset();
  mermaid.render.mockImplementation(async () => ({ svg: svg() }));
});

describe('renderDiagram', () => {
  it('renders with the strict base theme and reports the natural size', async () => {
    const result = await renderDiagram('graph TD; A-->B', light);

    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: light.variables,
        fontFamily: light.fontFamily,
      })
    );
    expect(result).toEqual({
      ok: true,
      id: expect.stringMatching(/^emdy-mermaid-\d+$/),
      svg: svg(),
      width: 120,
      height: 80,
    });
  });

  it('caches by source and theme', async () => {
    await renderDiagram('graph TD; A-->B', light);
    await renderDiagram('graph TD; A-->B', light);
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(getCachedDiagram('graph TD; A-->B', light)).toMatchObject({ ok: true });

    expect(getCachedDiagram('graph TD; A-->B', dark)).toBeUndefined();
    await renderDiagram('graph TD; A-->B', dark);
    expect(mermaid.render).toHaveBeenCalledTimes(2);
  });

  it('shares one render between concurrent requests for the same diagram', async () => {
    const [a, b] = await Promise.all([renderDiagram('pie', light), renderDiagram('pie', light)]);
    expect(a).toBe(b);
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });

  it('never lets one diagram render with another diagram\'s theme', async () => {
    const calls: string[] = [];
    mermaid.initialize.mockImplementation((config: { themeVariables: { darkMode: boolean } }) => {
      calls.push(`init dark=${config.themeVariables.darkMode}`);
    });
    mermaid.render.mockImplementation(async () => {
      calls.push('render start');
      await new Promise((resolve) => setTimeout(resolve, 5));
      calls.push('render end');
      return { svg: svg() };
    });

    await Promise.all([renderDiagram('a', light), renderDiagram('b', dark)]);

    expect(calls).toEqual([
      'init dark=false', 'render start', 'render end',
      'init dark=true', 'render start', 'render end',
    ]);
  });

  it('turns a parse error into a cached error result', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error on line 1'));
    expect(await renderDiagram('nonsense', light)).toEqual({ ok: false, error: 'Parse error on line 1' });
    await renderDiagram('nonsense', light);
    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });

  it('removes a scratch element Mermaid leaves behind on error', async () => {
    mermaid.render.mockImplementation(async (id: string) => {
      const scratch = document.createElement('div');
      scratch.id = `d${id}`;
      document.body.appendChild(scratch);
      throw new Error('boom');
    });
    await renderDiagram('broken', light);
    expect(document.querySelector('[id^="demdy-mermaid-"]')).toBeNull();
  });

  it('gives hard-coded white marker fills the diagram background', async () => {
    mermaid.render.mockResolvedValue({
      svg: '<svg viewBox="0 0 10 10"><marker id="m"><circle fill="white"></circle></marker><rect fill="white"></rect></svg>',
    });
    const result = await renderDiagram('erDiagram', dark);
    expect(result.ok && result.svg).toContain(`<circle fill="${dark.background}">`);
    expect(result.ok && result.svg).toContain('<rect fill="white">');
  });
});

describe('fillMarkersWith', () => {
  it('only touches fills inside <marker> elements', () => {
    const input = '<svg><marker><path fill="white"/></marker><g fill="white"/><marker><circle fill="white"/></marker></svg>';
    expect(fillMarkersWith(input, '#123456')).toBe(
      '<svg><marker><path fill="#123456"/></marker><g fill="white"/><marker><circle fill="#123456"/></marker></svg>'
    );
  });
});

describe('measureSvg', () => {
  it('reads the size from the viewBox', () => {
    expect(measureSvg('<svg viewBox="-50 -10 594 455.5" style="max-width: 594px;">')).toEqual({ width: 594, height: 455.5 });
  });

  it('falls back to the inline max-width', () => {
    expect(measureSvg('<svg width="100%" style="max-width: 300px;">')).toEqual({ width: 300, height: 0 });
  });

  it('reports zero when the size is unknown', () => {
    expect(measureSvg('<svg width="100%">')).toEqual({ width: 0, height: 0 });
  });
});
