export function mostCommonElement(arr) {
  const elementCounts = {};

  // Count the occurrences of each element in the array
  arr.forEach((element) => {
    if (elementCounts[element]) {
      elementCounts[element]++;
    } else {
      elementCounts[element] = 1;
    }
  });

  // Find the element with the highest count
  let mostCommon = null;
  let maxCount = 0;

  for (const element in elementCounts) {
    if (elementCounts[element] > maxCount) {
      maxCount = elementCounts[element];
      mostCommon = element;
    }
  }

  return mostCommon;
}
