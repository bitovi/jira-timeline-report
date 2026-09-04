/**
 * Resolves an expression's accessor to a Jira field. See
 * spec/016-report-of-reports/003-self-reports Phase 2.
 *
 * `.summary` is a field **id**; `.Story points` is a **display name**; `.Story Points` may be a JQL
 * clause name. All three are things a user would reasonably type, so all three resolve — in that
 * order, so an id always wins over a name that happens to match it.
 */

export interface FieldSchema {
  type?: string;
  items?: string;
  /** Jira's field-type identifier, e.g. `...customfieldtypes:textarea` — the only signal that tells a
   * wiki-markup-rendered paragraph field apart from a plain text field, since both report `type: "string"`.
   * See `formatFieldValue.ts`'s `classifyFieldValue`. */
  custom?: string;
}

/** The slice of a Jira field this needs — compatible with `useJiraIssueFields()`' entries. */
export interface JiraFieldLike {
  id: string;
  name: string;
  schema?: FieldSchema | Record<string, string>;
  clauseNames?: string[];
}

export interface ResolvedField {
  id: string;
  name: string;
  schema: FieldSchema;
}

export interface FieldError {
  /** User-facing: this renders in the document where the value would have been. */
  error: string;
}

export type FieldResult = ResolvedField | FieldError;

export const isFieldError = (result: FieldResult): result is FieldError => 'error' in result;

const resolved = (field: JiraFieldLike): ResolvedField => {
  const schema = (field.schema ?? {}) as FieldSchema;

  return { id: field.id, name: field.name, schema: { type: schema.type, items: schema.items, custom: schema.custom } };
};

/**
 * Two fields sharing a display name is a real situation in Jira, not a hypothetical — see
 * spec/015-field-selection, where silently picking one was explicitly rejected. Name the candidates
 * and let the user disambiguate with an id.
 */
const ambiguous = (accessor: string, candidates: JiraFieldLike[]): FieldError => ({
  error: `${candidates.length} fields are named "${accessor}" (${candidates
    .map((field) => field.id)
    .join(', ')}). Use the field id instead.`,
});

export const resolveField = (accessor: string, fields: JiraFieldLike[]): FieldResult => {
  const wanted = accessor.trim();

  if (!wanted) {
    return { error: 'No field named.' };
  }

  // Ids are unique, so an id match can never be ambiguous.
  const byId = fields.find((field) => field.id === wanted);

  if (byId) {
    return resolved(byId);
  }

  const lowered = wanted.toLowerCase();
  const candidateSets = [
    fields.filter((field) => field.name === wanted),
    fields.filter((field) => field.name.toLowerCase() === lowered),
    fields.filter((field) => field.clauseNames?.some((clause) => clause.toLowerCase() === lowered)),
  ];

  for (const candidates of candidateSets) {
    if (candidates.length === 1) {
      return resolved(candidates[0]);
    }

    if (candidates.length > 1) {
      // Distinct ids only: `clauseNames` can list several aliases of the same field, which is not a
      // collision — two *different* fields sharing a name is.
      const distinct = candidates.filter((field, at) => candidates.findIndex((other) => other.id === field.id) === at);

      return distinct.length === 1 ? resolved(distinct[0]) : ambiguous(wanted, distinct);
    }
  }

  return { error: `No Jira field named "${wanted}".` };
};
