export default function mapIdsToNames(obj, fields) {
    var mapped = {};
    for (var prop in obj) {
        mapped[fields.idMap[prop] || prop] = obj[prop];
    }
    return mapped;
}
