/**
 * Builds the Table report's column catalog from the available Jira fields
 * (spec/012-table-and-grouper, Phase 0 / design §2).
 *
 * Phase 1 catalog = identity columns (issue key, summary/tree, issue type) + one field column per
 * Jira field (type-driven via {@link getFieldTypeEntry}) + the Estimation parity columns
 * (Estimated Days, Timed Days, Rolled Up Days). Legacy computed/custom aggregators are deferred to
 * Phase 8 — the {@link ColumnDefinition} shape accepts a {@link ComputedSource}, but none are
 * emitted here.
 */
import { createElement } from 'react';

import { defaultAggregationForType } from './aggregations';
import { getFieldTypeEntry, issueKeyColumn, issueTypeColumn, summaryColumn, treeSummaryColumn } from './fieldTypeRegistry';
import { resolveNormalizedFieldSource } from './normalizedFieldSources';
import { BUILTIN_CONCEPTS, CLAIMED_FIELD_IDS, REPORT_FIELD_FACETS } from './builtinFieldRegistry';
import { iconRender, labelsRender, statusRender } from './normalizedRenderers';
import { compareToLast } from './diffRender';

import type { ColumnDefinition, ColumnGroup, FilterDescriptor, RenderContext, TableIssue } from './columns';
import type { ReactNode } from 'react';
import type { BuiltinFacet } from './builtinFieldRegistry';

/** The `schema` slice we read off a Jira field (see `useJiraIssueFields`). */
interface FieldSchema {
  type?: string;
  items?: string;
}

interface JiraField {
  name: string;
  key: string;
  schema: FieldSchema | Record<string, string>;
  id: string;
  custom: boolean;
}

export type IssueFields = JiraField[];

function readSchema(schema: JiraField['schema']): FieldSchema {
  const s = schema as FieldSchema;
  return { type: s?.type, items: s?.items };
}

/** Round numeric values the way the Estimation Table does; pass everything else through as text. */
function roundIfNumber(value: unknown): string {
  return typeof value === 'number' ? String(Math.round(value)) : value == null ? '' : String(value);
}

/** One Jira field → one field column, deriving render/compare/filter/aggregate from its schema. */
function buildFieldColumn(field: JiraField): ColumnDefinition {
  const { type = 'string', items } = readSchema(field.schema);
  const entry = getFieldTypeEntry(type, items);

  // Prefer normalized, fall back to raw (issues-plan.md #4): object-valued/derived concepts like
  // Parent/Team/Project/Status read the flattened normalized property; everything else (and the
  // fallback when the normalized value is nullish) reads the raw Jira `issue.fields` map by name.
  const normalized = resolveNormalizedFieldSource(field);
  const rawGetValue = (issue: TableIssue) => issue.fields?.[field.name];
  const getValue = normalized
    ? (issue: TableIssue) => normalized.getValue(issue) ?? rawGetValue(issue)
    : rawGetValue;

  // The normalized source may know a more specific type than the raw schema (e.g. a custom Team
  // field typed as `string` in Jira but sourced from a normalized object) — let it override.
  const filter = normalized?.filter ?? entry.filter;
  const defaultAggregate =
    normalized?.defaultAggregate ?? defaultAggregationForType(type, items);

  return {
    id: `field:${field.key}`,
    label: field.name,
    group: 'Fields',
    source: { kind: 'field', fieldKey: field.key, schemaType: type, schemaItems: items },
    getValue,
    render: normalized?.render ?? entry.render,
    compare: entry.compare,
    filter,
    aggregate: defaultAggregate,
    defaultAggregate,
  };
}

/** Estimated Days — story-points median (or story points) days of work (see cells.ts). */
function estimatedDaysValue(issue: TableIssue): number | undefined {
  const timing = issue.derivedTiming as
    | {
        isStoryPointsMedianValid?: boolean;
        isStoryPointsValid?: boolean;
        deterministicTotalDaysOfWork?: number;
        storyPointsDaysOfWork?: number;
      }
    | undefined;
  if (timing?.isStoryPointsMedianValid) return timing.deterministicTotalDaysOfWork;
  if (timing?.isStoryPointsValid) return timing.storyPointsDaysOfWork;
  return undefined;
}

function timedDaysValue(issue: TableIssue): number | undefined {
  const timing = issue.derivedTiming as { datesDaysOfWork?: number } | undefined;
  return timing?.datesDaysOfWork || undefined;
}

function rolledUpDaysValue(issue: TableIssue): number | undefined {
  const rollup = issue.completionRollup as { totalWorkingDays?: number } | undefined;
  return rollup?.totalWorkingDays || undefined;
}

function buildEstimationColumn(
  id: string,
  label: string,
  getValue: (issue: TableIssue) => number | undefined,
  opensBreakdown = false,
): ColumnDefinition<number | undefined> {
  return {
    id: `estimation:${id}`,
    label,
    group: 'Estimation',
    source: { kind: 'computed', computedId: id },
    getValue,
    // Parity with the Estimation Table: render the "last ➡ current" diff (design §1/§4). The diff is
    // computed from the issue (and its `issueLastPeriod`) via the shared `compareToLast` helper — the
    // precomputed `value` argument is only used as the fallback text when no issue context exists.
    render: (value, ctx) => {
      if (!ctx?.issue) return roundIfNumber(value);
      const text = compareToLast(ctx.issue, getValue as (i: TableIssue) => unknown);
      // The Estimated Days cell opens the estimate-breakdown modal when the report supplies the
      // callback (hierarchy mode), matching the Estimation Table's clickable cell.
      if (opensBreakdown && ctx.onEstimateBreakdown) {
        const onClick = () => ctx.onEstimateBreakdown!(ctx.issue);
        return createElement('span', { className: 'cursor-pointer', role: 'button', onClick }, text);
      }
      return text;
    },
    compare: (a, b) => (a ?? 0) - (b ?? 0),
    filter: { kind: 'number' },
    aggregate: 'sum',
    defaultAggregate: 'sum',
  };
}

