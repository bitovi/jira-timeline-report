import type { FieldSchema } from './resolveField';

/**
 * Renders one Jira field value as text, keyed on the field's `schema.type`. See
 * spec/016-report-of-reports/003-self-reports Phase 4.
 *
 * Deliberately *not* reusing `TableReport`'s `getFieldTypeEntry`: its `render(value, ctx)` requires a
 * `RenderContext` carrying a whole `TableIssue`, so an inline value would have to fabricate a fake
 * issue to borrow it. The type-switch approach is worth copying; the coupling isn't. Dates follow the
 * Table report's `YYYY-MM-DD` convention so the two agree on screen.
 *
 * Returns `''` for an empty value and **`null` when the value's shape can't be rendered as text** —
 * rich text (ADF) being the case that matters, since `String(adf)` would print `[object Object]`.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Jira wraps most non-scalars in an object with one of these labels. */
const LABEL_KEYS = ['displayName', 'name', 'value'] as const;

const labelOf = (value: Record<string, unknown>): string | null => {
  for (const key of LABEL_KEYS) {
    if (typeof value[key] === 'string') {
      return value[key] as string;
    }
  }

  return null;
};

const asDate = (value: unknown): string | null => {
  const time = typeof value === 'number' ? value : Date.parse(String(value));

  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
};

export const formatFieldValue = (value: unknown, schema: FieldSchema = {}): string | null => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (Array.isArray(value)) {
    // An array's members are described by `schema.items`, not `schema.type`.
    const parts = value.map((member) => formatFieldValue(member, { type: schema.items }));

    return parts.some((part) => part === null) ? null : parts.filter(Boolean).join(', ');
  }

  if (schema.type === 'date' || schema.type === 'datetime') {
    return asDate(value);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value)) {
    // An ADF document — `description`, comment bodies. Rendering it as text needs a walker; until then
    // saying so beats printing `[object Object]`.
    return value.type === 'doc' ? null : labelOf(value);
  }

  return null;
};
