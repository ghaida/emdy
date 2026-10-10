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

  it('replaces the spacing scale with one single-row table whose bar is a shaded td with an explicit width', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">sm</div>' +
      '<div class="design-token-value">8px</div>' +
      '<div class="design-spacing-bar" style="width: 8px;"></div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    // One token → exactly one table, one row.
    const tables = parsed.querySelectorAll('.design-block table');
    expect(tables.length).toBe(1);
    const row = parsed.querySelector('.design-block table tr');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('sm');
    expect(row?.textContent).toContain('8px');
    // No inner bar div survives — the bar is the cell itself.
    expect(parsed.querySelector('.design-block table tr td div')).toBeNull();
    // The table must NOT be full width — the filler cell absorbs slack instead.
    expect(tables[0]?.getAttribute('style') || '').not.toContain('width: 100%');
    // name | value | bar | filler = four cells.
    const cells = parsed.querySelectorAll('.design-block table tr td');
    expect(cells.length).toBe(4);
    // The third cell (the bar) carries its OWN width and the neutral shade.
    const barTd = cells[2] as HTMLElement;
    const style = barTd?.getAttribute('style') || '';
    expect(style).toContain('width: 8px');
    expect(style).toContain('rgb(44, 44, 44)'); // #2C2C2C normalized by the DOM
    // The trailing filler cell has no width and no shading.
    const fillerStyle = (cells[3] as HTMLElement)?.getAttribute('style') || '';
    expect(fillerStyle).not.toContain('width');
    expect(fillerStyle).not.toContain('background');
  });

  it('emits one table per spacing token, each bar carrying its own width', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">xs</div>' +
      '<div class="design-token-value">4px</div>' +
      '<div class="design-spacing-bar" style="width: 4px;"></div>' +
      '</div>' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">sm</div>' +
      '<div class="design-token-value">8px</div>' +
      '<div class="design-spacing-bar" style="width: 8px;"></div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    // Two tokens → two separate sibling tables (individual bar widths).
    const tables = parsed.querySelectorAll('.design-block table');
    expect(tables.length).toBe(2);
    const widths = Array.from(tables).map((t) => {
      const bar = t.querySelectorAll('td')[2] as HTMLElement;
      return bar?.getAttribute('style') || '';
    });
    expect(widths[0]).toContain('width: 4px');
    expect(widths[1]).toContain('width: 8px');
  });

  it('caps the spacing bar cell width so long bars do not blow up the paste', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">xl</div>' +
      '<div class="design-token-value">9999px</div>' +
      '<div class="design-spacing-bar" style="width: 9999px;"></div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const barTd = parsed.querySelectorAll('.design-block table tr td')[2] as HTMLElement;
    expect(barTd?.getAttribute('style') || '').toContain('width: 300px');
  });

  it('gives an unparseable spacing value (auto) name + value cells and no shaded bar', () => {
    // An `auto` token renders no .design-spacing-bar in the viewer.
    host.innerHTML =
      '<div class="markdown-body"><div class="design-block">' +
      '<div class="design-scale">' +
      '<div class="design-scale-row">' +
      '<div class="design-token-name">auto</div>' +
      '<div class="design-token-value">auto</div>' +
      '</div></div></div></div>';

    const parsed = new DOMParser().parseFromString(buildCopyHtml(host), 'text/html');
    const row = parsed.querySelector('.design-block table tr');
    expect(row?.textContent).toContain('auto');
    // No cell in this row carries the neutral bar shade as a background.
    const shaded = Array.from(parsed.querySelectorAll('.design-block table td')).some((td) =>
      (td.getAttribute('style') || '').includes('background: rgb(44, 44, 44)'),
    );
    expect(shaded).toBe(false);
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

  it('swaps diagrams for PNG paragraphs and leaves the rest of plain markdown as is', () => {
    host.innerHTML =
      '<div class="markdown-body"><p>Before</p>' +
      '<div class="mermaid-block" data-mermaid-source="graph TD"><div class="mermaid-diagram"><svg></svg></div></div>' +
      '<p>After</p></div>';
    const image = { src: 'data:image/png;base64,AAAA', width: 100, height: 50, alt: 'Diagram' };

    expect(buildCopyHtml(host, new Map([['graph TD', image]]))).toBe(
      '<div class="markdown-body"><p>Before</p>' +
      '<p><img src="data:image/png;base64,AAAA" width="100" height="50" alt="Diagram"></p>' +
      '<p>After</p></div>'
    );
    // The live document is untouched.
    expect(host.querySelector('.mermaid-block svg')).not.toBeNull();
  });

  it('pastes diagram source when no image was rendered', () => {
    host.innerHTML =
      '<div class="markdown-body"><div class="mermaid-block" data-mermaid-source="graph TD"><svg></svg></div></div>';
    expect(buildCopyHtml(host)).toBe(
      '<div class="markdown-body"><pre><code class="language-mermaid">graph TD</code></pre></div>'
    );
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

// Canvas path is exercised via an injected fake 2D context (jsdom has no canvas).
// Two fakes model the two behaviors that matter: an assignment the browser
// IGNORES (invalid color → fillStyle keeps its prior value, per spec), and a
// valid assignment whose color we read back from a 1×1 pixel.
function ignoredAssignmentCtx() {
  // Only recognizes 6-digit hex (the sentinels). Anything else is dropped, so
  // fillStyle keeps whatever sentinel was set last — exactly Chromium's behavior
  // for a malformed value like `oklch(garbage`.
  let fill = '#000000';
  return {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      if (/^#[0-9a-f]{6}$/i.test(v)) fill = v.toLowerCase();
    },
    clearRect() {},
    fillRect() {},
    getImageData() {
      return { data: [0, 0, 0, 255] };
    },
  };
}

function validCtx(pixel: number[]) {
  // Accepts any assignment (valid color) and reports a fixed pixel readback.
  let fill = '#000000';
  return {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = v;
    },
    clearRect() {},
    fillRect() {},
    getImageData() {
      return { data: pixel };
    },
  };
}

const hexChan = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

describe('flattenColor — canvas sentinel + pixel readback', () => {
  it('returns null when a malformed function-prefix value is silently ignored (no black chip)', () => {
    // `oklch(garbage` passes a prefix check but the canvas assignment is ignored;
    // the sentinel readbacks diverge → no chip (previously rendered solid black).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(flattenColor('oklch(garbage', (() => ignoredAssignmentCtx()) as any)).toBeNull();
  });

  it('reads a valid modern color from the pixel and composites its alpha over #333', () => {
    // A valid assignment: the pixel [255,255,255,26] ≈ white @ 0.102 alpha.
    // Composited over #333333 that lands on ~#474747 (±1 per-channel rounding).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = flattenColor('oklch(62% 0.18 250)', (() => validCtx([255, 255, 255, 26])) as any);
    expect(out).not.toBeNull();
    for (const i of [0, 1, 2]) expect(Math.abs(hexChan(out as string, i) - 71)).toBeLessThanOrEqual(1);
  });

  it('reads an opaque valid color straight from the pixel', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = flattenColor('lab(50% 40 30)', (() => validCtx([18, 52, 86, 255])) as any);
    expect(out).toBe('#123456');
  });
});

// The regex fallback runs only in canvas-less environments (jsdom here). In
// production Chromium's canvas handles hsl/oklch/named uniformly; the fallback
// only needs to cover the sRGB rgb()/rgba() forms robustly.
describe('flattenColor — regex fallback (no canvas)', () => {
  it('parses percent channels (rgb 50% → 128)', () => {
    expect(flattenColor('rgb(50%, 50%, 50%)')).toBe('#808080');
  });

  it('parses space-separated channels', () => {
    expect(flattenColor('rgb(10 20 30)')).toBe('#0a141e');
  });

  it('parses space-separated channels with a slash alpha', () => {
    // 10*0.5 + 51*0.5 = 30.5 → 31 → 0x1f; 20*0.5+51*0.5=35.5→36→0x24; 30*0.5+51*0.5=40.5→41→0x29
    expect(flattenColor('rgb(10 20 30 / 0.5)')).toBe('#1f2429');
  });

  it('treats percent alpha as a fraction (white 50% over #333 → #999)', () => {
    // 255*0.5 + 51*0.5 = 153 → 0x99
    expect(flattenColor('rgba(255, 255, 255, 50%)')).toBe('#999999');
  });

  it('clamps a negative alpha to 0 (fully backdrop)', () => {
    expect(flattenColor('rgba(255, 255, 255, -1)')).toBe('#333333');
  });

  it('clamps an over-range alpha to 1 (fully opaque)', () => {
    expect(flattenColor('rgba(200, 100, 50, 2)')).toBe('#c86432');
  });

  it('still returns null for hsl/named forms (canvas handles those in production)', () => {
    expect(flattenColor('hsl(200 50% 50%)')).toBeNull();
    expect(flattenColor('rebeccapurple')).toBeNull();
  });
});
