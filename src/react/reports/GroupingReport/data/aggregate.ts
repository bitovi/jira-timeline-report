export type AggregationReducer<T, R, Name extends string = string> = {
  name: Name;
  initial: () => R;
  update: (acc: R, item: T) => R;
  finalize?: (acc: R) => any;
};

export function aggregateGroup<T>(items: T[], reducers: AggregationReducer<T, any>[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (const reducer of reducers) {
    let acc = reducer.initial();
    for (const item of items) {
      acc = reducer.update(acc, item);
    }
    result[reducer.name] = reducer.finalize ? reducer.finalize(acc) : acc;
  }

  return result;
}

export function countReducer<T>(name = 'count'): AggregationReducer<T, number> {
  return {
    name,
    initial: () => 0,
    update: (acc) => acc + 1,
  };
}

export function sumReducer<T>(name: string, getter: (item: T) => number): AggregationReducer<T, number> {
  return {
    name,
    initial: () => 0,
    update: (acc, item) => acc + getter(item),
  };
}

export function avgReducer<T>(
  name: string,
  getter: (item: T) => number,
): AggregationReducer<T, { sum: number; count: number }> {
  return {
    name,
    initial: () => ({ sum: 0, count: 0 }),
    update: (acc, item) => {
      const val = getter(item);
      return { sum: acc.sum + val, count: acc.count + 1 };
    },
    finalize: (acc) => (acc.count === 0 ? null : acc.sum / acc.count),
  };
}
