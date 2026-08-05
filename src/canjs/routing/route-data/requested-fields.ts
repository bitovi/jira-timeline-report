/**
 * Canonicalize requested Jira field identifiers to stable field **ids** — spec/012
 * column-source-registry.md §6.
 *
 * The Table report's shown-column list contributes field ids (`field:<id>` → `id`), while the base
 * normalize config and `CORE_FIELDS` use display **names**. Names aren't unique (two fields can share
 * one) and don't compare equal to ids, so to decide whether a column change actually alters the SET
 * of requested fields we project everything into one space — ids — using the Jira name↔id maps
 * (`deriveFieldMaps`). Comparing the canonical sets (including the always-loaded `CORE_FIELDS`) lets
 * `allFieldsToRequest` skip re-emitting — and therefore skip refetching — when a column's field is
 * already loaded.
 */
export interface FieldMaps {
  /** display name → field id */
  nameMap: Record<string, string>;
  /** field id → display name */
  idMap: Record<string, string>;
  /** ids of fields whose display name is shared by more than one field; see spec/015-field-selection. */
  ambiguousFieldIds?: Set<string>;
}

/**
 * Canonicalize one name-or-id identifier to its stable Jira field id. A known display name maps to
 * its id; an identifier that's already an id (or is unknown) passes through unchanged. Without maps
 * (not yet loaded) the identifier is returned as-is.
 *
 * An **ambiguous** display name is the exception: it does not determine a field. `nameMap` only
 * pins it to the priority-order pick, so collapsing it would make "the name Start date" compare
 * equal to "the id of the first Start date" — and choosing that specific duplicate would look like
 * no change at all, so `allFieldsToRequest` would skip the refetch. Ambiguous names therefore stay
 * in name space, distinct from every id. See spec/015-field-selection.
 */
export function toFieldId(identifier: string, maps?: FieldMaps): string {
  if (!maps) return identifier;
  const mappedFromName = maps.nameMap[identifier];
  if (!mappedFromName) return identifier;
  if (maps.ambiguousFieldIds?.has(mappedFromName)) return identifier;
  return mappedFromName;
}

/** The set of canonical field ids implied by a list of name-or-id identifiers. */
export function canonicalFieldIdSet(identifiers: string[], maps?: FieldMaps): Set<string> {
  const set = new Set<string>();
  for (const identifier of identifiers) {
    if (typeof identifier === 'string' && identifier.length > 0) set.add(toFieldId(identifier, maps));
  }
  return set;
}

/** Set equality for two string sets. */
export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

/**
 * True when two requested-field lists resolve to the SAME canonical set of Jira field ids, once the
 * always-loaded `coreFields` are folded into both sides. When they match, the requested set hasn't
 * really changed (e.g. a Status column was added but Status is already core) so no refetch is needed.
 */
export function sameRequestedFields(a: string[], b: string[], coreFields: string[], maps?: FieldMaps): boolean {
  const canonicalA = canonicalFieldIdSet([...a, ...coreFields], maps);
  const canonicalB = canonicalFieldIdSet([...b, ...coreFields], maps);
  return setsEqual(canonicalA, canonicalB);
}
