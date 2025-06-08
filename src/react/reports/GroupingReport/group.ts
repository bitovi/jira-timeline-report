/**
 * A generic grouping bucketing function and helpers.
 */

export type GroupingFunction<T, K extends string = string, V = any> = (item: T) => { key: K; value: V };

/**
 * Creates a GroupingFunction that extracts a value from a nested key path.
 * @param path Dot-notated path string like "address.city"
 */
export function keysGroupingFunction<T>(path: string): GroupingFunction<T> {
  return (item: T) => {
    const segments = path.split('.');
    let value: any = item;

    for (const segment of segments) {
      if (value == null) break;
      value = value[segment];
    }

    return { key: path, value: value === undefined ? null : value };
  };
}

/**
 * Creates a stable string key from the result of multiple grouping functions.
 */
export function createGroupKeyFromFns<T>(item: T, groupFns: GroupingFunction<T>[]): string {
  const keyObj: Record<string, any> = {};

  for (const fn of groupFns) {
    const { key, value } = fn(item);
    keyObj[key] = value === undefined ? null : value;
  }
  const sortedKeyObj = Object.fromEntries(Object.entries(keyObj).sort(([a], [b]) => a.localeCompare(b)));

  return JSON.stringify(sortedKeyObj);
}

/**
 * Groups an array of items by one or more grouping functions.
 */
export function groupByKeys<T>(items: T[], groupFns: GroupingFunction<T>[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const key = createGroupKeyFromFns(item, groupFns);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(item);
  }

  return buckets;
}
