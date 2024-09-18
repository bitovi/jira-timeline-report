export default function chunkArray(array, size) {
    var chunkedArr = [];
    for (var i = 0; i < array.length; i += size) {
        chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
}
//# sourceMappingURL=chunk-array.js.map