import { describe, it, expect } from 'vitest';
import { adfToBlocks } from './adfToBlocks';

describe('adfToBlocks', () => {
  it('turns a plain string into a single paragraph block (trimmed)', () => {
    expect(adfToBlocks('  hello  ')).toEqual([{ type: 'paragraph', text: 'hello' }]);
  });

  it('flattens an ADF doc into paragraph blocks', () => {
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
      { type: 'paragraph', text: 'On track.' },
      { type: 'paragraph', text: 'QA starts Monday.' },
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
        items: [[{ type: 'paragraph', text: 'First' }], [{ type: 'paragraph', text: 'Second' }]],
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
      { type: 'orderedList', start: 3, items: [[{ type: 'paragraph', text: 'Third' }]] },
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
    expect(adfToBlocks(adf)).toEqual([{ type: 'bulletList', items: [[{ type: 'paragraph', text: 'One' }]] }]);
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
            { type: 'paragraph', text: 'Parent' },
            { type: 'bulletList', items: [[{ type: 'paragraph', text: 'Child' }]] },
          ],
        ],
      },
    ]);
  });

  it('captures a heading with its level', () => {
    const adf = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Status' }] };
    expect(adfToBlocks(adf)).toEqual([{ type: 'heading', level: 2, text: 'Status' }]);
  });

  it('drops an empty paragraph produced by whitespace-only content', () => {
    const adf = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
    expect(adfToBlocks(adf)).toEqual([]);
  });
});
