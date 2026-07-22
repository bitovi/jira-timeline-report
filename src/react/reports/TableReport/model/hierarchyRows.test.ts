import { describe, expect, it } from 'vitest';

import { buildHierarchyRows, makeGetChildren } from './hierarchyRows';

import type { TableIssue } from './columns';

const makeIssue = (key: string, childKeys: string[] = [], extra: Partial<TableIssue> = {}): TableIssue => ({
  key,
  summary: key,
  reportingHierarchy: { childKeys },
  ...extra,
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

describe('buildHierarchyRows', () => {
  it('flattens the hierarchy depth-first with depth tags and hasChildren', () => {
    const parent = makeIssue('P-1', ['C-1']);
    const child = makeIssue('C-1', ['G-1']);
    const grandchild = makeIssue('G-1');
    const all = [parent, child, grandchild];

    const rows = buildHierarchyRows({ roots: [parent], allIssues: all });

    expect(rows.map((r) => [r.issue.key, r.depth, r.hasChildren])).toEqual([
      ['P-1', 0, true],
      ['C-1', 1, true],
      ['G-1', 2, false],
    ]);
  });

  it('emits each root subtree in order', () => {
    const a = makeIssue('A', ['A1']);
    const a1 = makeIssue('A1');
    const b = makeIssue('B');
    const rows = buildHierarchyRows({ roots: [a, b], allIssues: [a, a1, b] });
    expect(rows.map((r) => r.issue.key)).toEqual(['A', 'A1', 'B']);
  });

  it('omits descendants of a collapsed row but keeps the row (still hasChildren)', () => {
    const parent = makeIssue('P-1', ['C-1']);
    const child = makeIssue('C-1', ['G-1']);
    const grandchild = makeIssue('G-1');
    const all = [parent, child, grandchild];

    const rows = buildHierarchyRows({ roots: [parent], allIssues: all, collapsedKeys: new Set(['P-1']) });

    expect(rows.map((r) => r.issue.key)).toEqual(['P-1']);
    expect(rows[0].hasChildren).toBe(true);
  });

  it('collapsing a mid-level node hides only its subtree', () => {
    const parent = makeIssue('P-1', ['C-1', 'C-2']);
    const c1 = makeIssue('C-1', ['G-1']);
    const g1 = makeIssue('G-1');
    const c2 = makeIssue('C-2');
    const all = [parent, c1, g1, c2];

    const rows = buildHierarchyRows({ roots: [parent], allIssues: all, collapsedKeys: new Set(['C-1']) });

    expect(rows.map((r) => r.issue.key)).toEqual(['P-1', 'C-1', 'C-2']);
  });

  it('orders siblings by compareSiblings while preserving parent-before-child', () => {
    const parent = makeIssue('P-1', ['C-2', 'C-1'], { rank: 0 });
    const c1 = makeIssue('C-1', [], { rank: 1 });
    const c2 = makeIssue('C-2', [], { rank: 2 });
    const all = [parent, c1, c2];

    const compareSiblings = (a: TableIssue, b: TableIssue) =>
      String(a.summary).localeCompare(String(b.summary));

    const rows = buildHierarchyRows({ roots: [parent], allIssues: all, compareSiblings });

    // C-1 sorts before C-2 despite childKeys order [C-2, C-1]
    expect(rows.map((r) => r.issue.key)).toEqual(['P-1', 'C-1', 'C-2']);
  });

  it('orders roots by compareSiblings too', () => {
    const b = makeIssue('B');
    const a = makeIssue('A');
    const rows = buildHierarchyRows({
      roots: [b, a],
      allIssues: [a, b],
      compareSiblings: (x, y) => String(x.key).localeCompare(String(y.key)),
    });
    expect(rows.map((r) => r.issue.key)).toEqual(['A', 'B']);
  });
});
