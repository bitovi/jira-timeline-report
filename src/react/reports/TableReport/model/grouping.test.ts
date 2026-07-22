import { describe, test, expect } from 'vitest';

import {
  applicableAggregations,
  computeMeasureValue,
  effectiveAggregationId,
  formatMeasureValue,
  groupIssues,
  selectMeasureColumns,
  sortGroups,
  EMPTY_GROUP_LABEL,
} from './grouping';

import type { ColumnDefinition, TableIssue } from './columns';

/** A tiny column builder over a bag of arbitrary props on the issue. */
function col(id: string, overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id,
    label: id,
    group: 'Fields',
    source: { kind: 'field', fieldKey: id, schemaType: 'string' },
    getValue: (issue: TableIssue) => (issue as Record<string, unknown>)[id],
    render: (v) => String(v),
    compare: (a, b) => String(a).localeCompare(String(b)),
    filter: { kind: 'text' },
    ...overrides,
  };
}

const statusCol = col('status', { filter: { kind: 'select' }, defaultAggregate: 'distinct' });
const pointsCol = col('points', { filter: { kind: 'number' }, defaultAggregate: 'sum' });
const dueCol = col('due', { filter: { kind: 'date' }, defaultAggregate: 'range' });
const keyCol = col('key', { isIdentity: true });
const summaryCol = col('summary', { isIdentity: true, isTree: true });

const issues: TableIssue[] = [
  { key: 'A-1', summary: 's1', status: 'Done', points: 3, due: '2024-01-05' },
  { key: 'A-2', summary: 's2', status: 'To Do', points: 5, due: '2024-01-10' },
  { key: 'A-3', summary: 's3', status: 'Done', points: 2, due: '2024-01-20' },
  { key: 'A-4', summary: 's4', status: 'To Do', points: 8, due: '2024-01-02' },
  { key: 'A-5', summary: 's5', status: 'Done', points: 1, due: '2024-01-15' },
];

describe('groupIssues', () => {
  test('buckets issues by the group column value', () => {
    const groups = groupIssues(issues, statusCol);
    expect(groups.map((g) => g.label)).toEqual(['Done', 'To Do']);
    const done = groups.find((g) => g.label === 'Done')!;
    expect(done.members.map((m) => m.key)).toEqual(['A-1', 'A-3', 'A-5']);
    const todo = groups.find((g) => g.label === 'To Do')!;
    expect(todo.members).toHaveLength(2);
  });

  test('groups are ordered by label ascending with empty last', () => {
    const withEmpty: TableIssue[] = [...issues, { key: 'A-6', summary: 's6', status: null, points: 0 }];
    const groups = groupIssues(withEmpty, statusCol);
    expect(groups.map((g) => g.label)).toEqual(['Done', 'To Do', EMPTY_GROUP_LABEL]);
  });

  test('keys are stable across runs', () => {
    const a = groupIssues(issues, statusCol).map((g) => g.key);
    const b = groupIssues(issues, statusCol).map((g) => g.key);
    expect(a).toEqual(b);
  });
});

describe('selectMeasureColumns', () => {
  test('excludes identity columns and the grouped column', () => {
    const shown = [keyCol, summaryCol, statusCol, pointsCol, dueCol];
    const measures = selectMeasureColumns(shown, statusCol);
    expect(measures.map((c) => c.id)).toEqual(['points', 'due']);
  });

  test('with no group column, only identity columns drop out', () => {
    const shown = [keyCol, summaryCol, pointsCol];
    expect(selectMeasureColumns(shown, null).map((c) => c.id)).toEqual(['points']);
  });
});

describe('effectiveAggregationId', () => {
  test('override wins over column.aggregate wins over defaultAggregate', () => {
    expect(effectiveAggregationId(pointsCol)).toBe('sum');
    expect(effectiveAggregationId({ ...pointsCol, aggregate: 'avg' })).toBe('avg');
    expect(effectiveAggregationId(pointsCol, 'max')).toBe('max');
  });
});

describe('computeMeasureValue', () => {
  const done = groupIssues(issues, statusCol).find((g) => g.label === 'Done')!;

  test('sums a number column over the group members', () => {
    expect(computeMeasureValue(pointsCol, done.members)).toBe(6); // 3 + 2 + 1
  });

  test('honors a per-column aggregation override (avg / max / count)', () => {
    expect(computeMeasureValue(pointsCol, done.members, 'avg')).toBe(2); // 6 / 3
    expect(computeMeasureValue(pointsCol, done.members, 'max')).toBe(3);
    expect(computeMeasureValue(pointsCol, done.members, 'count')).toBe(3);
  });

  test('range aggregation over a date column produces a min–max label', () => {
    const value = computeMeasureValue(dueCol, done.members) as string;
    expect(value).toBe('2024-01-05 – 2024-01-20');
  });

  test('distinct aggregation lists unique values', () => {
    const all = groupIssues(issues, pointsCol); // group by points so status varies within groups
    // Just verify distinct over the whole set via one synthetic group
    const distinct = computeMeasureValue(statusCol, issues) as string[];
    expect(distinct.sort()).toEqual(['Done', 'To Do']);
    expect(all.length).toBeGreaterThan(0);
  });

  test('same field with two different aggregations reproduces multi-aggregator behavior', () => {
    const sum = computeMeasureValue(pointsCol, done.members, 'sum');
    const avg = computeMeasureValue(pointsCol, done.members, 'avg');
    expect(sum).toBe(6);
    expect(avg).toBe(2);
  });
});

describe('applicableAggregations', () => {
  test('number column offers numeric aggregations + count', () => {
    expect(applicableAggregations(pointsCol)).toEqual(['sum', 'avg', 'min', 'max', 'count']);
  });
  test('date column offers count + range', () => {
    expect(applicableAggregations(dueCol)).toEqual(['count', 'range']);
  });
  test('select column offers count + distinct', () => {
    expect(applicableAggregations(statusCol)).toEqual(['count', 'distinct']);
  });
});

describe('formatMeasureValue', () => {
  test('formats numbers, arrays, strings, and nullish', () => {
    expect(formatMeasureValue(6)).toBe('6');
    expect(formatMeasureValue(2.5)).toBe('2.5');
    expect(formatMeasureValue(['a', 'b'])).toBe('a, b');
    expect(formatMeasureValue('x')).toBe('x');
    expect(formatMeasureValue(null)).toBe('');
  });
});

describe('sortGroups', () => {
  const groups = groupIssues(issues, statusCol);
  const cols = [statusCol, pointsCol, dueCol];

  test('by label descending', () => {
    const sorted = sortGroups(groups, { by: 'label', dir: 'desc' }, cols);
    expect(sorted.map((g) => g.label)).toEqual(['To Do', 'Done']);
  });

  test('by member count', () => {
    const sorted = sortGroups(groups, { by: 'count', dir: 'desc' }, cols);
    expect(sorted[0].label).toBe('Done'); // 3 members vs 2
  });

  test('by a measure column value (sum of points)', () => {
    // Done sum = 6, To Do sum = 13 → asc puts Done first, desc puts To Do first.
    const asc = sortGroups(groups, { by: { columnId: 'points' }, dir: 'asc' }, cols);
    expect(asc.map((g) => g.label)).toEqual(['Done', 'To Do']);
    const desc = sortGroups(groups, { by: { columnId: 'points' }, dir: 'desc' }, cols);
    expect(desc.map((g) => g.label)).toEqual(['To Do', 'Done']);
  });

  test('null sort is a no-op', () => {
    expect(sortGroups(groups, null, cols)).toBe(groups);
  });
});
