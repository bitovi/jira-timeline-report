/**
 * Date measures west of UTC. `process.env.TZ` is read when the first Date is created, so it is set
 * before any import; this file runs in its own process (`*.tz.test.ts`, see vite.config.ts).
 */
process.env.TZ = 'America/Los_Angeles';

import { describe, expect, test } from 'vitest';

import { displayMeasureValue } from './grouping';
import { formatDateValue } from './relativeDate';

import type { AggregationId } from './aggregations';
import type { ColumnDefinition, TableIssue } from './columns';

const dueCol: ColumnDefinition = {
  id: 'due',
  label: 'due',
  group: 'Fields',
  source: { kind: 'field', fieldKey: 'due', schemaType: 'date' },
  getValue: (issue) => (issue as Record<string, unknown>).due,
  render: (value) => String(value ?? ''),
  filter: { kind: 'date' },
  defaultAggregate: 'range',
};

// Raw Jira date fields are date-only strings. Parsed as an epoch, 2026-10-30 is UTC midnight — the
// afternoon of Oct 29 in Los Angeles — which read "Today" on Oct 29 instead of "1 day out".
const members: TableIssue[] = [
  { key: 'A', due: '2026-10-30' },
  { key: 'B', due: '2026-11-02' },
];

describe('date measures west of UTC (America/Los_Angeles)', () => {
  const today = new Date(2026, 9, 29, 9);

  test('runs west of UTC', () => {
    expect(today.getTimezoneOffset()).toBeGreaterThan(0);
  });

  test('How far out reads date-only values as local calendar days, as the ungrouped cell does', () => {
    expect(formatDateValue('2026-10-30', 'relative', today)).toBe('1 day out');
    const show = (aggregation: AggregationId) =>
      displayMeasureValue(dueCol, members, { aggregation, dateFormat: 'relative', today });
    expect(show('min')).toBe('1 day out');
    expect(show('max')).toBe('4 days out');
    expect(show('range')).toBe('1 day out – 4 days out');
  });

  test('the Date format is unchanged', () => {
    const show = (aggregation: AggregationId) => displayMeasureValue(dueCol, members, { aggregation });
    expect(show('min')).toBe('2026-10-30');
    expect(show('max')).toBe('2026-11-02');
  });
});
