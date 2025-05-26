export function mostCommonElement<T>(arr: T[]): T | null {
  const elementCounts = new Map<T, number>();

  // Count the occurrences of each element
  for (const element of arr) {
    elementCounts.set(element, (elementCounts.get(element) || 0) + 1);
  }

  let mostCommon: T | null = null;
  let maxCount = 0;

  for (const [element, count] of elementCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = element;
    }
  }

  return mostCommon;
}

export function partition<T>(
  array: T[],
  filter: (item: T, index: number, array: T[]) => boolean,
  thisArg?: any
): { truthy: T[]; falsy: T[] } {
  const truthy: T[] = [];
  const falsy: T[] = [];

  array.forEach((item, i) => {
    if (filter.call(thisArg, item, i, array)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  });

  return { truthy, falsy };
}


export function indexByKey<T extends Record<string, any>, K extends keyof T>(
  items: T[],
  key: K
): Record<T[K], T> {
  const map: Record<string, T> = {};

  for (const item of items) {
    const mapKey = item[key];
    if (mapKey != null) {
      map[mapKey as string] = item;
    }
  }

  return map as Record<T[K], T>;
}


export function groupBy<T, K extends PropertyKey>(
  items: T[],
  keyGetter: (item: T) => K
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = keyGetter(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}


export function insertSortedArrayInPlace(sortedArr: number[], insertArr: number[]): void {
  // Sort the insert array first
  insertArr.sort((a, b) => a - b);

  for (const num of insertArr) {
      let left = 0;
      let right = sortedArr.length;

      // Binary search for correct insertion position using bitwise shift
      while (left < right) {
          const mid = (left + right) >> 1;
          if (sortedArr[mid] < num) {
              left = mid + 1;
          } else {
              right = mid;
          }
      }

      // Insert number at the correct position
      sortedArr.splice(left, 0, num);
  }
}


export function average(array: number[]) {
  let sum = 0;
  for (let i = 0; i < array.length; i++) {
    sum += array[i];
  }
  return sum / array.length;
}



export function mostCommonNumber(nums: number[]): number | null {
  const countMap = new Map<number, number>();
  let maxCount = 0;
  let mostCommon: number | null = null;

  for (const num of nums) {
      const count = (countMap.get(num) || 0) + 1;
      countMap.set(num, count);

      if (count > maxCount) {
          maxCount = count;
          mostCommon = num;
      }
  }

  return mostCommon;
}

export function last<T>(arr: Array<T>) {
  return arr[arr.length - 1];
}