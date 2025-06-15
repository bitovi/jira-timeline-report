export type AggregationReducer<Item, Accumulator, Name extends string = string> = {
  name: Name;
  initial: () => Accumulator;
  update: (acc: Accumulator, item: Item) => Accumulator;
  finalize?: (acc: Accumulator) => any;
};

/**
 * Helper type: Extracts a single reducer\'s contribution to the final result object.
 *
 * For a reducer like `sumReducer(\'totalValue\', getter)`, this creates:
 * `{ totalValue: number }`
 *
 * Steps:
 * 1. Extract the Name (e.g., \'totalValue\') and AccumulatorValue (e.g., number) from the reducer
 * 2. Check if the reducer has a `finalize` function:
 *    - If yes, use the finalize function\'s return type as the value type
 *    - If no, use the accumulator type as the value type
 * 3. Create an object type with the name as key and the determined type as value
 */
export type AggregationReducerResult<Reducer extends AggregationReducer<any, any, any>> = Reducer extends {
  name: infer Name;
  initial: () => infer AccumulatorValue;
} // Ensure Name and AccumulatorValue are inferred
  ? Name extends string // Ensure Name is a string
    ? Reducer extends { finalize: (acc: AccumulatorValue) => infer FinalValue } // Check for finalize with matching AccumulatorValue
      ? { [K in Name]: FinalValue }
      : { [K in Name]: AccumulatorValue }
    : never
  : never;

/**
 * Helper type: Combines multiple reducers into a single result object type.
 *
 * For reducers like `[countReducer('count'), sumReducer('total', getter)]`, this creates:
 * `{ count: number, total: number }`
 *
 * Steps:
 * 1. Map over each reducer in the tuple to get its individual result type
 * 2. Extract the union of all individual result types using `[number]`
 * 3. Convert the union to an intersection using `UnionToIntersection`
 *    - Union: `{ count: number } | { total: number }`
 *    - Intersection: `{ count: number } & { total: number }` = `{ count: number, total: number }`
 */
export type AggregateGroupResult<Reducers extends readonly AggregationReducer<any, any, any>[]> = UnionToIntersection<
  {
    [Index in keyof Reducers]: Reducers[Index] extends AggregationReducer<any, any, any>
      ? AggregationReducerResult<Reducers[Index]>
      : never;
  }[number]
>;

/**
 * Helper: Converts a union type to an intersection type.
 *
 * This is a TypeScript utility that transforms:
 * `{ a: number } | { b: string }` → `{ a: number } & { b: string }` = `{ a: number, b: string }`
 *
 * How it works (advanced TypeScript magic):
 * 1. `Union extends any` distributes over the union members
 * 2. `(k: Union) => void` creates function types for each member
 * 3. The intersection of function types `(k: A) => void & (k: B) => void`
 *    can only be satisfied by a parameter that is the intersection A & B
 * 4. `infer Intersection` extracts that intersection type
 *
 * Source: https://stackoverflow.com/a/50375286/786644
 */
export type UnionToIntersection<Union> = (Union extends any ? (k: Union) => void : never) extends (
  k: infer Intersection,
) => void
  ? Intersection
  : never;

/**
 * Given an array of items and an array of aggregation reducers, this function aggregates the items.
 * The return type is now inferred from the reducers array.
 *
 * NOTE: For best type inference, pass the reducers as a tuple using `as const`.
 *
 * Example:
 *   const result = aggregateGroup(items, [
 *     countReducer('count'),
 *     sumReducer('totalValue', (item) => item.value),
 *   ] as const);
 *   // result: { count: number, totalValue: number }
 */
export function aggregateGroup<Item, Reducers extends readonly AggregationReducer<Item, any, any>[]>(
  items: Item[],
  reducers: Reducers,
): AggregateGroupResult<Reducers> {
  const result: Record<string, any> = {};

  // TypeScript will infer the correct type if reducers is a tuple (as const)
  for (const reducer of reducers) {
    let acc = reducer.initial();
    for (const item of items) {
      acc = reducer.update(acc, item);
    }
    result[reducer.name] = reducer.finalize ? reducer.finalize(acc) : acc;
  }

  return result as AggregateGroupResult<Reducers>;
}

export function countReducer<Item, Name extends string = 'count'>(name?: Name): AggregationReducer<Item, number, Name> {
  return {
    name: (name ?? 'count') as Name,
    initial: () => 0,
    update: (acc) => acc + 1,
  };
}

export function sumReducer<Item, Name extends string>(
  name: Name,
  getter: (item: Item) => number,
): AggregationReducer<Item, number, Name> {
  return {
    name,
    initial: () => 0,
    update: (acc, item) => acc + getter(item),
  };
}

export function avgReducer<Item, Name extends string>(
  name: Name,
  getter: (item: Item) => number,
): AggregationReducer<Item, { sum: number; count: number }, Name> {
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
