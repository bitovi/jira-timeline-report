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
import type { ColumnDefinition, FilterDescriptor, RenderContext, RenderMeasureContext, TableIssue } from './columns';

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
 * Cap on the rendered width of the Summary / Icon & Summary cell content, in pixels. `truncate`
 * (white-space:nowrap + text-overflow:ellipsis) only has something to clip against once there's an
 * actual bounded width — the surrounding `<td>`/table has none of its own (`table-layout: auto`, and
 * the scroll wrapper is deliberately `width: max-content` for the sticky-header trick, see the
 * TABLE_STYLES comment in TableReport.tsx), so without this the column just grows to fit the full
 * text in every view (flat, hierarchy, grouped) — only the 2D cross-tab's frozen label column had a
 * real width cap (`FROZEN_COL1_W`). Setting the max-width directly on this element (rather than on
 * the `<td>`, which depends on column position/view) makes truncation work everywhere it's used —
 * including ungrouped (0D) flat/hierarchy views.
 */
const SUMMARY_MAX_WIDTH = 420;

/**
 * The summary rendered as a link that looks like plain body text at rest and reveals the link
 * affordance on hover/focus (design/tree-column-brainstorm §5). The `.table-summary-link` styling
 * lives in the report's scoped `TABLE_STYLES` block. Falls back to plain text when there's no url.
 */
function summaryLinkElement(value: string | undefined, issue: TableIssue): ReactNode {
  if (value == null || value === '') return '';
  const url = issue.url;
  // Truncates to one line with an ellipsis when it doesn't fit — `min-w-0` lets it shrink inside
  // its `flex` row parent (see summaryColumn/treeSummaryColumn render below), and `maxWidth` gives
  // it an actual bound to shrink against (see SUMMARY_MAX_WIDTH doc). `title` restores the full
  // text on hover.
  const className = 'truncate min-w-0';
  const style = { maxWidth: SUMMARY_MAX_WIDTH };
  return url
    ? createElement(
        'a',
        {
          href: url,
          target: '_blank',
          rel: 'noreferrer',
          className: `table-summary-link ${className}`,
          style,
          title: value,
        },
        value,
      )
    : createElement('span', { className, style, title: value }, value);
}

/**
 * Shared `renderMeasure.distinct` for identity/tree columns: one entry per distinct value (keeping
 * one representative issue per value), rendered via the column's own `render` — so each entry is a
 * link (the hover-reveal summary link, or the key link) — separated by ", ", instead of the generic
 * plain comma-joined `formatMeasureValue` every other measure gets.
 */
function renderIdentityDistinctList(
  column: ColumnDefinition<string | undefined>,
  ctx: RenderMeasureContext,
): ReactNode {
  const seen = new Map<string, { value: string | undefined; issue: TableIssue }>();
  for (const issue of ctx.members) {
    const raw = column.getValue(issue);
    if (raw == null || raw === '') continue;
    const key = String(raw);
    if (!seen.has(key)) seen.set(key, { value: raw, issue });
  }
  const entries = [...seen.values()].sort((a, b) => String(a.value).localeCompare(String(b.value)));
  // A single distinct value renders inline exactly like an ungrouped cell (no extra wrapper). Two
  // or more render as a stacked block list — one truncated entry per line — instead of one
  // comma-joined paragraph, so multiple icon+summary pairs don't blur together.
  if (entries.length <= 1) {
    const entry = entries[0];
    return entry ? column.render(entry.value, { issue: entry.issue, isGroupHeader: true }) : '';
  }
  return createElement(
    'div',
    { className: 'flex flex-col gap-1 min-w-0' },
    entries.map((entry) =>
      createElement(
        'div',
        { key: entry.issue.key ?? String(entry.value), className: 'min-w-0' },
        column.render(entry.value, { issue: entry.issue, isGroupHeader: true }),
      ),
    ),
  );
}

/** Issue key column — renders a link using `issue.url` (falling back to the key). Tree-capable. */
export function issueKeyColumn(): ColumnDefinition<string | undefined> {
  const column: ColumnDefinition<string | undefined> = {
    id: 'identity:key',
    label: 'Issue key',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'key', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    // When aggregated across a group/cell (e.g. as a 2D cross-tab fallback measure), list the
    // distinct keys rather than counting them (matches the 1D grouped identity-list behavior).
    defaultAggregate: 'distinct',
    getValue: (issue) => issue.key,
    render: (value, ctx) => {
      if (value == null) return '';
      const url = ctx.issue.url;
      return url ? createElement('a', { href: url }, value) : value;
    },
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
  column.renderMeasure = { distinct: (ctx) => renderIdentityDistinctList(column, ctx) };
  return column;
}

/** Summary column — a tree-capable identity column; renders the summary as a hover-revealed link. */
export function summaryColumn(): ColumnDefinition<string | undefined> {
  const column: ColumnDefinition<string | undefined> = {
    id: 'identity:summary',
    label: 'Summary',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'summary', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    defaultAggregate: 'distinct',
    getValue: (issue) => issue.summary,
    render: (value, ctx) => createElement('span', { className: 'flex min-w-0' }, summaryLinkElement(value, ctx.issue)),
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
  column.renderMeasure = { distinct: (ctx) => renderIdentityDistinctList(column, ctx) };
  return column;
}

/**
 * Combined "Icon & Summary" column (design/tree-column-brainstorm §4): the issue-type icon + the
 * summary as a hover-revealed link, in one cell. Tree-capable, and the default first column. Sorts
 * on the summary text (getValue), so A→Z / Z→A behave like the bare Summary column.
 */
export function treeSummaryColumn(): ColumnDefinition<string | undefined> {
  const column: ColumnDefinition<string | undefined> = {
    id: 'identity:treeSummary',
    label: 'Icon & Summary',
    group: 'Identity',
    source: { kind: 'field', fieldKey: 'summary', schemaType: 'string' },
    isIdentity: true,
    isTree: true,
    defaultAggregate: 'distinct',
    getValue: (issue) => issue.summary,
    render: (value, ctx) => {
      const iconUrl = issueTypeIconUrl(ctx.issue);
      // A real `flex` row (not `inline-flex`) so the row fills the cell's actual width, giving the
      // summary's `min-w-0`/`truncate` something concrete to shrink against. The icon is `flex-none`
      // so it never shrinks; the summary is the flexible, truncating sibling.
      const icon = iconUrl
        ? createElement('img', {
            src: iconUrl,
            alt: 'Issue type',
            width: 16,
            height: 16,
            className: 'mr-1.5 flex-none',
          })
        : null;
      return createElement(
        'span',
        { className: 'flex items-center min-w-0' },
        icon,
        summaryLinkElement(value, ctx.issue),
      );
    },
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'text' },
  };
  column.renderMeasure = { distinct: (ctx) => renderIdentityDistinctList(column, ctx) };
  return column;
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
    render: (value) => (value ? createElement('img', { src: value, alt: 'Issue type', width: 16, height: 16 }) : ''),
    compare: (a, b) => textEntry.compare(a, b),
    filter: { kind: 'select' },
  };
}
