import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCopyHtml } from './copy-html';

describe('buildCopyHtml', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('returns plain innerHTML unchanged when there is no design content', () => {
    host.innerHTML = '<div class="markdown-body"><p>Just prose.</p></div>';
    expect(buildCopyHtml(host)).toBe(host.innerHTML);
  });

  it('emits no var(--…) and no live theme colors for a design block', () => {
    // Simulate the live viewer painting dark-theme colors onto the elements.
    // (Values chosen not to collide with any neutral print color.)
    host.style.setProperty('background-color', 'rgb(18, 20, 26)');
    host.style.setProperty('color', 'rgb(233, 231, 227)');
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block" style="background-color: rgb(18, 20, 26);">' +
      '<div class="design-token-name" style="color: var(--text-primary);">primary</div>' +
      '</div></div>';

    const out = buildCopyHtml(host);
    // The transform must never resolve custom properties from the live theme.
    expect(out).not.toContain('var(--');
    // The dark theme text color must not leak into the output.
    expect(out).not.toContain('rgb(233, 231, 227)');
    // The neutral token-name color (#2C2C2C) is applied, overriding the var().
    expect(out).toContain('rgb(44, 44, 44)');
  });

  it('replaces the swatch grid with a table carrying the swatch background inline', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block">' +
      '<div class="design-swatches">' +
      '<div class="design-swatch-item">' +
      '<div class="design-swatch" style="background-color: rgb(184, 66, 46);"></div>' +
      '<div class="design-token-name">tertiary</div>' +
      '<div class="design-token-value">#B8422E</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const table = parsed.querySelector('.design-block table');
    expect(table).toBeTruthy();
    // A cell should carry the swatch background-color inline.
    const shaded = Array.from(parsed.querySelectorAll('td')).find((td) =>
      (td.getAttribute('style') || '').includes('184, 66, 46'),
    );
    expect(shaded).toBeTruthy();
    // The token name and value text survive.
    expect(table?.textContent).toContain('tertiary');
    expect(table?.textContent).toContain('#B8422E');
  });

  it('leaves an unshaded swatch cell for an invalid color (no swatch element)', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-swatches">' +
      '<div class="design-swatch-item">' +
      '<div class="design-token-name">bad</div>' +
      '<div class="design-token-value">not-a-color</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const firstTd = parsed.querySelector('tr td');
    expect(firstTd).toBeTruthy();
    expect(firstTd?.getAttribute('style') || '').not.toContain('background-color');
  });

  it('replaces the spacing scale with a table whose bar div keeps its inline width', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">sm</div>' +
      '<div class="design-token-value">8px</div>' +
      '<div class="design-spacing-bar" style="width: 8px;"></div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const row = parsed.querySelector('.design-block table tr');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('sm');
    expect(row?.textContent).toContain('8px');
    const bar = parsed.querySelector('.design-block table tr td div');
    expect(bar?.getAttribute('style') || '').toContain('width: 8px');
  });

  it('keeps the radius squares as divs with a concrete border-radius', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale design-scale--radius">' +
      '<div class="design-radius-item">' +
      '<div class="design-radius-square" style="border-radius: 8px;"></div>' +
      '<div class="design-token-name">md</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const square = parsed.querySelector('.design-radius-square');
    const style = square?.getAttribute('style') || '';
    expect(style).toContain('border-radius: 8px');
    expect(style).toContain('rgb(228, 228, 228)'); // #E4E4E4 normalized by the DOM
  });

  it('removes the fallback note (viewer chrome)', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-specimens"><div class="design-specimen-row">' +
      '<div class="design-specimen">Body</div>' +
      '<div class="design-token-value">meta<span class="design-fallback-note"> — fallback</span></div>' +
      '</div></div></div></div>';

    const out = buildCopyHtml(host);
    expect(out).not.toContain('design-fallback-note');
    expect(out).not.toContain('fallback');
  });

  it('inlines neutral styles onto component-table cells without any var(--…)', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-components"><div class="design-component">' +
      '<div class="design-component-name">Button</div>' +
      '<table class="design-component-table"><tbody>' +
      '<tr><td class="design-token-name">background</td>' +
      '<td class="design-token-value">' +
      '<span class="design-mini-swatch" style="background-color: rgb(1, 2, 3);"></span>#010203</td></tr>' +
      '</tbody></table></div></div></div></div>';

    const out = buildCopyHtml(host);
    expect(out).not.toContain('var(--');
    const parsed = new DOMParser().parseFromString(out, 'text/html');
    const firstTd = parsed.querySelector('.design-component-table td');
    expect(firstTd?.getAttribute('style') || '').toContain('width: 200px');
    const swatch = parsed.querySelector('.design-mini-swatch');
    expect(swatch?.getAttribute('style') || '').toContain('1, 2, 3');
  });

  it('triggers on a bare design-header without a design-block', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-header"><div class="design-header-desc">notes</div></div>' +
      '</div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    expect(parsed.querySelector('.design-header')?.getAttribute('style')).toBeTruthy();
  });
});
