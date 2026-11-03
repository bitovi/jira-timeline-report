import { describe, expect, test } from 'vitest';

import { columnValues, mergeValueOrder, orderValues, supportsOrderAndColors } from './valueOrder';

import type { ColumnDefinition, TableIssue } from './columns';

const col = (overrides: Partial<ColumnDefinition> = {}): ColumnDefinition => ({
  id: 'value',
  label: 'Value',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'value', schemaType: 'string' },
  getValue: (issue: TableIssue) => issue.value,
  render: (v) => String(v),
  compare: () => 0,
  filter: { kind: 'select' },
  ...overrides,
});

describe('orderValues', () => {
  test('defaults to A→Z', () => {
    expect(orderValues(['Ready', 'Done', 'Idea'])).toEqual(['Done', 'Idea', 'Ready']);
  });

  test('saved order first, then A→Z; unknown names ignored', () => {
    expect(orderValues(['c', 'a', 'd', 'b'], ['d', 'gone', 'b'])).toEqual(['d', 'b', 'a', 'c']);
  });
});

test('columnValues flattens arrays and drops blanks, in first-seen order', () => {
  const issues: TableIssue[] = [{ value: ['ui', 'bug'] }, { value: null }, { value: 'bug' }, { value: '' }];
  expect(columnValues(col(), issues)).toEqual(['ui', 'bug']);
});

test('mergeValueOrder keeps previously saved values that are not loaded now, after the arranged ones', () => {
  expect(mergeValueOrder(['b', 'a'], ['a', 'gone', 'b'])).toEqual(['b', 'a', 'gone']);
  expect(mergeValueOrder(['b', 'a'])).toEqual(['b', 'a']);
});

test('supportsOrderAndColors: text/select columns that are not identity columns', () => {
  expect(supportsOrderAndColors(col())).toBe(true);
  expect(supportsOrderAndColors(col({ filter: { kind: 'text' } }))).toBe(true);
  expect(supportsOrderAndColors(col({ filter: { kind: 'number' } }))).toBe(false);
  expect(supportsOrderAndColors(col({ filter: { kind: 'date' } }))).toBe(false);
  expect(supportsOrderAndColors(col({ isIdentity: true, filter: { kind: 'text' } }))).toBe(false);
});
