/**
 * Field-type registry for the Table report (spec/012-table-and-grouper, design §3).
 *
 * Keyed on a Jira field's `schema.type` (+ `schema.items` for arrays). Each entry supplies the
 * type-aware defaults a field column needs: `render`, `compare`, a `filter` descriptor, and a
 * default aggregation. Unknown types fall back to a plain string renderer. Also exports the
 * identity-column builders (issue key link, summary tree column, issue-type icon) needed to
 * reproduce the Estimation Table.
 *
 * Renderers use `React.createElement` rather than JSX so this stays a `.ts` file with no heavy UI.
 */
import { createElement } from 'react';

import { defaultAggregationForType } from './aggregations';

import type { ReactNode } from 'react';
import type { AggregationId } from './aggregations';
import type { ColumnDefinition, FilterDescriptor, RenderContext, TableIssue } from './columns';

/**
 * A registry entry: the type-driven behavior shared by all field columns of a given `schema.type`.
 * `getValue` is field-specific and supplied by {@link buildColumnCatalog}, so it is not part of the
 * entry.
 */
export interface FieldTypeEntry {
  render: (value: unknown, ctx: RenderContext) => ReactNode;
  compare: (a: unknown, b: unknown) => number;
  filter: FilterDescriptor;
  defaultAggregate: AggregationId;
}

function toTime(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** Sort nullish values last. Returns a comparison when either side is nullish, else `null`. */
function nullsLast(a: unknown, b: unknown): number | null {
  const aEmpty = a == null;
  const bEmpty = b == null;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return null;
}

const textEntry: FieldTypeEntry = {
  render: (value) => (value == null ? '' : String(value)),
  compare: (a, b) => nullsLast(a, b) ?? String(a).localeCompare(String(b)),
  filter: { kind: 'text' },
  defaultAggregate: defaultAggregationForType('string'),
};

const numberEntry: FieldTypeEntry = {
  render: (value) => (value == null ? '' : String(value)),
  compare: (a, b) => nullsLast(a, b) ?? Number(a) - Number(b),
  filter: { kind: 'number' },
  defaultAggregate: defaultAggregationForType('number'),
};

const dateEntry: FieldTypeEntry = {
  render: (value) => {
    const time = toTime(value);
    return time == null ? '' : new Date(time).toISOString().slice(0, 10);
  },
  compare: (a, b) => nullsLast(a, b) ?? (toTime(a) ?? 0) - (toTime(b) ?? 0),
  filter: { kind: 'date' },
  defaultAggregate: defaultAggregationForType('date'),
};

const registry: Record<string, FieldTypeEntry> = {
  string: textEntry,
  text: textEntry,
  number: numberEntry,
  date: dateEntry,
  datetime: dateEntry,
};

/**
 * Look up the registry entry for a Jira `schema.type` (+ `schema.items` for arrays), falling back
 * to the plain-string entry for unknown types.
 */
export function getFieldTypeEntry(schemaType: string, schemaItems?: string): FieldTypeEntry {
  const key = (schemaItems ?? schemaType ?? '').toLowerCase();
  return registry[key] ?? textEntry;
}

// --- Identity columns -------------------------------------------------------

/** The issue-type icon URL, read from the raw Jira `issue.fields['Issue Type'].iconUrl`. */
function issueTypeIconUrl(issue: TableIssue): string | undefined {
  const fields = issue.fields as Record<string, unknown> | undefined;
  const issueType = fields?.['Issue Type'] as { iconUrl?: string } | undefined;
  return issueType?.iconUrl;
}

/**
 * The summary rendered as a link that looks like plain body text at rest and reveals the link
 * affordance on hover/focus (design/tree-column-brainstorm §5). The `.table-summary-link` styling
 * lives in the report's scoped `TABLE_STYLES` block. Falls back to plain text when there's no url.
 */
function summaryLinkElement(value: string | undefined, issue: TableIssue): ReactNode {
  if (value == null || value === '') return '';
  const url = issue.url;
  return url
    ? createElement(
        'a',
        { href: url, target: '_blank', rel: 'noreferrer', className: 'table-summary-link' },
        value,
      )
    : value;
}

/** Issue key column — renders a link using `issue.url` (falling back to the key). Tree-capable. */
export function issueKeyColumn(): ColumnDefinition<string | undefined> {
  return {
    id: 'identity:key',
    label: 'Issue key',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'key', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    getValue: (issue) => issue.key,
    render: (value, ctx) => {
      if (value == null) return '';
      const url = ctx.issue.url;
      return url ? createElement('a', { href: url }, value) : value;
    },
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
}

/** Summary column — a tree-capable identity column; renders the summary as a hover-revealed link. */
export function summaryColumn(): ColumnDefinition<string | undefined> {
  return {
    id: 'identity:summary',
    label: 'Summary',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'summary', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    getValue: (issue) => issue.summary,
    render: (value, ctx) => summaryLinkElement(value, ctx.issue),
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
}

/**
 * Combined "Icon & Summary" column (design/tree-column-brainstorm §4): the issue-type icon + the
 * summary as a hover-revealed link, in one cell. Tree-capable, and the default first column. Sorts
 * on the summary text (getValue), so A→Z / Z→A behave like the bare Summary column.
 */
export function treeSummaryColumn(): ColumnDefinition<string | undefined> {
  return {
    id: 'identity:treeSummary',
    label: 'Icon & Summary',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'summary', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    getValue: (issue) => issue.summary,
    render: (value, ctx) => {
      const iconUrl = issueTypeIconUrl(ctx.issue);
      const icon = iconUrl
        ? createElement('img', {
            src: iconUrl,
            alt: 'Issue type',
            width: 16,
            height: 16,
            className: 'inline-block mr-1.5 align-text-bottom flex-none',
          })
        : null;
      // The summary text is wrapped in its own truncating flex item (rather than truncating the
      // whole cell) so the icon never gets clipped — only the overflowing summary text gets an
      // ellipsis, capped by the column's max-width (see [data-column-id="identity:treeSummary"] in
      // TableReport's TABLE_STYLES).
      return createElement(
        'span',
        { className: 'flex items-center min-w-0' },
        icon,
        createElement('span', { className: 'min-w-0 flex-1 truncate' }, summaryLinkElement(value, ctx.issue)),
      );
    },
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
}

/** Issue type column — renders the type icon via `issue.fields['Issue Type'].iconUrl`. */
export function issueTypeColumn(): ColumnDefinition<string | undefined> {
  return {
    id: 'identity:issueType',
    label: 'Issue type',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'Issue Type', schemaType: 'string' },
    isIdentity: true,
    getValue: (issue) => issueTypeIconUrl(issue),
    render: (value) =>
      value ? createElement('img', { src: value, alt: 'Issue type', width: 16, height: 16 }) : '',
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'select' },
  };
}
