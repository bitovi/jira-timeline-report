import { expect, test } from 'vitest';

import { aggregateGroup, countReducer, sumReducer, avgReducer } from './aggregate';

import type { AggregationReducer } from './aggregate';

test('aggregateGroup with count and sum reducers', () => {
  const items = [
    { id: 1, value: 10 },
    { id: 2, value: 20 },
    { id: 3, value: 30 },
  ];

  const reducers = [countReducer('count'), sumReducer('totalValue', (item: { value: number }) => item.value)] as const;

  const result = aggregateGroup(items, reducers, { category: 'test' });

  expect(result).toEqual({
    count: 3,
    totalValue: 60,
  });
});

test('aggregateGroup with a finalize function that returns a different type', () => {
  const items = [
    { id: 1, value: 100 },
    { id: 2, value: 200 },
    { id: 3, value: 300 },
  ];
  type Item = (typeof items)[number];

  const valueInDollars: AggregationReducer<Item, number, 'valueInDollars', string> = {
    name: 'valueInDollars',
    initial: (groupContext) => 0 as number,
    update: (acc, item, groupContext) => acc + item.value,
    finalize: (acc, groupContext) => '$' + acc / 100,
  };
  const reducers = [valueInDollars] as const;

  const result = aggregateGroup(items, reducers);

  expect(result).toEqual({
    valueInDollars: '$6',
  });

  // Type inference test - these should compile correctly
  const valueInDollarsTyped: string = result.valueInDollars;
  expect(typeof valueInDollarsTyped).toBe('string');
});
