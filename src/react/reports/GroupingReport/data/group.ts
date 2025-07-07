/**
 * A generic grouping bucketing function and helpers.
 */

export type GroupByKey<Item, GroupValue = any, Key extends string = string> = {
  key: Key;
  value: (item: Item) => GroupValue | GroupValue[];
};

/**
 * Creates a GroupByKey object that extracts a value from a nested key path.
 * @param path Dot-notated path string like "address.city"
 */
export function keysGroupByKey<Item, Key extends string>(path: Key): GroupByKey<Item, any, Key> {
  return {
    key: path,
    value: (item: Item) => {
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
export function createStableObjectKey(obj: any): string {
  if (obj == null || typeof obj !== 'object') return String(obj);
  const sorted = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(sorted));
}

/**
 * Creates a stable string key from the result of multiple groupByKey objects.
 * Supports groupByKey.value returning a value or an array of values (multi-group).
 */
export function createGroupKeyFromGroupBys<Item>(
  item: Item,
  groupBys: readonly GroupByKey<Item, any, any>[],
): string[] {
  const keyObj: Record<string, any> = {};
  const valueArrays: any[][] = [];
  for (const groupBy of groupBys) {
    const value = groupBy.value(item);
    if (Array.isArray(value)) {
      valueArrays.push(value);
    } else {
      valueArrays.push([value]);
    }
  }
  // Cartesian product of all groupBy values
  const combinations = cartesianProduct(valueArrays);
  return combinations.map((combo) => {
    for (let i = 0; i < groupBys.length; i++) {
      keyObj[groupBys[i].key] = combo[i];
    }
    return createStableObjectKey({ ...keyObj });
  });
}

/**
 * Groups an array of items by one or more groupByKey objects.
 * Supports groupByKey.value returning a value or an array of values (multi-group).
 *
 * ```
 * const items = [{ id: 1, category: 'A' }, { id: 2, category: 'B' }, { id: 3, category: 'A' }];
 * const groupBys = [keysGroupByKey('category')];
 * const grouped = groupByKeys(items, groupBys);
 * // grouped will be a Map with keys 'A' and 'B', each containing an array of items in that category.
 * console.log(grouped.get('A')); // [{ id: 1, category: 'A' }, { id: 3, category: 'A' }]
 * ```
 */
export function groupByKeys<Item>(items: Item[], groupBys: readonly GroupByKey<Item, any, any>[]): Map<string, Item[]> {
  const buckets = new Map<string, Item[]>();
  for (const item of items) {
    const keys = createGroupKeyFromGroupBys(item, groupBys);
    for (const key of keys) {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(item);
    }
  }
  return buckets;
}

// Helper: Cartesian product of arrays
function cartesianProduct(arrays: any[][]): any[][] {
  return arrays.reduce((a, b) => a.flatMap((d: any) => b.map((e: any) => [...d, e])), [[]]);
}
