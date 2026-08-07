/**
 * The one place a raw Jira field value becomes display text for the Table report.
 *
 * Many Jira fields are object-valued: `Assignee` is `{ displayName, accountId, avatarUrls, … }`,
 * `Priority` is `{ name, iconUrl, id }`, `Resolution`/`Component`/single-select customfields are
 * `{ name }` or `{ value }`. Only a handful of these concepts have a curated column
 * (`builtinFieldRegistry`) or a normalized accessor (`normalizedFieldSources`); every other field
 * goes through the generic `field:<key>` column, which reads the raw object straight out of
 * `issue.fields`. Anything that then did `String(value)` on it printed `[object Object]` — in the
 * cell, and equally in the sort comparator, group header, distinct list and filter predicates.
 *
 * So value→text lives here and is called from all of them, rather than each site re-deciding.
 *
 * Mirrors `ReportOfReports/model/formatFieldValue.ts`, which solved the same problem for inline
 * values. They stay separate deliberately: that one is schema-driven (it needs `schema.items` to
 * format array members and `schema.type` to spot dates) and returns `null` for "can't render this",
 * whereas a table cell has already had its type dispatched by the field-type registry and needs a
 * plain string. Sharing one function would mean giving each caller the other's concerns.
 */

/** Jira labels an object-valued field with one of these keys, in this order of preference. */
const LABEL_KEYS = ['displayName', 'name', 'value'] as const;

/** Is this a plain object (not an array, not null) that might carry a label key? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The display text for a raw Jira field value:
 *   - scalars pass through as-is
 *   - object-valued fields yield their label (`displayName` → `name` → `value`)
 *   - arrays (multi-select, components, multi-user pickers) join their members with ", "
 *   - anything unlabellable — an ADF rich-text document, an unrecognized shape — yields `''`
 *
 * The empty string is deliberate for that last case: a blank cell is honest about having nothing to
 * show, where `[object Object]` is noise that also poisons sorting, grouping and filtering. (Rich
 * text would need an ADF walker to render properly; that's a separate feature, not a fallback.)
 */
export function fieldValueText(value: unknown): string {
  if (value == null || value === '') return '';

  // Dates are objects too — format before the record branch swallows them.
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (Array.isArray(value)) {
    return value
      .map(fieldValueText)
      .filter((part) => part !== '')
      .join(', ');
  }

  if (isRecord(value)) {
    if (value.type === 'doc') return ''; // An ADF document (description, comment body).
    for (const key of LABEL_KEYS) {
      const label = value[key];
      if (typeof label === 'string' || typeof label === 'number') return String(label);
    }
    return '';
  }

  return String(value);
}
