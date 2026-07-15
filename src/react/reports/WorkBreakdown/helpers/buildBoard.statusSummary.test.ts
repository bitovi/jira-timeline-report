import { describe, it, expect } from 'vitest';
import { buildBoard } from './buildBoard';
import type { IssueOrRelease } from '../types';

const primary = (over: Partial<IssueOrRelease>): IssueOrRelease => ({
  key: 'C-1',
  summary: '100 Stores',
  reportingHierarchy: { childKeys: [] },
  rollupStatuses: { rollup: { status: 'ontrack' } },
  ...over,
});

describe('buildBoard statusSummary', () => {
  it('populates card.statusSummary from a plain-string statusSummary', () => {
    const card = buildBoard([primary({ statusSummary: 'Ahead of plan' })], [], 'status').cards[0];
    expect(card.statusSummary?.blocks).toEqual([{ type: 'paragraph', text: 'Ahead of plan' }]);
  });

  it('populates card.statusSummary from an ADF statusSummary, preserving list structure', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Blocked on vendor' }] },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Escalate' }] }] },
          ],
        },
      ],
    };
    const card = buildBoard([primary({ statusSummary: adf })], [], 'status').cards[0];
    expect(card.statusSummary?.blocks).toEqual([
      { type: 'paragraph', text: 'Blocked on vendor' },
      { type: 'orderedList', start: 1, items: [[{ type: 'paragraph', text: 'Escalate' }]] },
    ]);
  });

  it('leaves card.statusSummary undefined when there is no text', () => {
    expect(buildBoard([primary({})], [], 'status').cards[0].statusSummary).toBeUndefined();
    expect(buildBoard([primary({ statusSummary: '   ' })], [], 'status').cards[0].statusSummary).toBeUndefined();
  });
});
