import { describe, test, expect } from 'vitest';

import { buildCrossTab, cellMembers, cellValue, getAxisValues, TOTAL_KEY } from './crosstab';
import { EMPTY_GROUP_LABEL } from './grouping';

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

const projectCol = col('project', { filter: { kind: 'select' }, defaultAggregate: 'distinct' });
const statusCol = col('status', { filter: { kind: 'select' }, defaultAggregate: 'distinct' });
const pointsCol = col('points', { filter: { kind: 'number' }, defaultAggregate: 'sum' });
const labelsCol = col('labels', { filter: { kind: 'select' }, defaultAggregate: 'distinct' });

// Project × Status grid. Cloud: Done(3,2), ToDo(5). Mobile: Done(1).
const issues: TableIssue[] = [
  { key: 'A-1', project: 'Cloud', status: 'Done', points: 3 },
  { key: 'A-2', project: 'Cloud', status: 'To Do', points: 5 },
  { key: 'A-3', project: 'Cloud', status: 'Done', points: 2 },
  { key: 'A-4', project: 'Mobile', status: 'Done', points: 1 },
];

describe('getAxisValues', () => {
  test('unique ordered values, titles and keys per axis', () => {
    const rows = getAxisValues(issues, projectCol);
    expect(rows.titles).toEqual(['Cloud', 'Mobile']);
    expect(rows.keys).toEqual(['Cloud', 'Mobile']);
    expect(rows.values).toEqual(['Cloud', 'Mobile']);

    const cols = getAxisValues(issues, statusCol);
    expect(cols.titles).toEqual(['Done', 'To Do']);
  });

  test('empty/missing values collapse into the (empty) bucket, ordered last', () => {
    const withEmpty = [...issues, { key: 'A-5', project: null, status: 'Done', points: 0 }];
    const rows = getAxisValues(withEmpty, projectCol);
    expect(rows.titles).toEqual(['Cloud', 'Mobile', EMPTY_GROUP_LABEL]);
  });

  test('array-valued fields expand to one axis value per element', () => {
    const arrayIssues: TableIssue[] = [
      { key: 'A-1', labels: ['red', 'blue'] },
      { key: 'A-2', labels: ['blue'] },
    ];
    const axis = getAxisValues(arrayIssues, labelsCol);
    expect(axis.titles).toEqual(['blue', 'red']);
  });
});

describe('buildCrossTab grid + cell aggregation', () => {
  const ct = buildCrossTab(issues, projectCol, statusCol);

  test('each cell holds the row ∩ column members', () => {
    expect(cellMembers(ct, 'Cloud', 'Done').map((m) => m.key)).toEqual(['A-1', 'A-3']);
    expect(cellMembers(ct, 'Cloud', 'To Do').map((m) => m.key)).toEqual(['A-2']);
    expect(cellMembers(ct, 'Mobile', 'Done').map((m) => m.key)).toEqual(['A-4']);
  });

  test('cell = row ∩ column aggregation of a measure', () => {
    // Cloud ∩ Done points sum = 3 + 2 = 5.
    expect(cellValue(ct, 'Cloud', 'Done', pointsCol)).toBe(5);
    expect(cellValue(ct, 'Cloud', 'To Do', pointsCol)).toBe(5);
    expect(cellValue(ct, 'Mobile', 'Done', pointsCol)).toBe(1);
  });

  test('empty cells have no members and aggregate to null', () => {
    // Mobile ∩ To Do is empty.
    expect(cellMembers(ct, 'Mobile', 'To Do')).toEqual([]);
    expect(cellValue(ct, 'Mobile', 'To Do', pointsCol)).toBeNull();
  });

  test('total column aggregates across the column axis (per row)', () => {
    // Cloud total points = 3 + 5 + 2 = 10; Mobile = 1.
    expect(cellValue(ct, 'Cloud', TOTAL_KEY, pointsCol)).toBe(10);
    expect(cellValue(ct, 'Mobile', TOTAL_KEY, pointsCol)).toBe(1);
  });

  test('total row aggregates across the row axis (per column)', () => {
    // Done total points = 3 + 2 + 1 = 6; To Do = 5.
    expect(cellValue(ct, TOTAL_KEY, 'Done', pointsCol)).toBe(6);
    expect(cellValue(ct, TOTAL_KEY, 'To Do', pointsCol)).toBe(5);
  });

  test('grand total is every issue counted once', () => {
    expect(cellMembers(ct, TOTAL_KEY, TOTAL_KEY).map((m) => m.key)).toEqual(['A-1', 'A-2', 'A-3', 'A-4']);
    expect(cellValue(ct, TOTAL_KEY, TOTAL_KEY, pointsCol)).toBe(11);
  });
});

describe('buildCrossTab with array-valued axes (cartesian, no double-counted totals)', () => {
  // A-1 is in both Cloud and Mobile projects; totals must count it once per axis value.
  const arrayIssues: TableIssue[] = [
    { key: 'A-1', project: ['Cloud', 'Mobile'], status: 'Done', points: 4 },
    { key: 'A-2', project: 'Cloud', status: 'Done', points: 2 },
  ];
  const ct = buildCrossTab(arrayIssues, projectCol, statusCol);

  test('an issue lands in every axis cell it belongs to', () => {
    expect(cellMembers(ct, 'Cloud', 'Done').map((m) => m.key)).toEqual(['A-1', 'A-2']);
    expect(cellMembers(ct, 'Mobile', 'Done').map((m) => m.key)).toEqual(['A-1']);
  });

  test('a row total counts each issue once per row value (not per column cartesian)', () => {
    expect(cellMembers(ct, 'Cloud', TOTAL_KEY).map((m) => m.key)).toEqual(['A-1', 'A-2']);
    expect(cellValue(ct, 'Cloud', TOTAL_KEY, pointsCol)).toBe(6);
  });

  test('the grand total counts each issue exactly once', () => {
    expect(cellMembers(ct, TOTAL_KEY, TOTAL_KEY).map((m) => m.key)).toEqual(['A-1', 'A-2']);
    expect(cellValue(ct, TOTAL_KEY, TOTAL_KEY, pointsCol)).toBe(6);
  });
});
