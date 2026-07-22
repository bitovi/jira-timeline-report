/**
 * Aggregation catalog for the Table report (spec/012-table-and-grouper, design §2).
 *
 * Each aggregation is expressed as an {@link AggregationReducer} reused from the GroupingReport
 * engine. By convention the reducer's `Item` IS the already-extracted column value (the caller maps
 * `issues.map(column.getValue)` before aggregating, i.e. the getter is the identity), which keeps
 * these reducers type-agnostic and directly unit-testable over value arrays.
 */
import { avgReducer, countReducer, sumReducer } from '../../GroupingReport/data/aggregate';

import type { AggregationReducer } from '../../GroupingReport/data/aggregate';
import type { FilterKind } from './columns';

export type AggregationId = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'range' | 'distinct';

export interface AggregationSpec {
  id: AggregationId;
  label: string;
  /** Filter kinds this aggregation makes sense for, or `'*'` for any type. */
  applicableTo: FilterKind[] | '*';
  reducer: AggregationReducer<any, any, string, any>;
}

/** Coerce a date-ish value (Date | epoch number | parseable string) to epoch ms, or null. */
function toTime(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Format a date-ish value as `YYYY-MM-DD` for the range label. */
function toDateLabel(value: unknown): string {
  const time = toTime(value);
  if (time == null) return String(value);
  return new Date(time).toISOString().slice(0, 10);
}

const minReducer: AggregationReducer<number, number | null, 'min', number | null> = {
  name: 'min',
  initial: () => null,
  update: (acc, item) => {
    if (typeof item !== 'number' || Number.isNaN(item)) return acc;
    return acc == null ? item : Math.min(acc, item);
  },
};

const maxReducer: AggregationReducer<number, number | null, 'max', number | null> = {
  name: 'max',
  initial: () => null,
  update: (acc, item) => {
    if (typeof item !== 'number' || Number.isNaN(item)) return acc;
    return acc == null ? item : Math.max(acc, item);
  },
};

const rangeReducer: AggregationReducer<unknown, { min: number | null; max: number | null }, 'range', string | null> = {
  name: 'range',
  initial: () => ({ min: null, max: null }),
  update: (acc, item) => {
    const time = toTime(item);
    if (time == null) return acc;
    return {
      min: acc.min == null ? time : Math.min(acc.min, time),
      max: acc.max == null ? time : Math.max(acc.max, time),
    };
  },
  finalize: (acc) => {
    if (acc.min == null || acc.max == null) return null;
    return `${toDateLabel(acc.min)} – ${toDateLabel(acc.max)}`;
  },
};

const distinctReducer: AggregationReducer<unknown, string[], 'distinct', string[]> = {
  name: 'distinct',
  initial: () => [],
  update: (acc, item) => {
    if (item == null) return acc;
    const str = String(item);
    return acc.includes(str) ? acc : [...acc, str];
  },
};

export const aggregations: Record<AggregationId, AggregationSpec> = {
  sum: { id: 'sum', label: 'Sum', applicableTo: ['number'], reducer: sumReducer('sum', (v: number) => v) },
  avg: { id: 'avg', label: 'Average', applicableTo: ['number'], reducer: avgReducer('avg', (v: number) => v) },
  min: { id: 'min', label: 'Min', applicableTo: ['number'], reducer: minReducer },
  max: { id: 'max', label: 'Max', applicableTo: ['number'], reducer: maxReducer },
  count: { id: 'count', label: 'Count', applicableTo: '*', reducer: countReducer('count') },
  range: { id: 'range', label: 'Range', applicableTo: ['date'], reducer: rangeReducer },
  distinct: { id: 'distinct', label: 'Distinct list', applicableTo: ['text', 'select'], reducer: distinctReducer },
};

/**
 * The type-appropriate default aggregation for a Jira field, keyed on `schema.type`
 * (+ `schema.items` for arrays): number → sum, date/datetime → range, text/option/user → distinct,
 * everything else → count.
 */
export function defaultAggregationForType(schemaType: string, schemaItems?: string): AggregationId {
  const type = (schemaItems ?? schemaType ?? '').toLowerCase();
  switch (type) {
    case 'number':
      return 'sum';
    case 'date':
    case 'datetime':
      return 'range';
    case 'string':
    case 'text':
    case 'option':
    case 'user':
      return 'distinct';
    default:
      return 'count';
  }
}
