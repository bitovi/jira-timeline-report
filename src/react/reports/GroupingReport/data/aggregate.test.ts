import { expect, test } from 'vitest';

import { aggregateGroup, countReducer, sumReducer, avgReducer } from './aggregate';

test('aggregateGroup with count and sum reducers', () => {
  const items = [
    { id: 1, value: 10 },
    { id: 2, value: 20 },
    { id: 3, value: 30 },
  ];

  const reducers = [countReducer('count'), sumReducer('totalValue', (item: { value: number }) => item.value)] as const;

  const result = aggregateGroup(items, reducers);

  expect(result).toEqual({
    count: 3,
    totalValue: 60,
  });
});
