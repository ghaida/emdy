import { describe, it, expect } from 'vitest';
import { hasCssBlock, isDesignFileName, parseCssTokens, parseCssDesignMd } from './css-tokens';

const fence = (lang: string, ...lines: string[]) => ['```' + lang, ...lines, '```', ''].join('\n');

const DOC = [
  '# Pravah',
  '',
  '## Tokens — Colors',
  '',
  fence(
    'css',
    ':root {',
    '  /* Colors */',
    '  --color-parchment: #f3f1ed;',
    '  --color-ink: oklch(0.25 0.015 310);',
    '  --color-link: var(--color-ink);',
    '  --spacing-8: 8px;',
    '  --radius-md: 4px;',
    '  --text-caption: 12px;',
    '  --leading-caption: 1.4;',
    '  --tracking-caption: 0.1px;',
    '  --font-weight-bold: 700;',
    '  --page-max-width: 1200px;',
    '}'
  ),
].join('\n');

describe('isDesignFileName', () => {
  it('accepts DESIGN.md and copies of it', () => {
    for (const path of ['/a/DESIGN.md', 'design.md', '/Users/x/Downloads/DESIGN-2.md', 'DESIGN (1).md', 'DESIGN-v2.md', 'Design.markdown']) {
      expect(isDesignFileName(path)).toBe(true);
    }
  });

  it('rejects other names', () => {
    for (const path of ['design-brief.md', 'README.md', 'designs.md', 'DESIGN.txt', '/DESIGN.md/notes.md']) {
      expect(isDesignFileName(path)).toBe(false);
    }
    expect(isDesignFileName(null)).toBe(false);
  });
});

describe('parseCssTokens', () => {
  it('reads colors by value and spacing, radii and type sizes by name', () => {
    expect(parseCssTokens(DOC)).toEqual({
      name: '',
      colors: {
        '--color-parchment': '#f3f1ed',
        '--color-ink': 'oklch(0.25 0.015 310)',
        '--color-link': 'oklch(0.25 0.015 310)',
      },
      spacing: { '--spacing-8': '8px' },
      rounded: { '--radius-md': '4px' },
      typography: { '--text-caption': { fontSize: '12px', lineHeight: '1.4', letterSpacing: '0.1px' } },
    });
  });

  it('pairs Tailwind-style line heights with their size', () => {
    const tokens = parseCssTokens(fence('css', '@theme {', '  --text-xs: 0.75rem;', '  --text-xs--line-height: calc(1 / 0.75);', '}'));
    expect(tokens?.typography).toEqual({ '--text-xs': { fontSize: '0.75rem', lineHeight: 'calc(1 / 0.75)' } });
  });

  it('keeps the first declaration of a property', () => {
    const doc = fence('css', ':root { --color-page: #ffffff; }') + '\n' + fence('css', '.dark { --color-page: #000000; }');
    expect(parseCssTokens(doc)?.colors).toEqual({ '--color-page': '#ffffff' });
  });

  it('ignores comments, other languages and declarations it cannot resolve', () => {
    const doc = [
      fence('css', ':root {', '  /* --color-old: #ff0000; */', '  --color-brand: var(--missing);', '  --color-mark: #b8422e !important;', '}'),
      fence('js', "const x = '--color-js: #00ff00;';"),
    ].join('\n');
    expect(parseCssTokens(doc)?.colors).toEqual({ '--color-mark': '#b8422e' });
  });

  it('finds nothing in a document without CSS tokens', () => {
    expect(parseCssTokens('# Notes\n\n' + fence('css', 'a { color: red; }'))).toBeNull();
    expect(parseCssTokens('# Notes\n\nNo code here.')).toBeNull();
  });
});

describe('hasCssBlock', () => {
  it('spots a css, scss, less or postcss code fence', () => {
    expect(hasCssBlock('Text\n\n```css\na {}\n```\n')).toBe(true);
    expect(hasCssBlock('~~~SCSS\n$a: 1;\n~~~\n')).toBe(true);
    expect(hasCssBlock('  ```less\n```\n')).toBe(true);
  });

  it('ignores other fences and mentions of css in text', () => {
    expect(hasCssBlock('```js\nconst css = 1;\n```\n')).toBe(false);
    expect(hasCssBlock('Write ```css blocks like this.\n')).toBe(false);
    expect(hasCssBlock('```cssx\n```\n')).toBe(false);
    expect(hasCssBlock('No code at all.')).toBe(false);
  });
});

describe('parseCssDesignMd', () => {
  it('only reads files named DESIGN.md', () => {
    expect(parseCssDesignMd(DOC, '/notes/style.md')).toBeNull();
    const parsed = parseCssDesignMd(DOC, '/notes/DESIGN.md');
    expect(parsed?.tokens.colors?.['--color-parchment']).toBe('#f3f1ed');
    expect(parsed?.source).toBe('css');
  });

  it('drops front matter from the body', () => {
    const parsed = parseCssDesignMd('---\nname: Seed\n---\n' + DOC, 'DESIGN.md');
    expect(parsed?.body.startsWith('# Pravah')).toBe(true);
  });
});
