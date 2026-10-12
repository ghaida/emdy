import { describe, it, expect } from 'vitest';
import { splitFrontMatter, stripFrontMatter } from './front-matter';

const NOTE = '---\ntitle: My note\ntags: [a, b]\n---\n\n# Heading\n\nBody.\n';

describe('front matter', () => {
  it('splits YAML front matter at the top from the body', () => {
    const split = splitFrontMatter(NOTE);
    expect(split?.data).toEqual({ title: 'My note', tags: ['a', 'b'] });
    expect(split?.body).toBe('\n# Heading\n\nBody.\n');
  });

  it('finds front matter below HTML comments', () => {
    const doc = '<!-- SEED: generated -->\n\n---\nname: Mutual aid\n---\n\n# Design\n';
    expect(splitFrontMatter(doc)?.data).toEqual({ name: 'Mutual aid' });
    expect(stripFrontMatter(doc)).toBe('\n# Design\n');
  });

  it('ignores a leading byte order mark', () => {
    expect(stripFrontMatter('﻿' + NOTE)).toBe('\n# Heading\n\nBody.\n');
  });

  it('leaves a document that opens with a horizontal rule and prose alone', () => {
    const doc = '---\nJust an opening line.\n---\n\nMore text.\n';
    expect(splitFrontMatter(doc)).toBeNull();
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('leaves horizontal rules further down alone', () => {
    const doc = '# Title\n\n---\nkey: value\n---\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('leaves invalid YAML alone', () => {
    const doc = '---\nkey: [unclosed\n---\n\nText\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });
});
