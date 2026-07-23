import { describe, expect, test } from 'vitest';

import {
  addColumn,
  applyFilters,
  applySort,
  applyView,
  compareRank,
  cycleSort,
  cycleTreeSort,
  isFilterActive,
  makeFilterPredicate,
  removeColumn,
  reorderColumn,
} from './applyView';

import type { ColumnDefinition, TableIssue } from './columns';
import type { FilterState } from './applyView';

/** A tiny text column reading `issue.name`. */
const nameCol: ColumnDefinition = {
  id: 'name',
  label: 'Name',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'name', schemaType: 'string' },
  getValue: (issue) => (issue as any).name,
  render: (v) => String(v ?? ''),
  compare: (a, b) => String(a ?? '').localeCompare(String(b ?? '')),
  filter: { kind: 'text' },
};

/** A number column reading `issue.points`. */
const pointsCol: ColumnDefinition = {
  id: 'points',
  label: 'Points',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'points', schemaType: 'number' },
  getValue: (issue) => (issue as any).points,
  render: (v) => String(v ?? ''),
  compare: (a, b) => Number(a ?? 0) - Number(b ?? 0),
  filter: { kind: 'number' },
};

/** A date column reading `issue.due`. */
const dueCol: ColumnDefinition = {
  id: 'due',
  label: 'Due',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'due', schemaType: 'date' },
  getValue: (issue) => (issue as any).due,
  render: (v) => String(v ?? ''),
  compare: (a, b) => (Date.parse(String(a)) || 0) - (Date.parse(String(b)) || 0),
  filter: { kind: 'date' },
};

/** A select column reading `issue.status`. */
const statusCol: ColumnDefinition = {
  id: 'status',
  label: 'Status',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'status', schemaType: 'string' },
  getValue: (issue) => (issue as any).status,
  render: (v) => String(v ?? ''),
  compare: (a, b) => String(a ?? '').localeCompare(String(b ?? '')),
  filter: { kind: 'select' },
};

/** A boolean column reading `issue.done`. */
const doneCol: ColumnDefinition = {
  id: 'done',
  label: 'Done',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'done', schemaType: 'boolean' },
  getValue: (issue) => (issue as any).done,
  render: (v) => String(v ?? ''),
  compare: (a, b) => Number(a) - Number(b),
  filter: { kind: 'boolean' },
};

const columns = [nameCol, pointsCol, dueCol, statusCol, doneCol];

const issues: TableIssue[] = [
  { name: 'Alpha', points: 3, due: '2025-01-10', status: 'Done', done: true } as any,
  { name: 'Beta', points: 8, due: '2025-03-01', status: 'In Progress', done: false } as any,
  { name: 'Gamma', points: 1, due: '2025-02-15', status: 'Done', done: true } as any,
  { name: 'Delta', points: undefined, due: undefined, status: undefined, done: false } as any,
];

describe('isFilterActive', () => {
  test('empty controls are inactive', () => {
    expect(isFilterActive(undefined)).toBe(false);
    expect(isFilterActive({ kind: 'text', contains: '   ' })).toBe(false);
    expect(isFilterActive({ kind: 'number', min: undefined, max: undefined })).toBe(false);
    expect(isFilterActive({ kind: 'date' })).toBe(false);
    expect(isFilterActive({ kind: 'select', selected: [] })).toBe(false);
  });

  test('constrained controls are active', () => {
    expect(isFilterActive({ kind: 'text', contains: 'a' })).toBe(true);
    expect(isFilterActive({ kind: 'number', min: 1 })).toBe(true);
    expect(isFilterActive({ kind: 'date', to: '2025-01-01' })).toBe(true);
    expect(isFilterActive({ kind: 'select', selected: ['x'] })).toBe(true);
    expect(isFilterActive({ kind: 'boolean', value: false })).toBe(true);
  });
});

describe('makeFilterPredicate', () => {
  test('text: case-insensitive contains', () => {
    const p = makeFilterPredicate(nameCol, { kind: 'text', contains: 'ET' })!;
    expect(issues.filter(p).map((i) => (i as any).name)).toEqual(['Beta']);
  });

  test('number: min/max range, excludes nullish', () => {
    const p = makeFilterPredicate(pointsCol, { kind: 'number', min: 2, max: 5 })!;
    expect(issues.filter(p).map((i) => (i as any).name)).toEqual(['Alpha']);
  });

  test('date: from/to range, excludes nullish', () => {
    const p = makeFilterPredicate(dueCol, { kind: 'date', from: '2025-02-01', to: '2025-02-28' })!;
    expect(issues.filter(p).map((i) => (i as any).name)).toEqual(['Gamma']);
  });

  test('select: membership', () => {
    const p = makeFilterPredicate(statusCol, { kind: 'select', selected: ['Done'] })!;
    expect(issues.filter(p).map((i) => (i as any).name)).toEqual(['Alpha', 'Gamma']);
  });

  test('boolean: is / is-not', () => {
    const truthy = makeFilterPredicate(doneCol, { kind: 'boolean', value: true })!;
    expect(issues.filter(truthy).map((i) => (i as any).name)).toEqual(['Alpha', 'Gamma']);
    const falsy = makeFilterPredicate(doneCol, { kind: 'boolean', value: false })!;
    expect(issues.filter(falsy).map((i) => (i as any).name)).toEqual(['Beta', 'Delta']);
  });

  test('inactive filter yields no predicate', () => {
    expect(makeFilterPredicate(nameCol, { kind: 'text', contains: '' })).toBeNull();
  });
});

