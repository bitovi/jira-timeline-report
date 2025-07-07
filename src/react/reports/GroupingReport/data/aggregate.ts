export type AggregationReducer<Item, Accumulator, Name extends string = string, FinalizeResult = Accumulator> = {
  name: Name;
  initial: (groupContext: Record<string, any>) => Accumulator;
  update: (acc: Accumulator, item: Item, groupContext: Record<string, any>) => Accumulator;
  finalize?: (acc: Accumulator, groupContext: Record<string, any>) => FinalizeResult;
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
export type AggregationReducerResult<Reducer extends AggregationReducer<any, any, any, any>> =
  Reducer extends AggregationReducer<any, any, infer Name, infer FinalizeResult>
    ? Name extends string
      ? { [K in Name]: FinalizeResult }
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
export type AggregateGroupResult<Reducers extends readonly AggregationReducer<any, any, any, any>[]> =
  UnionToIntersection<
    {
      [Index in keyof Reducers]: Reducers[Index] extends AggregationReducer<any, any, any, any>
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
export function aggregateGroup<Item, Reducers extends readonly AggregationReducer<Item, any, any, any>[]>(
  items: Item[],
  reducers: Reducers,
  groupContext: Record<string, any> = {},
): AggregateGroupResult<Reducers> {
  const result: Record<string, any> = {};

  // TypeScript will infer the correct type if reducers is a tuple (as const)
  for (const reducer of reducers) {
    let acc = reducer.initial(groupContext);
    for (const item of items) {
      acc = reducer.update(acc, item, groupContext);
    }
    result[reducer.name] = reducer.finalize ? reducer.finalize(acc, groupContext) : acc;
  }

  return result as AggregateGroupResult<Reducers>;
}

export function countReducer<Item, Name extends string = 'count'>(
  name?: Name,
): AggregationReducer<Item, number, Name, number> {
  return {
    name: (name ?? 'count') as Name,
    initial: (groupContext) => 0,
    update: (acc, item, groupContext) => acc + 1,
  };
}

export function sumReducer<Item, Name extends string>(
  name: Name,
  getter: (item: Item) => number,
): AggregationReducer<Item, number, Name, number> {
  return {
    name,
    initial: (groupContext) => 0,
    update: (acc, item, groupContext) => acc + getter(item),
  };
}

export function avgReducer<Item, Name extends string>(
  name: Name,
  getter: (item: Item) => number,
): AggregationReducer<Item, { sum: number; count: number }, Name, number | null> {
  return {
    name,
    initial: (groupContext) => ({ sum: 0, count: 0 }),
    update: (acc, item, groupContext) => {
      const val = getter(item);
      return { sum: acc.sum + val, count: acc.count + 1 };
    },
    finalize: (acc, groupContext) => (acc.count === 0 ? null : acc.sum / acc.count),
  };
}

/**
 * Example reducer that uses group context to include the group information in the result.
 * This demonstrates how reducers can access the current group being processed.
 */
export function groupContextReducer<Item, Name extends string>(
  name: Name,
  formatter?: (groupContext: Record<string, any>) => string,
): AggregationReducer<Item, string, Name, string> {
  return {
    name,
    initial: (groupContext) => {
      if (formatter) {
        return formatter(groupContext);
      }
      return JSON.stringify(groupContext);
    },
    update: (acc, item, groupContext) => acc, // Just return the initial value, no need to update
    finalize: (acc, groupContext) => acc,
  };
}

/**
 * Example reducer that counts items but also knows which month/period it's aggregating for.
 * Useful for time-based aggregations where you need the time context.
 */
export function contextAwareCountReducer<Item, Name extends string>(
  name: Name,
  contextKey?: string,
): AggregationReducer<Item, { count: number; context: any }, Name, { count: number; context: any }> {
  return {
    name,
    initial: (groupContext) => ({
      count: 0,
      context: contextKey ? groupContext[contextKey] : groupContext,
    }),
    update: (acc, item, groupContext) => ({ ...acc, count: acc.count + 1 }),
    finalize: (acc, groupContext) => acc,
  };
}
