export function mostCommonElement(arr) {
    var elementCounts = {};
    // Count the occurrences of each element in the array
    arr.forEach(function (element) {
        if (elementCounts[element]) {
            elementCounts[element]++;
        }
        else {
            elementCounts[element] = 1;
        }
    });
    // Find the element with the highest count
    var mostCommon = null;
    var maxCount = 0;
    for (var element in elementCounts) {
        if (elementCounts[element] > maxCount) {
            maxCount = elementCounts[element];
            mostCommon = element;
        }
    }
    return mostCommon;
}
