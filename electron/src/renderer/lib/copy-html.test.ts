import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCopyHtml, flattenColor } from './copy-html';

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
    // The block's container background is stripped (no RTF shading band).
    expect(out).not.toContain('rgb(18, 20, 26)');
  });

  it('strips the container background from the block wrapper', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block" style="background: rgb(240, 240, 240); border-radius: 6px;">' +
      '<div class="design-token-name">x</div>' +
      '</div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const block = parsed.querySelector('.design-block') as HTMLElement;
    expect(block).toBeTruthy();
    const style = block.getAttribute('style') || '';
    expect(style).not.toContain('background');
    expect(style).not.toContain('border-radius');
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

  it('replaces the spacing scale with a table whose bar is a shaded td with an explicit width', () => {
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
    // No inner bar div survives — the bar is the cell itself.
    expect(parsed.querySelector('.design-block table tr td div')).toBeNull();
    // The third cell (the bar) carries the width and the neutral shade.
    const barTd = parsed.querySelectorAll('.design-block table tr td')[2] as HTMLElement;
    const style = barTd?.getAttribute('style') || '';
    expect(style).toContain('width: 8px');
    expect(style).toContain('rgb(44, 44, 44)'); // #2C2C2C normalized by the DOM
  });

  it('caps the spacing bar cell width so long bars do not blow up the paste', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">xl</div>' +
      '<div class="design-token-value">640px</div>' +
      '<div class="design-spacing-bar" style="width: 640px;"></div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const barTd = parsed.querySelectorAll('.design-block table tr td')[2] as HTMLElement;
    expect(barTd?.getAttribute('style') || '').toContain('width: 300px');
  });

  it('replaces the radius scale with a name/value table and no text-align center', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale design-scale--radius">' +
      '<div class="design-radius-item">' +
      '<div class="design-radius-square" style="border-radius: 8px;"></div>' +
      '<div class="design-token-name">md</div>' +
      '<div class="design-token-value">8px</div>' +
      '</div></div></div></div>';

    const out = buildCopyHtml(host);
    // No sized square divs and no centering survive.
    expect(out).not.toContain('design-radius-square');
    expect(out).not.toContain('text-align: center');
    const parsed = new DOMParser().parseFromString(out, 'text/html');
    const row = parsed.querySelector('.design-block table tr');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('md');
    expect(row?.textContent).toContain('8px');
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

  it('renders the component color as a shaded chip td and drops the mini-swatch span', () => {
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
    // The sized <span> is gone; RTF would drop it.
    expect(out).not.toContain('design-mini-swatch');
    const parsed = new DOMParser().parseFromString(out, 'text/html');
    const cells = parsed.querySelectorAll('.design-component-table td');
    // property (200px) | chip (shaded) | value
    expect(cells[0]?.getAttribute('style') || '').toContain('width: 200px');
    const chipStyle = cells[1]?.getAttribute('style') || '';
    expect(chipStyle).toContain('width: 16px');
    expect(chipStyle).toContain('rgb(1, 2, 3)'); // #010203 normalized by the DOM
    expect(cells[2]?.textContent).toContain('#010203');
  });

  it('leaves an unshaded chip td when the component value is not a valid color', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-components"><div class="design-component">' +
      '<div class="design-component-name">Button</div>' +
      '<table class="design-component-table"><tbody>' +
      '<tr><td class="design-token-name">radius</td>' +
      '<td class="design-token-value">8px</td></tr>' +
      '</tbody></table></div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const cells = parsed.querySelectorAll('.design-component-table td');
    const chipStyle = cells[1]?.getAttribute('style') || '';
    expect(chipStyle).toContain('width: 16px');
    expect(chipStyle).not.toContain('background');
  });

  it('triggers on a bare design-header without a design-block', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-header"><div class="design-header-desc">notes</div></div>' +
      '</div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    expect(parsed.querySelector('.design-header')?.getAttribute('style')).toBeTruthy();
  });

  // The swatch bg is flattened before it reaches the cell, so a translucent
  // token pastes as its composite-over-#333 shade instead of a blank white cell.
  it('flattens a translucent swatch color over the dark neutral backdrop', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-swatches">' +
      '<div class="design-swatch-item">' +
      '<div class="design-swatch" style="background-color: rgba(255, 255, 255, 0.1);"></div>' +
      '<div class="design-token-name">glass</div>' +
      '<div class="design-token-value">rgba(255, 255, 255, 0.1)</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    // #474747 = white@0.1 composited over #333333, normalized by the DOM.
    const shaded = Array.from(parsed.querySelectorAll('td')).find((td) =>
      (td.getAttribute('style') || '').includes('rgb(71, 71, 71)'),
    );
    expect(shaded).toBeTruthy();
    // The raw translucent value never reaches any cell's inline style (it may
    // still appear as the token-value TEXT, which is fine).
    const anyAlphaBg = Array.from(parsed.querySelectorAll('td')).some((td) =>
      (td.getAttribute('style') || '').includes('rgba('),
    );
    expect(anyAlphaBg).toBe(false);
  });

  it('passes an opaque swatch color through the flatten (unchanged shade)', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-swatches">' +
      '<div class="design-swatch-item">' +
      '<div class="design-swatch" style="background-color: rgb(184, 66, 46);"></div>' +
      '<div class="design-token-name">tertiary</div>' +
      '<div class="design-token-value">#B8422E</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const shaded = Array.from(parsed.querySelectorAll('td')).find((td) =>
      (td.getAttribute('style') || '').includes('184, 66, 46'),
    );
    expect(shaded).toBeTruthy();
  });
});

describe('flattenColor', () => {
  it('returns an opaque hex color unchanged in value', () => {
    expect(flattenColor('#2f3131')).toBe('#2f3131');
  });

  it('composites white at 0.1 alpha over #333333', () => {
    // 255*0.1 + 51*0.9 = 71.4 -> 71 -> 0x47
    expect(flattenColor('rgba(255, 255, 255, 0.1)')).toBe('#474747');
  });

  it('composites white at 0.2 alpha over #333333', () => {
    // 255*0.2 + 51*0.8 = 91.8 -> 92 -> 0x5c
    expect(flattenColor('rgba(255,255,255,0.2)')).toBe('#5c5c5c');
  });

  it('flattens the #rrggbbaa hex form too', () => {
    // #ffffff1a = white at 26/255 ≈ 0.10196 alpha.
    // 255*0.10196 + 51*0.89804 = 26 + 45.8 = 71.8 -> 72 -> 0x48
    expect(flattenColor('#ffffff1a')).toBe('#484848');
  });

  it('returns null for an unparseable color', () => {
    expect(flattenColor('oklch(0.7 0.1 200)')).toBeNull();
    expect(flattenColor('rebeccapurple')).toBeNull();
  });
});
