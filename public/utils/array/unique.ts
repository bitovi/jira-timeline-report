export function unique<TItem, TKey extends string | number | symbol>(
  list: TItem[],
  uniqueBy: (item: TItem) => TKey
) {
  const result = new Map<TKey, TItem>();
  for (const item of list) {
    const itemKey = uniqueBy(item);
    if (!result.has(itemKey)) result.set(itemKey, item);
  }
  return [...result.values()];
}

export function uniqueKeys<TItem extends { key: string }>(list: TItem[]) {
  return unique(list, ({ key }) => key);
}

export function uniqueIds<TId extends string | number | symbol, TItem extends { id: TId }>(
  list: TItem[]
) {
  return unique(list, ({ id }) => id);
}
