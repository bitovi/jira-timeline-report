import type { FieldSchema } from './resolveField';

/**
 * Classifies one Jira field value into what it takes to display it, keyed on the field's `schema`. See
 * spec/016-report-of-reports/003-self-reports Phase 4 and spec/030-inline-custom-field-report.
 *
 * Deliberately *not* reusing `TableReport`'s `getFieldTypeEntry`: its `render(value, ctx)` requires a
 * `RenderContext` carrying a whole `TableIssue`, so an inline value would have to fabricate a fake
 * issue to borrow it. The type-switch approach is worth copying; the coupling isn't. Dates follow the
 * Table report's `YYYY-MM-DD` convention so the two agree on screen.
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

/**
 * Jira's `schema.custom` identifier for the "Paragraph" custom-field type — the classic wiki-markup
 * field, e.g. the "Status Update" field (`customfield_10844`) the bug report was filed against. Jira's
 * `/api/3/field` catalog reports `schema.type: "string"` for this exactly as it does for a plain
 * single-line text field, so `custom` is the only signal that tells the two apart.
 */
const WIKI_MARKUP_CUSTOM_SUFFIX = ':textarea';

export type FieldValueDisplay =
  | { kind: 'empty' }
  | { kind: 'text'; text: string }
  | { kind: 'adf'; document: unknown }
  | { kind: 'wiki'; markup: string }
  | { kind: 'unsupported'; schemaType?: string };

/**
 * Classifies a field value into what it takes to render it. Text stays text (unchanged from before this
 * existed); rich content — an ADF document, or a wiki-markup string — gets its own kind instead of the
 * flat `null` "can't render" `formatFieldValue` used to return for both, so `InlineValue` can tell them
 * apart and render each as real rich text instead of an error.
 */
export const classifyFieldValue = (value: unknown, schema: FieldSchema = {}): FieldValueDisplay => {
  if (value === null || value === undefined || value === '') {
    return { kind: 'empty' };
  }

  if (Array.isArray(value)) {
    // An array's members are described by `schema.items`, not `schema.type` — and, in practice, never
    // rich text: Jira never puts an ADF document or a wiki-markup field inside an array. Unchanged from
    // before this existed: a text-or-nothing join, `unsupported` if any member can't render as text.
    const parts = value.map((member) => classifyFieldValue(member, { type: schema.items }));

    if (parts.some((part) => part.kind !== 'text' && part.kind !== 'empty')) {
      return { kind: 'unsupported', schemaType: schema.type };
    }

    const text = parts
      .map((part) => (part.kind === 'text' ? part.text : ''))
      .filter(Boolean)
      .join(', ');

    return { kind: 'text', text };
  }

  if (schema.type === 'date' || schema.type === 'datetime') {
    const date = asDate(value);

    return date === null ? { kind: 'unsupported', schemaType: schema.type } : { kind: 'text', text: date };
  }

  if (typeof value === 'string') {
    if (schema.custom?.endsWith(WIKI_MARKUP_CUSTOM_SUFFIX)) {
      return { kind: 'wiki', markup: value };
    }

    return { kind: 'text', text: value };
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'text', text: String(value) };
  }

  if (isRecord(value)) {
    if (value.type === 'doc') {
      // An ADF document — `description`, comment bodies, and any other rich-text field. Rendered
      // through `AdfDocument`, the same renderer comment/status-update bodies already use.
      return { kind: 'adf', document: value };
    }

    const label = labelOf(value);

    return label === null ? { kind: 'unsupported', schemaType: schema.type } : { kind: 'text', text: label };
  }

  return { kind: 'unsupported', schemaType: schema.type };
};

/**
 * Renders one Jira field value as text. Returns `''` for an empty value and **`null` when the value's
 * shape can't be rendered as text** — rich content (ADF, wiki markup) included, since `String(adf)`
 * would print `[object Object]` and wiki markup shown raw would print `h1. heading` syntax instead of a
 * heading. `InlineValue` renders those through `classifyFieldValue` instead; this stays for whatever
 * else only ever wanted text.
 */
export const formatFieldValue = (value: unknown, schema: FieldSchema = {}): string | null => {
  const display = classifyFieldValue(value, schema);

  return display.kind === 'empty' ? '' : display.kind === 'text' ? display.text : null;
};
