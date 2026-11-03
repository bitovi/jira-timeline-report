import { describe, test, expect } from 'vitest';

import {
  DEFAULT_TABLE_COLUMNS,
  buildColumnEntries,
  entriesToAggregationOverrides,
  entriesToColumnIds,
  entriesToDateFormats,
  entriesToValueOrders,
  setEntryFormat,
  entriesToValueColors,
  setEntryValueSettings,
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

  test('a date format round-trips; absent means date (spec/044)', () => {
    const entries: TableColumnEntry[] = [{ sourceId: 'report:dueDate' }, { sourceId: 'field:points' }];
    expect(entriesToDateFormats(entries)).toEqual({});

    const relative = setEntryFormat(entries, 'report:dueDate', 'relative');
    expect(relative).toEqual([{ sourceId: 'report:dueDate', format: 'relative' }, { sourceId: 'field:points' }]);
    expect(entriesToDateFormats(relative)).toEqual({ 'report:dueDate': 'relative' });
    expect(JSON.parse(JSON.stringify(relative))).toEqual(relative);

    // Back to the default drops the key, so old and new URLs look the same.
    expect(setEntryFormat(relative, 'report:dueDate', 'date')).toEqual(entries);
  });

  test('buildColumnEntries keeps a stored format when columns change', () => {
    const prev: TableColumnEntry[] = [{ sourceId: 'report:dueDate', format: 'relative', width: 120 }];
    expect(buildColumnEntries(['field:points', 'report:dueDate'], { 'report:dueDate': 'max' }, prev)).toEqual([
      { sourceId: 'field:points' },
      { sourceId: 'report:dueDate', width: 120, aggregation: 'max', format: 'relative' },
    ]);
  });

  test('a value order round-trips, survives column changes, and Reset drops it', () => {
    const entries: TableColumnEntry[] = [{ sourceId: 'builtin:status:name' }];
    const ordered = setEntryValueSettings(entries, 'builtin:status:name', { valueOrder: ['Ready', 'Idea'] });
    expect(ordered).toEqual([{ sourceId: 'builtin:status:name', valueOrder: ['Ready', 'Idea'] }]);
    expect(entriesToValueOrders(ordered)).toEqual({ 'builtin:status:name': ['Ready', 'Idea'] });
    expect(buildColumnEntries(['field:points', 'builtin:status:name'], {}, ordered)[1]).toEqual(ordered[0]);
    expect(setEntryValueSettings(ordered, 'builtin:status:name', {})).toEqual(entries);
  });

  test('picked colours round-trip next to the order, and an empty set drops the key', () => {
    const entries: TableColumnEntry[] = [{ sourceId: 'builtin:status:name', width: 90 }];
    const set = setEntryValueSettings(entries, 'builtin:status:name', {
      valueOrder: ['Ready'],
      valueColors: { Ready: 'color.chart.blue.bold' },
    });
    expect(set).toEqual([
      {
        sourceId: 'builtin:status:name',
        width: 90,
        valueOrder: ['Ready'],
        valueColors: { Ready: 'color.chart.blue.bold' },
      },
    ]);
    expect(entriesToValueColors(set)).toEqual({ 'builtin:status:name': { Ready: 'color.chart.blue.bold' } });
    expect(buildColumnEntries(['builtin:status:name'], {}, set)).toEqual(set);
    expect(setEntryValueSettings(set, 'builtin:status:name', { valueOrder: ['Ready'], valueColors: {} })).toEqual([
      { sourceId: 'builtin:status:name', width: 90, valueOrder: ['Ready'] },
    ]);
  });
});
