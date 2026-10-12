import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildPrintPayload, preparePrintPayload } from './print-payload';
import { warm } from './color-themes';

const renderDiagram = vi.hoisted(() => vi.fn());
vi.mock('./mermaid-render', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mermaid-render')>()),
  renderDiagram,
}));

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

  it('prints the document as it was when Print was chosen, even if another file opens meanwhile', async () => {
    host.innerHTML =
      '<div class="markdown-body"><p>From A</p>' +
      '<div class="mermaid-block" data-mermaid-source="graph TD"><svg></svg></div></div>';
    let finishRender!: (result: unknown) => void;
    renderDiagram.mockReturnValue(new Promise((resolve) => (finishRender = resolve)));

    const pending = preparePrintPayload(host, '/docs/a.md');
    host.innerHTML = '<div class="markdown-body"><p>From B</p></div>';
    finishRender({ ok: true, id: 'd', svg: '<svg viewBox="0 0 40 20"></svg>', width: 40, height: 20 });
    const payload = (await pending)!;

    expect(payload.title).toBe('a.md');
    expect(payload.html).toContain('From A');
    expect(payload.html).not.toContain('From B');
    expect(payload.html).toContain('mermaid-image');
  });

  it("prints a dark theme's code in the print palette", () => {
    // A JavaScript block as react-syntax-highlighter renders it in Warm dark:
    // colors inlined, token types dropped, plain text in the theme's light gray.
    host.innerHTML =
      '<div class="markdown-body"><pre><div class="code-block-wrapper">' +
      '<button class="code-block-copy">Copy</button>' +
      '<div style="color: rgb(217, 210, 198);"><code class="language-js" style="color: rgb(217, 210, 198);">' +
      '<span class="token" style="color: rgb(143, 168, 62); font-weight: 600;">const</span>' +
      '<span> regular </span><span class="token" style="color: rgb(156, 148, 136);">=</span>' +
      '<span> </span><span class="token" style="color: rgb(212, 116, 24);">\'code block\'</span>' +
      '</code></div></div></pre></div>';

    const html = buildPrintPayload(host, '/docs/readme.md', new Map(), { colors: warm.dark, appearance: 'dark' })!.html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const code = doc.querySelector('.code-block-wrapper code') as HTMLElement;

    expect(html).not.toContain('rgb(217, 210, 198)');
    expect(code.textContent).toBe("const regular = 'code block'");
    expect(code.style.color).toBe('rgb(44, 44, 44)'); // print text
    const tokenColor = (text: string) =>
      ([...code.querySelectorAll('span')].find((s) => s.textContent === text) as HTMLElement).style.color;
    expect(tokenColor('const')).toBe('rgb(173, 61, 164)'); // print keyword
    expect(tokenColor("'code block'")).toBe('rgb(192, 42, 23)'); // print string
    expect(doc.querySelector('.code-block-copy')).toBeNull();
  });

  it("keeps a light theme's code colors and prints cut-short code in full, without its buttons", async () => {
    host.innerHTML =
      '<div class="markdown-body"><pre><div class="code-block-wrapper" data-full-code="let a = 1;\nlet b = 2;">' +
      '<button class="code-block-copy">Copy</button>' +
      '<div style="color: rgb(58, 55, 50);"><code class="language-js" style="color: rgb(58, 55, 50);">' +
      '<span class="token" style="color: rgb(95, 107, 45); font-weight: 600;">let</span><span> a = 1;</span>' +
      '</code></div><button class="code-block-show-all">Show all 2 lines</button></div></pre></div>';

    const html = (await preparePrintPayload(host, '/docs/readme.md', { colors: warm.light, appearance: 'light' }))!.html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const code = doc.querySelector('.code-block-wrapper code') as HTMLElement;

    expect(code.textContent).toBe('let a = 1;\nlet b = 2;');
    expect(code.style.color).toBe('rgb(58, 55, 50)'); // Warm light text
    expect((code.querySelector('span') as HTMLElement).style.color).toBe('rgb(95, 107, 45)'); // Warm light keyword
    expect(html).not.toContain('Show all');
    expect(html).not.toContain('data-full-code');
    expect(doc.querySelector('.code-block-copy')).toBeNull();
  });

  it('derives the title from the file path basename', () => {
    host.innerHTML = '<div class="markdown-body"><p>Hi</p></div>';
    expect(buildPrintPayload(host, '/a/b/notes.md')!.title).toBe('notes.md');
  });
});
