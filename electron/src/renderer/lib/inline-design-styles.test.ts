import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inlineDesignStyles } from './inline-design-styles';

describe('inlineDesignStyles', () => {
  let host: HTMLElement;

  beforeEach(() => {
    // getComputedStyle only works on attached elements.
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('returns plain innerHTML unchanged when there is no design content', () => {
    host.innerHTML = '<div class="markdown-body"><p>Just prose.</p></div>';
    expect(inlineDesignStyles(host)).toBe(host.innerHTML);
  });

  it('preserves an inline swatch background-color in the output', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block">' +
      '<div class="design-swatch-item">' +
      '<div class="design-swatch" style="background-color: rgb(184, 66, 46);"></div>' +
      '<div class="design-token-name">tertiary</div>' +
      '</div></div></div>';

    const out = inlineDesignStyles(host);
    expect(out).toContain('rgb(184, 66, 46)');
  });

  it('adds a style attribute to design-classed elements', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block">' +
      '<div class="design-token-name">primary</div>' +
      '</div></div>';

    const parsed = new DOMParser().parseFromString(
      inlineDesignStyles(host),
      'text/html',
    );
    const block = parsed.querySelector('.design-block');
    const name = parsed.querySelector('.design-token-name');
    expect(block?.getAttribute('style')).toBeTruthy();
    expect(name?.getAttribute('style')).toBeTruthy();
  });

  it('does not touch non-design elements', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-block"><div class="design-token-name">x</div></div>' +
      '<p id="prose">hello</p>' +
      '</div>';

    const parsed = new DOMParser().parseFromString(
      inlineDesignStyles(host),
      'text/html',
    );
    expect(parsed.querySelector('#prose')?.getAttribute('style')).toBeFalsy();
  });

  it('triggers on a bare design-header without a design-block', () => {
    host.innerHTML =
      '<div class="markdown-body">' +
      '<div class="design-header"><div class="design-header-desc">notes</div></div>' +
      '</div>';

    const out = inlineDesignStyles(host);
    const parsed = new DOMParser().parseFromString(out, 'text/html');
    expect(parsed.querySelector('.design-header')?.getAttribute('style')).toBeTruthy();
  });
});