/**
 * Per-sourceId presentation overrides for built-in / report facets whose display needs more than the
 * type-registry default (icon `<img>`, coloured status Lozenge, label chips, select filters). Kept
 * here in the catalog (UI) layer per the spec's split — the registry stays render-free.
 */
interface FacetPresentation {
  render?: (value: unknown, ctx: RenderContext) => ReactNode;
  filter?: FilterDescriptor;
}
const FACET_PRESENTATION: Record<string, FacetPresentation> = {
  'builtin:issueType:icon': { render: iconRender, filter: { kind: 'select' } },
  'builtin:status:name': { render: statusRender, filter: { kind: 'select' } },
  'builtin:status:category': { filter: { kind: 'select' } },
  'builtin:labels:list': { render: labelsRender },
};

/**
 * Build a curated facet column (built-in Common facet, or a Report Field). The registry supplies the
 * data contract (`get`, and `requires` — used by route-data, not here); presentation is layered on
 * from the field-type registry keyed by the facet's `schemaType` (default `'string'`), with optional
 * per-sourceId overrides from {@link FACET_PRESENTATION}. `nominalFieldId` is the concept's claimed
 * field id (empty for Report Fields), used only as descriptive `source` metadata.
 */
function buildBuiltinColumn(facet: BuiltinFacet, group: ColumnGroup, nominalFieldId: string): ColumnDefinition {
  const type = facet.schemaType ?? 'string';
  const entry = getFieldTypeEntry(type);
  const presentation = FACET_PRESENTATION[facet.sourceId];
  return {
    id: facet.sourceId,
    label: facet.label,
    group,
    source: { kind: 'field', fieldKey: nominalFieldId || facet.sourceId, schemaType: type },
    getValue: (issue) => facet.get(issue),
    render: presentation?.render ?? entry.render,
    compare: entry.compare,
    filter: presentation?.filter ?? entry.filter,
    aggregate: entry.defaultAggregate,
    defaultAggregate: entry.defaultAggregate,
  };
}

/**
 * Build the full Phase 1 column catalog: identity columns, curated built-in facets, one column per
 * (unclaimed) Jira field, and the Estimation parity columns.
 */
export function buildColumnCatalog(fields: IssueFields): ColumnDefinition[] {
  const identity: ColumnDefinition<any>[] = [
    treeSummaryColumn(),
    issueKeyColumn(),
    summaryColumn(),
    issueTypeColumn(),
  ];

  // Loadable field ids (key + id, lowercased) — gates which built-in facets can be offered.
  const availableFieldIds = new Set<string>();
  for (const f of fields) {
    if (f.key) availableFieldIds.add(f.key.toLowerCase());
    if (f.id) availableFieldIds.add(f.id.toLowerCase());
  }

  // Curated built-in facets. A facet is offered when every id in its `requires` is loadable;
  // derived facets (`requires: []`, e.g. Project Key) are always offered.
  const builtin: ColumnDefinition<any>[] = [];
  for (const concept of BUILTIN_CONCEPTS) {
    const nominalFieldId = concept.claims[0] ?? '';
    for (const facet of concept.facets) {
      const loadable = facet.requires.every((id) => availableFieldIds.has(id.toLowerCase()));
      if (loadable) builtin.push(buildBuiltinColumn(facet, 'Common', nominalFieldId));
    }
  }

  // Report Fields — canonical per-issue values normalized from a user-configured field. Always
  // available (`requires: []`), so all are offered unconditionally.
  const reportFields: ColumnDefinition<any>[] = REPORT_FIELD_FACETS.map((facet) =>
    buildBuiltinColumn(facet, 'Report Fields', ''),
  );

  // Generic field columns MINUS any raw field a concept `claims` (set-difference), so users see the
  // curated facets instead of a bare duplicate (e.g. no raw "Project" alongside Project Key/Name).
  const fieldColumns: ColumnDefinition<any>[] = fields
    .filter((f) => {
      const key = f.key?.toLowerCase();
      const id = f.id?.toLowerCase();
      return !(key && CLAIMED_FIELD_IDS.has(key)) && !(id && CLAIMED_FIELD_IDS.has(id));
    })
    .map(buildFieldColumn);

  const estimation: ColumnDefinition<any>[] = [
    buildEstimationColumn('estimatedDays', 'Estimated Days', estimatedDaysValue, true),
    buildEstimationColumn('timedDays', 'Timed Days', timedDaysValue),
    buildEstimationColumn('rolledUpDays', 'Rolled Up Days', rolledUpDaysValue),
  ];

  return [...identity, ...builtin, ...reportFields, ...fieldColumns, ...estimation];
}

/**
 * The identity columns that support the Hierarchy / A→Z / Z→A sort modes (tree-capable). Choosing
 * Hierarchy on any of these nests the table and lands the indent + expand/collapse caret on that
 * column's cell (design/tree-column-brainstorm §4). Only one is the active tree column at a time —
 * whichever currently holds the hierarchy sort.
 */
export const TREE_CAPABLE_IDS: ReadonlySet<string> = new Set([
  'identity:treeSummary',
  'identity:summary',
  'identity:key',
]);
