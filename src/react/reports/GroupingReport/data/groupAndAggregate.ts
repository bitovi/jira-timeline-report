import { groupByKeys } from './group';
import type { GroupByKey } from './group';
import { aggregateGroup, AggregationReducer } from './aggregate';

type GroupFields<GroupBys extends readonly GroupByKey<any, any>[]> = GroupBys extends readonly GroupByKey<
  any,
  infer V
>[]
  ? { [K in GroupBys[number] as K['key']]: V }
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
 * @param groupBys Array of GroupByKey objects
 * @param reducers Aggregation reducers to apply per group
 * @param flatten Whether to merge group keys into the output object (default: true)
 */
export function groupAndAggregate<
  T,
  GroupBys extends readonly GroupByKey<T, any>[] = GroupByKey<T, any>[],
  Reducers extends readonly AggregationReducer<T, any, any>[] = AggregationReducer<T, any, any>[],
  Flatten extends boolean = true,
>(
  items: T[],
  groupBys: GroupBys,
  reducers: Reducers,
  flatten?: Flatten,
): Array<
  Flatten extends true
    ? GroupFields<GroupBys> & AggregateFields<Reducers>
    : { group: GroupFields<GroupBys> } & AggregateFields<Reducers>
> {
  const grouped = groupByKeys(items, [...groupBys] as GroupByKey<T, any>[]);
  const results: any[] = [];

  for (const [key, groupItems] of grouped.entries()) {
    const groupObj = JSON.parse(key);
    const group = Object.fromEntries(Object.entries(groupObj));

    const aggregates = aggregateGroup(groupItems, [...reducers] as AggregationReducer<T, any, string>[]);

    results.push((flatten ?? true) ? { ...group, ...aggregates } : { group, ...aggregates });
  }

  return results;
}
