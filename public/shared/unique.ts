export function unique<TItem, TKey>(list: TItem[], uniqueBy: (list: TItem) => TKey) {
  return list.filter((item, i, listInner) => {
    const itemKey = uniqueBy(item);
    return listInner.findIndex((itemInner) => uniqueBy(itemInner) === itemKey) === i;
  });
}

export function uniqueKeys<TItem extends { key: string }>(list: TItem[]) {
  return unique(list, ({ key }) => key);
}

export function uniqueIds<TId, TItem extends { id: TId }>(list: TItem[]) {
  return unique(list, ({ id }) => id);
}
