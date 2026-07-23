import { describe, test, expect } from 'vitest';

import {
  DEFAULT_TABLE_COLUMNS,
  buildColumnEntries,
  entriesToAggregationOverrides,
  entriesToColumnIds,
  toSortState,
} from './persistence';
import type { TableColumnEntry } from './persistence';

describe('TableReport persistence schema', () => {
  test('default columns are the combined Icon & Summary tree column', () => {
    expect(entriesToColumnIds(DEFAULT_TABLE_COLUMNS)).toEqual(['identity:treeSummary']);
  });

  test('entriesToColumnIds preserves order', () => {
    const entries: TableColumnEntry[] = [{ sourceId: 'b' }, { sourceId: 'a' }, { sourceId: 'c' }];
    expect(entriesToColumnIds(entries)).toEqual(['b', 'a', 'c']);
  });

  test('entriesToAggregationOverrides only includes entries with an aggregation', () => {
    const entries: TableColumnEntry[] = [
      { sourceId: 'field:points', aggregation: 'sum' },
      { sourceId: 'identity:key' },
      { sourceId: 'field:days', aggregation: 'average' },
    ];
    expect(entriesToAggregationOverrides(entries)).toEqual({
      'field:points': 'sum',
      'field:days': 'average',
    });
  });

  test('buildColumnEntries folds overrides in and preserves prior width', () => {
    const prev: TableColumnEntry[] = [{ sourceId: 'field:points', width: 120 }];
    const entries = buildColumnEntries(['field:points', 'identity:key'], { 'field:points': 'average' }, prev);
    expect(entries).toEqual([
      { sourceId: 'field:points', width: 120, aggregation: 'average' },
      { sourceId: 'identity:key' },
    ]);
  });

  test('buildColumnEntries drops overrides for ids no longer present', () => {
    const entries = buildColumnEntries(['identity:key'], { 'field:points': 'sum' });
    expect(entries).toEqual([{ sourceId: 'identity:key' }]);
  });

  test('round-trips columnIds + overrides through entries', () => {
    const ids = ['identity:key', 'field:points'];
    const overrides = { 'field:points': 'sum' as const };
    const entries = buildColumnEntries(ids, overrides);
    expect(entriesToColumnIds(entries)).toEqual(ids);
    expect(entriesToAggregationOverrides(entries)).toEqual(overrides);
  });

  test('toSortState maps empty column to null, otherwise composes SortState', () => {
    expect(toSortState('', 'asc')).toBeNull();
    expect(toSortState('identity:key', 'asc')).toEqual({ columnId: 'identity:key', dir: 'asc' });
    expect(toSortState('identity:key', 'desc')).toEqual({ columnId: 'identity:key', dir: 'desc' });
    expect(toSortState('identity:key', 'tree')).toEqual({ columnId: 'identity:key', dir: 'tree' });
    expect(toSortState('identity:key', 'rank')).toEqual({ columnId: 'identity:key', dir: 'rank' });
    // Unknown dir falls back to 'asc'.
    expect(toSortState('identity:key', 'weird')).toEqual({ columnId: 'identity:key', dir: 'asc' });
  });
});
