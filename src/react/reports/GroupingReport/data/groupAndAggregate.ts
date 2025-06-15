import { groupByKeys } from './group';
import type { GroupByKey } from './group';
import { aggregateGroup, AggregationReducer, type AggregateGroupResult } from './aggregate';

// Refined GroupFields to correctly infer individual group value types
type GroupFields<GroupBys extends readonly GroupByKey<any, any, any>[]> = UnionToIntersection<
  {
    // Iterate over each GroupByKey in the tuple
    [Index in keyof GroupBys]: GroupBys[Index] extends GroupByKey<any, infer GroupValue, infer Key>
      ? Key extends string // Ensure Key is a string
        ? GroupValue extends any[] // Check if GroupValue is an array (for multi-group)
          ? { [K in Key]: GroupValue[number] } // If array, use element type
          : { [K in Key]: GroupValue } // Otherwise, use GroupValue directly
        : never
      : never;
  }[number] // Get the union of all generated { [K in Key]: GroupValueType } objects
>;

// Helper: Union to intersection type (already present, ensure it's used)
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type AggregateFields<Reducers extends readonly AggregationReducer<any, any, any>[]> =
  Reducers extends readonly AggregationReducer<any, any, any>[]
    ? {
        [R in Reducers[number] as R['name']]: R extends { finalize: (acc: any) => infer F }
          ? F
          : R extends { initial: () => infer I }
            ? I
            : never;
      }
    : {};

/**
 * Combines grouping and aggregation into one flat result per group.
 * The return type is now inferred from the groupBys and reducers arrays.
 */
export function groupAndAggregate<
  T,
  GroupBys extends readonly GroupByKey<T, any, any>[] = GroupByKey<T, any, any>[],
  Reducers extends readonly AggregationReducer<T, any, any>[] = AggregationReducer<T, any, any>[],
  Flatten extends boolean = true,
>(
  items: T[],
  groupBys: GroupBys,
  reducers: Reducers,
  flatten?: Flatten,
): Array<
  Flatten extends true
    ? GroupFields<GroupBys> & AggregateGroupResult<Reducers>
    : { group: GroupFields<GroupBys> } & AggregateGroupResult<Reducers>
> {
  const grouped = groupByKeys(items, [...groupBys] as GroupByKey<T, any, any>[]);
  const results: any[] = [];

  for (const [key, groupItems] of grouped.entries()) {
    const groupObj = JSON.parse(key);
    const group = Object.fromEntries(Object.entries(groupObj));

    // Use reducers as is, don't spread into an array
    const aggregates = aggregateGroup(groupItems, reducers);

    // Ensure both group and aggregates are objects before spreading
    if (flatten ?? true) {
      results.push({ ...(group as object), ...(aggregates as object) });
    } else {
      results.push({ group: group as object, ...(aggregates as object) });
    }
  }

  return results;
}
