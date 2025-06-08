import { groupByKeys } from './group';
import type { GroupingFunction } from './group';
import { aggregateGroup, AggregationReducer } from './aggregate';

type GroupFields<Fns extends readonly GroupingFunction<any, any, any>[]> = Fns extends readonly GroupingFunction<
  any,
  infer K,
  infer V
>[]
  ? { [Key in K]: V }
  : {};

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
 * @param items Array of objects to group and aggregate
 * @param groupFns Functions that extract grouping keys from each item
 * @param reducers Aggregation reducers to apply per group
 * @param flatten Whether to merge group keys into the output object (default: true)
 */
export function groupAndAggregate<
  T,
  Fns extends readonly GroupingFunction<T, any, any>[] = GroupingFunction<T, any, any>[],
  Reducers extends readonly AggregationReducer<T, any, any>[] = AggregationReducer<T, any, any>[],
  Flatten extends boolean = true,
>(
  items: T[],
  groupFns: Fns,
  reducers: Reducers,
  flatten?: Flatten,
): Array<
  Flatten extends true
    ? GroupFields<Fns> & AggregateFields<Reducers>
    : { group: GroupFields<Fns> } & AggregateFields<Reducers>
> {
  const grouped = groupByKeys(items, [...groupFns] as GroupingFunction<T, string, any>[]);
  const results: any[] = [];

  for (const [key, groupItems] of grouped.entries()) {
    const groupObj = JSON.parse(key);
    const group = Object.fromEntries(Object.entries(groupObj));

    const aggregates = aggregateGroup(groupItems, [...reducers] as AggregationReducer<T, any, string>[]);

    results.push((flatten ?? true) ? { ...group, ...aggregates } : { group, ...aggregates });
  }

  return results;
}
