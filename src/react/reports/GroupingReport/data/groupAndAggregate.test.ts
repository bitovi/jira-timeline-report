import { expect, test } from 'vitest';

import { groupAndAggregate } from './groupAndAggregate';
import { countReducer, sumReducer, avgReducer } from './aggregate';

test('groupAndAggregate', () => {
  const items = [
    { id: 1, category: 'A', value: 10 },
    { id: 2, category: 'B', value: 20 },
    { id: 3, category: 'A', value: 30 },
  ];

  type Item = (typeof items)[number];

  const groupBys = [
    {
      key: 'category',
      value: (item: Item) => item.category,
    },
  ] as const;

  const reducers = [
    countReducer('count'),
    sumReducer('totalValue', (item: Item) => item.value),
    avgReducer('averageValue', (item: Item) => item.value),
  ] as const;

  const result = groupAndAggregate(items, groupBys, reducers);

  expect(result).toEqual([
    { category: 'A', count: 2, totalValue: 40, averageValue: 20 },
    { category: 'B', count: 1, totalValue: 20, averageValue: 20 },
  ]);
});

test('groupAndAggregate with parentKey and yearMonth grouping', () => {
  const items = [
    // jan to mar
    { id: 1, start: new Date('2023-01-15'), due: new Date('2023-03-10'), value: 100, parentKey: 'parent1' },
    // feb to apr
    { id: 2, start: new Date('2023-02-05'), due: new Date('2023-04-20'), value: 200, parentKey: 'parent1' },
    // jan to feb
    { id: 3, start: new Date('2023-01-25'), due: new Date('2023-02-28'), value: 150, parentKey: 'parent2' },
  ];

  type Item = (typeof items)[number];

  const yearMonthGroupBy = {
    key: 'yearMonth',
    value: (item) => {
      const start = item.start;
      const due = item.due;
      if (!start || !due) {
        return { year: -1, month: -1 };
      } else {
        // make an array of every month between start and due
        return getMonthsBetweenInclusive(start, due).map((date) => {
          return getYearMonth(date);
        });
      }
    },
  } as const;

  const parentKeyGroupBy = {
    key: 'parentKey',
    value: (item: Item) => item.parentKey || 'no-parent',
  } as const;

  const groupBys = [yearMonthGroupBy, parentKeyGroupBy] as const;
  const reducers = [countReducer('count')] as const;

  const result = groupAndAggregate(items, groupBys, reducers);
  console.log(result);
  expect(result).toEqual([
    { yearMonth: { year: 2023, month: 1 }, parentKey: 'parent1', count: 1 },
    { yearMonth: { year: 2023, month: 2 }, parentKey: 'parent1', count: 2 },
    { yearMonth: { year: 2023, month: 3 }, parentKey: 'parent1', count: 2 },
    { yearMonth: { year: 2023, month: 4 }, parentKey: 'parent1', count: 1 },
    { yearMonth: { year: 2023, month: 1 }, parentKey: 'parent2', count: 1 },
    { yearMonth: { year: 2023, month: 2 }, parentKey: 'parent2', count: 1 },
  ]);
});

/**
 * Returns an array of Date objects representing the first day of each month between start and end, inclusive.
 * Both start and end are included, and the returned Dates are set to the first of the month (UTC).
 */
export function getMonthsBetweenInclusive(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  if (!start || !end) return months;
  // Clone and set to first of month UTC
  let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = end.getUTCMonth();
  const endYear = end.getUTCFullYear();
  while (
    current.getUTCFullYear() < endYear ||
    (current.getUTCFullYear() === endYear && current.getUTCMonth() <= endMonth)
  ) {
    months.push(new Date(current));
    // Move to next month
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Returns the year and the month like {year: 2023, month: 1} for the given Date (UTC).
 */
export function getYearMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // getUTCMonth() is zero-based
  return { year, month };
}
