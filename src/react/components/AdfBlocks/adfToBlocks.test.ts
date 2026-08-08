import { describe, it, expect } from 'vitest';
import { adfToBlocks, inlineToText } from './adfToBlocks';

/** A plain run, which is what most of these expect. */
const run = (text: string) => ({ type: 'text', text });

describe('adfToBlocks', () => {
  it('turns a plain string into a single paragraph block (trimmed)', () => {
    expect(adfToBlocks('  hello  ')).toEqual([{ type: 'paragraph', content: [run('hello')] }]);
  });

  it('keeps each text run of a paragraph, in order', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'On track.' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'QA ' },
            { type: 'text', text: 'starts Monday.' },
          ],
        },
      ],
    };
    expect(adfToBlocks(adf)).toEqual([
      { type: 'paragraph', content: [run('On track.')] },
      { type: 'paragraph', content: [run('QA '), run('starts Monday.')] },
    ]);
  });

  it('returns an empty array for null/undefined/other', () => {
    expect(adfToBlocks(null)).toEqual([]);
    expect(adfToBlocks(undefined)).toEqual([]);
    expect(adfToBlocks(42)).toEqual([]);
  });

  it('turns an orderedList into a single orderedList block with one item per listItem', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
      ],
    };
    expect(adfToBlocks(adf)).toEqual([
      {
        type: 'orderedList',
        start: 1,
        items: [[{ type: 'paragraph', content: [run('First')] }], [{ type: 'paragraph', content: [run('Second')] }]],
      },
    ]);
  });

  it("honors an orderedList's custom starting number (attrs.order)", () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          attrs: { order: 3 },
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Third' }] }] }],
        },
      ],
    };
    expect(adfToBlocks(adf)).toEqual([
      { type: 'orderedList', start: 3, items: [[{ type: 'paragraph', content: [run('Third')] }]] },
    ]);
  });

  it('turns a bulletList into a bulletList block', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] }],
        },
      ],
    };
    expect(adfToBlocks(adf)).toEqual([{ type: 'bulletList', items: [[{ type: 'paragraph', content: [run('One')] }]] }]);
  });

  it('keeps a list nested inside a listItem as a nested block within that item', () => {
    const adf = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Parent' }] },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(adfToBlocks(adf)).toEqual([
      {
        type: 'orderedList',
        start: 1,
        items: [
          [
            { type: 'paragraph', content: [run('Parent')] },
            { type: 'bulletList', items: [[{ type: 'paragraph', content: [run('Child')] }]] },
          ],
        ],
      },
    ]);
  });

  it('captures a heading with its level', () => {
    const adf = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Status' }] };
    expect(adfToBlocks(adf)).toEqual([{ type: 'heading', level: 2, content: [run('Status')] }]);
  });

  it('drops an empty paragraph produced by whitespace-only content', () => {
    const adf = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    expect(adfToBlocks(adf)).toEqual([]);
  });

  it('keeps a code block as plain text — marks do not apply inside one', () => {
    const adf = { type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'npm run build' }] }] };
    expect(adfToBlocks(adf)).toEqual([{ type: 'codeBlock', text: 'npm run build' }]);
  });

  // The marks are the whole reason block content is a list of runs rather than one string.
  describe('marks', () => {
    const paragraph = (...content: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
    const contentOf = (adf: unknown) => {
      const [block] = adfToBlocks(adf);

      return block?.type === 'paragraph' ? block.content : undefined;
    };

    it('carries bold, italic, underline, strike, and code', () => {
      expect(
        contentOf(
          paragraph(
            { type: 'text', text: 'bold', marks: [{ type: 'strong' }] },
            { type: 'text', text: 'italic', marks: [{ type: 'em' }] },
            { type: 'text', text: 'under', marks: [{ type: 'underline' }] },
            { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
            { type: 'text', text: 'mono', marks: [{ type: 'code' }] },
          ),
        ),
      ).toEqual([
        { type: 'text', text: 'bold', strong: true },
        { type: 'text', text: 'italic', em: true },
        { type: 'text', text: 'under', underline: true },
        { type: 'text', text: 'struck', strike: true },
        { type: 'text', text: 'mono', code: true },
      ]);
    });

    it('combines several marks on one run', () => {
      expect(
        contentOf(paragraph({ type: 'text', text: 'both', marks: [{ type: 'strong' }, { type: 'underline' }] })),
      ).toEqual([{ type: 'text', text: 'both', strong: true, underline: true }]);
    });

    it('keeps a link href', () => {
      expect(
        contentOf(
          paragraph({
            type: 'text',
            text: 'JIRA-412',
            marks: [{ type: 'link', attrs: { href: 'https://example.atlassian.net/browse/JIRA-412' } }],
          }),
        ),
      ).toEqual([{ type: 'text', text: 'JIRA-412', href: 'https://example.atlassian.net/browse/JIRA-412' }]);
    });

    // The href lands in an `<a href>`, so a scheme that can execute is dropped and the text stays.
    it('drops a link whose scheme could execute', () => {
      for (const href of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', '  JavaScript:alert(1)']) {
        expect(
          contentOf(paragraph({ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href } }] })),
        ).toEqual([{ type: 'text', text: 'click' }]);
      }
    });

    it('keeps mailto and relative hrefs', () => {
      expect(
        contentOf(
          paragraph({ type: 'text', text: 'mail', marks: [{ type: 'link', attrs: { href: 'mailto:a@b.co' } }] }),
        ),
      ).toEqual([{ type: 'text', text: 'mail', href: 'mailto:a@b.co' }]);
      expect(
        contentOf(paragraph({ type: 'text', text: 'rel', marks: [{ type: 'link', attrs: { href: '/browse/X-1' } }] })),
      ).toEqual([{ type: 'text', text: 'rel', href: '/browse/X-1' }]);
    });

    it('ignores marks it has no rendering for, keeping the text', () => {
      expect(
        contentOf(
          paragraph({
            type: 'text',
            text: 'coloured',
            marks: [{ type: 'textColor', attrs: { color: '#ff0000' } }, { type: 'strong' }],
          }),
        ),
      ).toEqual([{ type: 'text', text: 'coloured', strong: true }]);
    });
  });

  describe('hard breaks', () => {
    it('keeps a hard break inside a paragraph, which flattening dropped', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'line one' }, { type: 'hardBreak' }, { type: 'text', text: 'line two' }],
          },
        ],
      };
      expect(adfToBlocks(adf)).toEqual([
        { type: 'paragraph', content: [run('line one'), { type: 'break' }, run('line two')] },
      ]);
    });

    it('drops a leading and trailing break rather than rendering empty lines', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'hardBreak' }, { type: 'text', text: 'only line' }, { type: 'hardBreak' }],
          },
        ],
      };
      expect(adfToBlocks(adf)).toEqual([{ type: 'paragraph', content: [run('only line')] }]);
    });

    it('separates the paragraphs of a blockquote with a break', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
            ],
          },
        ],
      };
      expect(adfToBlocks(adf)).toEqual([
        { type: 'blockquote', content: [run('first'), { type: 'break' }, run('second')] },
      ]);
    });
  });
});

describe('inlineToText', () => {
  it('flattens runs back to plain text, breaks included', () => {
    expect(inlineToText([run('a'), { type: 'break' }, { type: 'text', text: 'b', strong: true }])).toBe('a\nb');
  });
});
