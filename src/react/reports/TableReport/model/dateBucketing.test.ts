import { describe, test, expect } from 'vitest';

import { bucketDateValue, bucketedDateColumn, DATE_GRANULARITIES, DATE_GRANULARITY_LABELS } from './dateBucketing';

import type { ColumnDefinition, TableIssue } from './columns';

describe('bucketDateValue', () => {
  test('day: returns the ISO date', () => {
    expect(bucketDateValue('2024-07-22T05:00:00.000Z', 'day')).toBe('2024-07-22');
    expect(bucketDateValue('2024-07-22T23:59:00.000Z', 'day')).toBe('2024-07-22');
  });

  test('week: returns the Monday that starts the containing week', () => {
    // 2024-07-22 is a Monday.
    expect(bucketDateValue('2024-07-22', 'week')).toBe('2024-07-22');
    // 2024-07-26 (Friday) and 2024-07-28 (Sunday) fall in the same week starting Monday 2024-07-22.
    expect(bucketDateValue('2024-07-26', 'week')).toBe('2024-07-22');
    expect(bucketDateValue('2024-07-28', 'week')).toBe('2024-07-22');
    // The following Monday starts a new week bucket.
    expect(bucketDateValue('2024-07-29', 'week')).toBe('2024-07-29');
  });

  test('month: returns zero-padded YYYY-MM', () => {
    expect(bucketDateValue('2024-01-15', 'month')).toBe('2024-01');
    expect(bucketDateValue('2024-11-30', 'month')).toBe('2024-11');
  });

  test('quarter: returns YYYY-Q#', () => {
    expect(bucketDateValue('2024-01-15', 'quarter')).toBe('2024-Q1');
    expect(bucketDateValue('2024-04-01', 'quarter')).toBe('2024-Q2');
    expect(bucketDateValue('2024-09-30', 'quarter')).toBe('2024-Q3');
    expect(bucketDateValue('2024-12-31', 'quarter')).toBe('2024-Q4');
  });

  test('year: returns YYYY', () => {
    expect(bucketDateValue('2024-06-15', 'year')).toBe('2024');
  });

  test('returns null for missing/unparseable values', () => {
    expect(bucketDateValue(null, 'month')).toBeNull();
    expect(bucketDateValue(undefined, 'month')).toBeNull();
    expect(bucketDateValue('not a date', 'month')).toBeNull();
  });

  test('labels sort chronologically as plain strings', () => {
    for (const granularity of DATE_GRANULARITIES) {
      const values = ['2024-01-05', '2023-12-20', '2024-03-01'].map((v) => bucketDateValue(v, granularity)!);
      const sorted = [...values].sort((a, b) => a.localeCompare(b));
      const chronological = [...values].sort(
        (a, b) => new Date(a.replace(/-Q(\d)/, '-$1')).getTime() - new Date(b.replace(/-Q(\d)/, '-$1')).getTime(),
      );
      // Both orderings should agree on relative order for these well-separated dates.
      expect(sorted[0]).toBe(chronological[0]);
      expect(sorted[sorted.length - 1]).toBe(chronological[chronological.length - 1]);
    }
  });
});

describe('bucketedDateColumn', () => {
  const dueCol: ColumnDefinition<string | undefined> = {
    id: 'field:due',
    label: 'Due Date',
    group: 'Fields',
    source: { kind: 'field', fieldKey: 'due', schemaType: 'date' },
    getValue: (issue) => (issue as TableIssue).due as string | undefined,
    render: (value) => value ?? '',
    compare: (a, b) => String(a).localeCompare(String(b)),
    filter: { kind: 'date' },
    defaultAggregate: 'range',
  };

  test('keeps the column id, suffixes the label with the granularity', () => {
    const wrapped = bucketedDateColumn(dueCol, 'month');
    expect(wrapped.id).toBe('field:due');
    expect(wrapped.label).toBe(`Due Date (${DATE_GRANULARITY_LABELS.month})`);
  });

  test('getValue returns the bucket label instead of the raw date', () => {
    const wrapped = bucketedDateColumn(dueCol, 'quarter');
    const issue = { due: '2024-04-15' } as unknown as TableIssue;
    expect(wrapped.getValue(issue)).toBe('2024-Q2');
  });

  test('getValue returns null for issues with no date (falls back to the empty-group bucket)', () => {
    const wrapped = bucketedDateColumn(dueCol, 'month');
    expect(wrapped.getValue({} as TableIssue)).toBeNull();
  });

  test('compare orders bucket labels chronologically, nulls last', () => {
    const wrapped = bucketedDateColumn(dueCol, 'month');
    expect(wrapped.compare('2024-01', '2024-02')).toBeLessThan(0);
    expect(wrapped.compare('2024-02', '2024-01')).toBeGreaterThan(0);
    expect(wrapped.compare(null, '2024-01')).toBeGreaterThan(0);
    expect(wrapped.compare('2024-01', null)).toBeLessThan(0);
    expect(wrapped.compare(null, null)).toBe(0);
  });
});
