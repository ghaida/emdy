import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildPrintPayload } from './print-payload';

describe('buildPrintPayload', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('returns null when there is no open file', () => {
    host.innerHTML = '<div class="markdown-body"><p>Hi</p></div>';
    expect(buildPrintPayload(host, null)).toBeNull();
  });

  it('returns null when there is no .markdown-body', () => {
    host.innerHTML = '<p>No markdown body here</p>';
    expect(buildPrintPayload(host, '/docs/readme.md')).toBeNull();
  });

  it('returns null when the content root is null', () => {
    expect(buildPrintPayload(null, '/docs/readme.md')).toBeNull();
  });

  it('strips .code-block-copy buttons from the output', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="code-block-wrapper">' +
      '<button class="code-block-copy">Copy</button>' +
      '<pre><code>const x = 1;</code></pre>' +
      '</div></div>';

    const payload = buildPrintPayload(host, '/docs/readme.md');
    expect(payload).not.toBeNull();
    expect(payload!.html).not.toContain('code-block-copy');
    expect(payload!.html).not.toContain('Copy');
    expect(payload!.html).toContain('const x = 1;');
  });

  it('rewrites inline flex/inline-flex display to block', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div style="display: flex;">a</div>' +
      '<span style="display: inline-flex;">b</span>' +
      '</div>';

    const payload = buildPrintPayload(host, '/docs/readme.md');
    expect(payload).not.toBeNull();
    const parsed = new DOMParser().parseFromString(payload!.html, 'text/html');
    parsed.querySelectorAll('[style]').forEach((el) => {
      const display = (el as HTMLElement).style.display;
      expect(display).not.toBe('flex');
      expect(display).not.toBe('inline-flex');
    });
  });

  it('strips inline fixed height, maxHeight, and hidden overflow', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div style="height: 120px; max-height: 200px; overflow: hidden;">x</div>' +
      '</div>';

    const payload = buildPrintPayload(host, '/docs/readme.md');
    const el = new DOMParser()
      .parseFromString(payload!.html, 'text/html')
      .querySelector('[style]') as HTMLElement;
    expect(el.style.height).toBe('auto');
    expect(el.style.maxHeight).toBe('none');
    expect(el.style.overflow).toBe('visible');
  });

  it('swaps diagrams for their print renders', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="mermaid-block" data-mermaid-source="graph TD">' +
      '<div class="code-block-actions"><button class="code-block-copy">Copy</button></div>' +
      '<div class="mermaid-diagram" style="width: 10em"><svg id="live"></svg></div>' +
      '</div></div>';
    const printRender = {
      ok: true as const,
      id: 'emdy-mermaid-9',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"></svg>',
      width: 160,
      height: 90,
    };

    const html = buildPrintPayload(host, '/docs/readme.md', new Map([['graph TD', printRender]]))!.html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const img = doc.querySelector('.mermaid-block > img.mermaid-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(img.width).toBe(160);
    expect(doc.querySelector('#live')).toBeNull();
    expect(html).not.toContain('Copy');
  });

  it('derives the title from the file path basename', () => {
    host.innerHTML = '<div class="markdown-body"><p>Hi</p></div>';
    expect(buildPrintPayload(host, '/a/b/notes.md')!.title).toBe('notes.md');
  });
});
