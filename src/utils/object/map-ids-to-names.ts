type Fields = {
  idMap: Record<string, string>; // Maps field ids to names
  // ids of fields whose display name is shared by more than one field; see spec/015-field-selection.
  ambiguousFieldIds?: Set<string>;
};

export default function mapIdsToNames(obj: { [key: string]: any }, fields: Fields) {
  const mapped: { [key: string]: any } = {};
  for (let prop in obj) {
    // Keep the raw id key for name-colliding fields so two identically-named fields don't
    // overwrite each other under the single shared name key. See spec/015-field-selection.
    if (fields.ambiguousFieldIds?.has(prop)) {
      mapped[prop] = obj[prop];
    }
    mapped[fields.idMap[prop] || prop] = obj[prop];
  }
  return mapped;
}
