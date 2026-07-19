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

  it('derives the title from the file path basename', () => {
    host.innerHTML = '<div class="markdown-body"><p>Hi</p></div>';
    expect(buildPrintPayload(host, '/a/b/notes.md')!.title).toBe('notes.md');
  });
});
