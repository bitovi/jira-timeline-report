export function unique<TItem>(list: TItem[], uniqueBy: (item: TItem) => string) {
  const result: { [key: string]: TItem } = {};
  for (const item of list) {
    const itemKey = uniqueBy(item);
    if (!result[itemKey]) result[itemKey] = item;
  }
  return Object.values(result);
}

export function uniqueKeys<TItem extends { key: string }>(list: TItem[]) {
  return unique(list, ({ key }) => key);
}

export function uniqueIds<TItem extends { id: string }>(list: TItem[]) {
  return unique(list, ({ id }) => id);
}
