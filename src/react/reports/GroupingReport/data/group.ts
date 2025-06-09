/**
 * A generic grouping bucketing function and helpers.
 */

export type GroupByKey<T, V = any> = {
  key: string;
  value: (item: T) => V;
};

/**
 * Creates a GroupByKey object that extracts a value from a nested key path.
 * @param path Dot-notated path string like "address.city"
 */
export function keysGroupByKey<T>(path: string): GroupByKey<T, any> {
  return {
    key: path,
    value: (item: T) => {
      const segments = path.split('.');
      let value: any = item;
      for (const segment of segments) {
        if (value == null) break;
        value = value[segment];
      }
      return value === undefined ? null : value;
    },
  };
}

/**
 * Creates a stable string key from an object by sorting its entries and stringifying.
 * Useful for deduplicating group values that are objects.
 */
export function createStableObjectKey(obj: Record<string, any>): string {
  if (obj == null || typeof obj !== 'object') return String(obj);
  const sorted = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(sorted));
}

/**
 * Creates a stable string key from the result of multiple groupByKey objects.
 */
export function createGroupKeyFromGroupBys<T>(item: T, groupBys: GroupByKey<T, any>[]): string {
  const keyObj: Record<string, any> = {};
  for (const groupBy of groupBys) {
    keyObj[groupBy.key] = groupBy.value(item);
  }
  return createStableObjectKey(keyObj);
}

/**
 * Groups an array of items by one or more groupByKey objects.
 */
export function groupByKeys<T>(items: T[], groupBys: GroupByKey<T, any>[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = createGroupKeyFromGroupBys(item, groupBys);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(item);
  }
  return buckets;
}
