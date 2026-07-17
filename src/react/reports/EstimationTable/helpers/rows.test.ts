import { describe, expect, it } from 'vitest';
import { makeGetChildren, buildTableRows } from './rows';
import type { EstimationIssue } from '../types';

const makeIssue = (key: string, childKeys: string[] = []): EstimationIssue => ({
  key,
  summary: key,
  reportingHierarchy: { childKeys },
});

describe('makeGetChildren', () => {
  it('resolves child keys to issues from the full list', () => {
    const parent = makeIssue('P-1', ['C-1', 'C-2']);
    const c1 = makeIssue('C-1');
    const c2 = makeIssue('C-2');
    const getChildren = makeGetChildren([parent, c1, c2]);
    expect(getChildren(parent)).toEqual([c1, c2]);
  });

  it('drops child keys that are not present', () => {
    const parent = makeIssue('P-1', ['C-1', 'missing']);
    const c1 = makeIssue('C-1');
    const getChildren = makeGetChildren([parent, c1]);
    expect(getChildren(parent)).toEqual([c1]);
  });
});

describe('buildTableRows', () => {
  it('flattens the hierarchy depth-first with depth tags', () => {
    const parent = makeIssue('P-1', ['C-1']);
    const child = makeIssue('C-1', ['G-1']);
    const grandchild = makeIssue('G-1');
    const all = [parent, child, grandchild];

    const rows = buildTableRows([parent], all);

    expect(rows.map((r) => [r.issue.key, r.depth])).toEqual([
      ['P-1', 0],
      ['C-1', 1],
      ['G-1', 2],
    ]);
  });

  it('emits each primary issue subtree in order', () => {
    const a = makeIssue('A', ['A1']);
    const a1 = makeIssue('A1');
    const b = makeIssue('B');
    const rows = buildTableRows([a, b], [a, a1, b]);
    expect(rows.map((r) => r.issue.key)).toEqual(['A', 'A1', 'B']);
  });
});
