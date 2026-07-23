import { describe, expect, test } from 'vitest';

import { aggregateGroup } from '../../GroupingReport/data/aggregate';
import { aggregations, defaultAggregationForType, isNumericAggregation } from './aggregations';

import type { AggregationId } from './aggregations';

/** Run a single catalog reducer over an array of already-extracted column values. */
function run(id: AggregationId, values: unknown[]): unknown {
  const reducer = aggregations[id].reducer;
  const result = aggregateGroup(values, [reducer] as const) as Record<string, unknown>;
  return result[reducer.name];
}

describe('aggregation reducers', () => {
  test('sum adds numeric values', () => {
    expect(run('sum', [10, 20, 30])).toBe(60);
  });

  test('avg averages numeric values', () => {
    expect(run('avg', [10, 20, 30])).toBe(20);
    expect(run('avg', [])).toBeNull();
  });

  test('min / max ignore non-numbers and empty', () => {
    expect(run('min', [5, 2, 9])).toBe(2);
    expect(run('max', [5, 2, 9])).toBe(9);
    expect(run('min', [null, 3, undefined])).toBe(3);
    expect(run('min', [])).toBeNull();
    expect(run('max', [])).toBeNull();
  });

  test('isNumericAggregation: sum/avg/min/max/count are numeric, range/distinct are not', () => {
    expect(isNumericAggregation('sum')).toBe(true);
    expect(isNumericAggregation('avg')).toBe(true);
    expect(isNumericAggregation('min')).toBe(true);
    expect(isNumericAggregation('max')).toBe(true);
    expect(isNumericAggregation('count')).toBe(true);
    expect(isNumericAggregation('range')).toBe(false);
    expect(isNumericAggregation('distinct')).toBe(false);
  });

  test('count counts every item', () => {
    expect(run('count', ['a', 'b', null, 3])).toBe(4);
  });

  test('range produces a min–max date label', () => {
    expect(run('range', ['2024-03-01', '2024-01-15', '2024-06-30'])).toBe('2024-01-15 – 2024-06-30');
    expect(run('range', [null, undefined])).toBeNull();
  });

  test('distinct collects distinct values in first-seen order', () => {
    expect(run('distinct', ['A', 'B', 'A', 'C', null, 'B'])).toEqual(['A', 'B', 'C']);
    expect(run('distinct', [])).toEqual([]);
  });

  test('distinct flattens array-valued items (e.g. per-issue Labels arrays) instead of stringifying the array', () => {
    // Regression: an issue with no labels ([]) used to stringify to '' and join into a stray comma
    // like "QA, , UAT". Each issue's labels array must be flattened and empties skipped.
    expect(run('distinct', [['QA'], [], ['UAT']])).toEqual(['QA', 'UAT']);
    expect(run('distinct', [['AITEST', ''], []])).toEqual(['AITEST']);
    expect(run('distinct', [[], [], []])).toEqual([]);
  });
});

describe('catalog shape', () => {
  test('every AggregationId has a spec with a matching reducer name', () => {
    (Object.keys(aggregations) as AggregationId[]).forEach((id) => {
      const spec = aggregations[id];
      expect(spec.id).toBe(id);
      expect(spec.reducer.name).toBe(id);
      expect(spec.applicableTo).toBeDefined();
    });
  });
});

describe('defaultAggregationForType', () => {
  test('per-type defaults', () => {
    expect(defaultAggregationForType('number')).toBe('sum');
    expect(defaultAggregationForType('date')).toBe('range');
    expect(defaultAggregationForType('datetime')).toBe('range');
    expect(defaultAggregationForType('string')).toBe('distinct');
    expect(defaultAggregationForType('option')).toBe('distinct');
    expect(defaultAggregationForType('user')).toBe('distinct');
  });

  test('unknown type falls back to count', () => {
    expect(defaultAggregationForType('mystery-type')).toBe('count');
  });

  test('array item type takes precedence', () => {
    expect(defaultAggregationForType('array', 'number')).toBe('sum');
    expect(defaultAggregationForType('array', 'option')).toBe('distinct');
  });
});
