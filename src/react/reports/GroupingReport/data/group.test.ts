import { expect, test } from 'vitest';

import { groupByKeys, createStableObjectKey } from './group';

test('groupByKeys', () => {
  const items = [
    { id: 1, category: 'A' },
    { id: 2, category: 'B' },
    { id: 3, category: 'A' },
  ];

  const groupBys = [
    {
      key: 'category',
      value: (item) => item.category,
    },
  ];

  const grouped = groupByKeys(items, groupBys);

  const keyA = createStableObjectKey({ category: 'A' });
  const keyB = createStableObjectKey({ category: 'B' });
  expect(grouped.get(keyA)).toEqual([
    { id: 1, category: 'A' },
    { id: 3, category: 'A' },
  ]);
  expect(grouped.get(keyB)).toEqual([{ id: 2, category: 'B' }]);
});

test('groupByKeys with multi-group', () => {
  const items = [
    { id: 1, category: 'A', type: 'X' },
    { id: 2, category: 'B', type: 'Y' },
    { id: 3, category: 'A', type: 'X' },
    { id: 4, category: 'A', type: 'Y' },
  ];

  const groupBys = [
    {
      key: 'category',
      value: (item) => item.category,
    },
    {
      key: 'type',
      value: (item) => item.type,
    },
  ];

  const keyAX = createStableObjectKey({ category: 'A', type: 'X' });
  const keyAY = createStableObjectKey({ category: 'A', type: 'Y' });
  const keyBY = createStableObjectKey({ category: 'B', type: 'Y' });

  const grouped = groupByKeys(items, groupBys);

  expect(grouped.get(keyAX)).toEqual([
    { id: 1, category: 'A', type: 'X' },
    { id: 3, category: 'A', type: 'X' },
  ]);
  expect(grouped.get(keyAY)).toEqual([{ id: 4, category: 'A', type: 'Y' }]);
  expect(grouped.get(keyBY)).toEqual([{ id: 2, category: 'B', type: 'Y' }]);
});

test('groupByKeys with items that belong to multiple groups', () => {
  const items = [
    { id: 1, category: 'A', tags: ['x', 'y'] },
    { id: 2, category: 'B', tags: ['y'] },
    { id: 3, category: 'A', tags: ['x'] },
  ];

  const groupBys = [
    {
      key: 'category',
      value: (item) => item.category,
    },
    {
      key: 'tags',
      value: (item) => item.tags,
    },
  ];

  const grouped = groupByKeys(items, groupBys);

  expect(grouped.get(createStableObjectKey({ category: 'A', tags: 'x' }))).toEqual([
    { id: 1, category: 'A', tags: ['x', 'y'] },
    { id: 3, category: 'A', tags: ['x'] },
  ]);
  const keyBY = createStableObjectKey({ category: 'B', tags: 'y' });
  expect(grouped.get(keyBY)).toEqual([{ id: 2, category: 'B', tags: ['y'] }]);
});

test('groupByKeys does not drop items whose array-valued groupBy is empty', () => {
  const items = [
    { id: 1, category: 'A', tags: ['x'] },
    { id: 2, category: 'B', tags: [] },
  ];

  const groupBys = [
    {
      key: 'category',
      value: (item) => item.category,
    },
    {
      key: 'tags',
      value: (item) => item.tags,
    },
  ];

  const grouped = groupByKeys(items, groupBys);

  // Item 2 has no tags — it must still land in a bucket (keyed by tags: null), not vanish entirely.
  const allItems = Array.from(grouped.values()).flat();
  expect(allItems.map((i) => i.id)).toContain(2);

  const keyBNull = createStableObjectKey({ category: 'B', tags: null });
  expect(grouped.get(keyBNull)).toEqual([{ id: 2, category: 'B', tags: [] }]);
});
