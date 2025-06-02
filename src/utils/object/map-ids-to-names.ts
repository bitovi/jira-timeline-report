type Fields = {
  idMap: Record<string, string>; // Maps field names to IDs
};

export default function mapIdsToNames(obj: { [key: string]: any }, fields: Fields) {
  const mapped: { [key: string]: any } = {};
  for (let prop in obj) {
    mapped[fields.idMap[prop] || prop] = obj[prop];
  }
  return mapped;
}
