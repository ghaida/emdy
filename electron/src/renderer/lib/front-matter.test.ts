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
    const doc = '---\n[unclosed\n---\n\nText\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('treats an empty block as front matter', () => {
    expect(stripFrontMatter('---\n---\n\n# Title\n')).toBe('\n# Title\n');
  });

  it('hides a key-shaped block even when the YAML is invalid', () => {
    expect(stripFrontMatter('---\ntitle: Release: v2\ntags: [a, b\n---\n\nBody\n')).toBe('\nBody\n');
  });

  it('ends an empty block at the first closing fence', () => {
    expect(stripFrontMatter('---\n---\n\nIntro.\n\n---\n\nMore.\n')).toBe('\nIntro.\n\n---\n\nMore.\n');
  });

  it('leaves a heading between two rules alone', () => {
    const doc = '---\n# Title\n---\n\nBody\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('leaves a list between two rules alone', () => {
    const doc = '---\n- a\n- b\n---\n\nBody\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('leaves a list alone when an item starts with inline code the YAML rejects', () => {
    const doc = '---\n- `npm install` first\n- `npm start`\n---\n\nBody\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('leaves a list alone when an item has a second colon the YAML rejects', () => {
    const doc = '---\n- Note: see: this\n- b\n---\n\nBody\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('hides broken front matter whose first line after a comment is a key with a list under it', () => {
    expect(stripFrontMatter('---\n# Generated\ntags:\n- `a`\n- b\n---\n\nBody\n')).toBe('\nBody\n');
  });

  it('leaves a section alone when a key-like first line is followed by prose', () => {
    const doc = '---\nStatus: draft\n\nThis README explains the project.\n\n---\n\n## Install\n';
    expect(stripFrontMatter(doc)).toBe(doc);
  });

  it('treats a block of spaces and tabs as empty', () => {
    expect(stripFrontMatter('---\n  \n\t\n---\n\nBody\n')).toBe('\nBody\n');
  });

  it('counts an indented line under a key as part of broken front matter', () => {
    const doc = '---\ntitle: Release: v2\ndescription: |\n  Notes for the release.\n---\n\nBody\n';
    expect(stripFrontMatter(doc)).toBe('\nBody\n');
  });
});
