export default function mapIdsToNames(obj, fields) {
  const mapped = {};
  for (let prop in obj) {
    mapped[fields.idMap[prop] || prop] = obj[prop];
  }
  return mapped;
}