/**
 * Aggregation catalog for the Table report (spec/012-table-and-grouper, design §2).
 *
 * Each aggregation is expressed as an {@link AggregationReducer} reused from the shared aggregate
 * engine. By convention the reducer's `Item` IS the already-extracted column value (the caller maps
 * `issues.map(column.getValue)` before aggregating, i.e. the getter is the identity), which keeps
 * these reducers type-agnostic and directly unit-testable over value arrays.
 */
import { avgReducer, countReducer, sumReducer } from './aggregate';
import { fieldValueText } from './fieldValueText';

import type { AggregationReducer } from './aggregate';
import type { FilterKind } from './columns';

export type AggregationId = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'range' | 'distinct' | 'tally' | 'bar';

/**
 * Aggregation ids that always reduce to a single number, regardless of the underlying column's
 * type (e.g. `count` on a text column still yields a number). Used to right-align aggregated
 * (group-header / cross-tab) cells per the numeric-column alignment convention — `range` (a date
 * span string), `distinct` (a string list), and `tally`/`bar` (counted lists) are deliberately excluded.
 * `min`/`max` over a DATE column reduce to an epoch number but display as a date; `isNumericMeasure`
 * in `grouping.ts` handles that exception.
 */
export const NUMERIC_AGGREGATION_IDS: ReadonlySet<AggregationId> = new Set(['sum', 'avg', 'min', 'max', 'count']);

/** Whether an aggregation id always produces a numeric result (see {@link NUMERIC_AGGREGATION_IDS}). */
export function isNumericAggregation(id: AggregationId): boolean {
  return NUMERIC_AGGREGATION_IDS.has(id);
}

export interface AggregationSpec {
  id: AggregationId;
  label: string;
  /** Filter kinds this aggregation makes sense for, or `'*'` for any type. */
  applicableTo: FilterKind[] | '*';
  reducer: AggregationReducer<any, any, string, any>;
}

/** Coerce a date-ish value (Date | epoch number | parseable string) to epoch ms, or null. */
export function toTime(value: unknown): number | null {
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

/**
 * A min/max item as a number: numbers pass through and date-ish values (Date, parseable string)
 * reduce to epoch ms via {@link toTime}, so the same reducers serve number and date columns.
 */
function toComparable(item: unknown): number | null {
  if (typeof item === 'number') return Number.isNaN(item) ? null : item;
  if (item instanceof Date || typeof item === 'string') return toTime(item);
  return null;
}

const minReducer: AggregationReducer<unknown, number | null, 'min', number | null> = {
  name: 'min',
  initial: () => null,
  update: (acc, item) => {
    const value = toComparable(item);
    if (value == null) return acc;
    return acc == null ? value : Math.min(acc, value);
  },
};

const maxReducer: AggregationReducer<unknown, number | null, 'max', number | null> = {
  name: 'max',
  initial: () => null,
  update: (acc, item) => {
    const value = toComparable(item);
    if (value == null) return acc;
    return acc == null ? value : Math.max(acc, value);
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
    // Array-valued columns (e.g. Labels) pass each issue's whole array as `item` — flatten it so we
    // dedupe individual values instead of stringifying the array (which produced bugs like an issue
    // with no labels stringifying to `''` and rendering as a stray comma: "QA, , UAT").
    const values = Array.isArray(item) ? item : [item];
    let next = acc;
    for (const value of values) {
      // Via `fieldValueText` so an object-valued field (Assignee, Priority) contributes its label
      // instead of a list of identical `[object Object]` entries collapsing into one.
      const str = fieldValueText(value);
      if (str === '') continue;
      if (!next.includes(str)) next = [...next, str];
    }
    return next;
  },
};

/**
 * Count each value: `"Estimated (1), Partially estimated (2)"`, in first-seen order. Array-valued
 * columns are flattened like {@link distinctReducer}, so each label of an issue is counted once.
 *
 * Shared by "Count by value" (`tally`) and "Stacked bar" (`bar`). The bar's cell is drawn by
 * `renderStackedBar`; this text is what it sorts by and what shows wherever there is no renderer.
 */
function countByValueReducer<Name extends string>(
  name: Name,
): AggregationReducer<unknown, Array<[string, number]>, Name, string | null> {
  return {
    name,
    initial: () => [],
    update: (acc, item) => {
      const values = Array.isArray(item) ? item : [item];
      let next = acc;
      for (const value of values) {
        const str = fieldValueText(value);
        if (str === '') continue;
        const index = next.findIndex(([label]) => label === str);
        next =
          index === -1
            ? [...next, [str, 1]]
            : next.map((entry, i) => (i === index ? ([entry[0], entry[1] + 1] as [string, number]) : entry));
      }
      return next;
    },
    finalize: (acc) => (acc.length === 0 ? null : acc.map(([label, count]) => `${label} (${count})`).join(', ')),
  };
}

export const aggregations: Record<AggregationId, AggregationSpec> = {
  sum: { id: 'sum', label: 'Sum', applicableTo: ['number'], reducer: sumReducer('sum', (v: number) => v) },
  avg: { id: 'avg', label: 'Average', applicableTo: ['number'], reducer: avgReducer('avg', (v: number) => v) },
  min: { id: 'min', label: 'Min', applicableTo: ['number', 'date'], reducer: minReducer },
  max: { id: 'max', label: 'Max', applicableTo: ['number', 'date'], reducer: maxReducer },
  count: { id: 'count', label: 'Count', applicableTo: '*', reducer: countReducer('count') },
  range: { id: 'range', label: 'Range', applicableTo: ['date'], reducer: rangeReducer },
  distinct: { id: 'distinct', label: 'Distinct list', applicableTo: ['text', 'select'], reducer: distinctReducer },
  tally: {
    id: 'tally',
    label: 'Count by value',
    applicableTo: ['text', 'select'],
    reducer: countByValueReducer('tally'),
  },
  bar: { id: 'bar', label: 'Stacked bar', applicableTo: ['text', 'select'], reducer: countByValueReducer('bar') },
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
