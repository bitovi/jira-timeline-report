import { describe, expect, test } from 'vitest';
import { scoreRichTextSections } from './score-rich-text-sections.js';

describe('scoreRichTextSections', () => {
  test('rejects a section that still begins with the gray placeholder block', () => {
    const html = '<h2>Problem</h2><blockquote><p><span style="color: #97a0af">Add text</span></p></blockquote>';

    expect(scoreRichTextSections({ html, headings: ['Problem'] })).toEqual({
      completed: [],
      count: 0,
      missing: ['Problem'],
      total: 1,
    });
  });

  test('counts a completed heading when the section body is real content', () => {
    const html = '<h2>Problem</h2><p>Real details</p>';

    expect(scoreRichTextSections({ html, headings: ['Problem'] })).toEqual({
      completed: ['Problem'],
      count: 1,
      missing: [],
      total: 1,
    });
  });
});