describe('applyFilters', () => {
  test('ANDs multiple column filters', () => {
    const filters: FilterState = {
      status: { kind: 'select', selected: ['Done'] },
      points: { kind: 'number', min: 2 },
    };
    expect(applyFilters(issues, columns, filters).map((i) => (i as any).name)).toEqual(['Alpha']);
  });

  test('ignores filters for columns not shown', () => {
    const filters: FilterState = { missing: { kind: 'text', contains: 'x' } };
    expect(applyFilters(issues, columns, filters)).toHaveLength(issues.length);
  });

  test('returns the same set when no active filters', () => {
    expect(applyFilters(issues, columns, {})).toBe(issues);
  });
});

describe('applySort', () => {
  test('asc uses compare, does not mutate input', () => {
    const sorted = applySort(issues, pointsCol, 'asc');
    expect(sorted.map((i) => (i as any).points)).toEqual([undefined, 1, 3, 8]);
    // input untouched
    expect(issues.map((i) => (i as any).name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  });

  test('desc reverses compare', () => {
    const sorted = applySort(issues, pointsCol, 'desc');
    expect(sorted.map((i) => (i as any).points)).toEqual([8, 3, 1, undefined]);
  });

  test('null column is a no-op', () => {
    expect(applySort(issues, null, 'asc')).toBe(issues);
  });

  test("rank sorts by the issue's own rank field, ignoring the column's compare", () => {
    const ranked: TableIssue[] = [
      { ...(issues[0] as any), rank: '0|c' },
      { ...(issues[1] as any), rank: '0|a' },
      { ...(issues[2] as any), rank: '0|b' },
    ];
    // Sorting by `nameCol` in 'rank' mode should ignore alphabetical name order entirely.
    const sorted = applySort(ranked, nameCol, 'rank');
    expect(sorted.map((i) => (i as any).rank)).toEqual(['0|a', '0|b', '0|c']);
  });
});

describe('compareRank', () => {
  test('orders by plain string comparison (not localeCompare)', () => {
    const a = { rank: '0|b' } as TableIssue;
    const b = { rank: '0|a' } as TableIssue;
    expect(compareRank(a, b)).toBeGreaterThan(0);
    expect(compareRank(b, a)).toBeLessThan(0);
    expect(compareRank(a, a)).toBe(0);
  });

  test('nulls sort last', () => {
    const withRank = { rank: '0|a' } as TableIssue;
    const noRank = { rank: null } as TableIssue;
    const missingRank = {} as TableIssue;
    expect(compareRank(withRank, noRank)).toBeLessThan(0);
    expect(compareRank(noRank, withRank)).toBeGreaterThan(0);
    expect(compareRank(noRank, missingRank)).toBe(0);
  });
});

describe('applyView', () => {
  test('filters then sorts', () => {
    const filters: FilterState = { status: { kind: 'select', selected: ['Done'] } };
    const rows = applyView(issues, columns, filters, { columnId: 'points', dir: 'desc' });
    expect(rows.map((i) => (i as any).name)).toEqual(['Alpha', 'Gamma']);
  });

  test('no sort → filtered only', () => {
    const rows = applyView(issues, columns, {}, null);
    expect(rows).toBe(issues);
  });
});

describe('column reducers', () => {
  test('addColumn appends, dedupes', () => {
    expect(addColumn(['a'], 'b')).toEqual(['a', 'b']);
    expect(addColumn(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  test('removeColumn filters out', () => {
    expect(removeColumn(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('reorderColumn', () => {
  test('moves a column left (before an earlier target)', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  test('moves a column right (before a later target)', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
  });

  test('moves a column to the end when target is null', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
  });

  test('no-op when source equals target', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });

  test('no-op when source id is unknown', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'z', 'a')).toEqual(['a', 'b', 'c']);
  });

  test('appends when target id is unknown', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'z')).toEqual(['b', 'c', 'a']);
  });

  test('preserves other ids in place', () => {
    expect(reorderColumn(['a', 'b', 'c', 'd'], 'b', 'd')).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('cycleSort', () => {
  test('none → asc → desc → none on same column', () => {
    const asc = cycleSort(null, 'x');
    expect(asc).toEqual({ columnId: 'x', dir: 'asc' });
    const desc = cycleSort(asc, 'x');
    expect(desc).toEqual({ columnId: 'x', dir: 'desc' });
    expect(cycleSort(desc, 'x')).toBeNull();
  });

  test('switching columns starts fresh at asc', () => {
    expect(cycleSort({ columnId: 'x', dir: 'desc' }, 'y')).toEqual({ columnId: 'y', dir: 'asc' });
  });
});

describe('cycleTreeSort', () => {
  test('tree → asc → desc → rank → tree on the same column', () => {
    const tree = cycleTreeSort(null, 'x');
    expect(tree).toEqual({ columnId: 'x', dir: 'tree' });
    const asc = cycleTreeSort(tree, 'x');
    expect(asc).toEqual({ columnId: 'x', dir: 'asc' });
    const desc = cycleTreeSort(asc, 'x');
    expect(desc).toEqual({ columnId: 'x', dir: 'desc' });
    const rank = cycleTreeSort(desc, 'x');
    expect(rank).toEqual({ columnId: 'x', dir: 'rank' });
    expect(cycleTreeSort(rank, 'x')).toEqual({ columnId: 'x', dir: 'tree' });
  });

  test('switching columns starts fresh at tree (hierarchy)', () => {
    expect(cycleTreeSort({ columnId: 'x', dir: 'rank' }, 'y')).toEqual({ columnId: 'y', dir: 'tree' });
  });
});
