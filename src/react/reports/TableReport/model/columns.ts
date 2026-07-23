/**
 * Core type definitions for the Table report's column model (spec/012-table-and-grouper, design §2).
 *
 * A column is `(source) + (aggregation)`: `source` is either a Jira field (type-driven via the
 * field-type registry) or a computed value; `aggregate` is only used when a cell spans multiple
 * issues (grouping, or a hierarchy parent rollup). This file holds type-only definitions — no
 * heavy UI is imported. `render` returns `React.ReactNode`; identity renderers use
 * `React.createElement` rather than JSX so this stays a `.ts` file.
 */
import type { ReactNode } from 'react';

import type { AggregationId } from './aggregations';

/**
 * The loose runtime shape of a rolled-up issue as the various reports consume it. Columns read a
 * narrow, type-specific slice, so this stays intentionally permissive (index signature) rather
 * than pinning every field.
 */
export interface TableIssue {
  key?: string;
  summary?: string;
  url?: string;
  fields?: Record<string, unknown>;
  [extra: string]: unknown;
}

/** Which catalog section a column belongs to (mockup README groupings). `Common` = curated built-in
 * facets of the always-loaded CORE fields; `Report Fields` = canonical per-issue values normalized
 * from a user-configured field. Both are surfaced near the top of the Add-column menu. */
export type ColumnGroup = 'Common' | 'Identity' | 'Fields' | 'Report Fields' | 'Computed';

/** The kinds of type-aware filter a column can expose (design §5). */
export type FilterKind = 'text' | 'number' | 'date' | 'select' | 'boolean';

/** Discriminated union describing the filter control a column contributes to its header menu. */
export type FilterDescriptor =
  | { kind: 'text' }
  | { kind: 'number' }
  | { kind: 'date' }
  | { kind: 'select'; options?: string[] }
  | { kind: 'boolean' };

/** Column sourced from a Jira field, keyed by `schema.type` (+ `schema.items` for arrays). */
export interface FieldSource {
  kind: 'field';
  fieldKey: string;
  schemaType: string;
  schemaItems?: string;
}

/** Column sourced from a computed/derived value (legacy aggregators; deferred to Phase 8). */
export interface ComputedSource {
  kind: 'computed';
  computedId: string;
}

/**
 * Context passed to a column's `render`. Kept minimal for Phase 0 — richer fields (expand state,
 * modal callbacks, etc.) are added as later phases need them.
 */
export interface RenderContext {
  issue: TableIssue;
  depth?: number;
  isGroupHeader?: boolean;
  allIssues?: TableIssue[];
  /**
   * Opens the estimate-breakdown modal for the given issue. Supplied by the report in every mode
   * (flat, hierarchy, and grouped member rows); the "Estimated Days" column wires its cell to this
   * when present.
   */
  onEstimateBreakdown?: (issue: TableIssue) => void;
  /**
   * Opens the percent-complete breakdown modal for the given issue. Supplied by the report in every
   * mode; the "Percent Complete" column wires its cell to this when present.
   */
  onPercentBreakdown?: (issue: TableIssue) => void;
}

/** Context passed to a column's `renderMeasure` override — see {@link ColumnDefinition.renderMeasure}. */
export interface RenderMeasureContext {
  /** The group's (1D) or cell's (2D cross-tab) contributing issues. */
  members: TableIssue[];
  /** Every issue in the current view, for renderers that need broader context. */
  allIssues?: TableIssue[];
}

/**
 * A single column in the Table report. `getValue` extracts a comparable/aggregatable value from an
 * issue; `render` turns that value into display output; `compare` drives type-aware sorting;
 * `filter` describes the header filter control; `aggregate` (defaulting to `defaultAggregate`) is
 * applied only when a cell spans multiple issues.
 */
export interface ColumnDefinition<Value = unknown> {
  id: string;
  label: string;
  group: ColumnGroup;
  source: FieldSource | ComputedSource;
  getValue: (issue: TableIssue) => Value;
  render: (value: Value, ctx: RenderContext) => ReactNode;
  compare: (a: Value, b: Value) => number;
  filter?: FilterDescriptor;
  aggregate?: AggregationId;
  defaultAggregate?: AggregationId;
  isIdentity?: boolean;
  isTree?: boolean;
  /**
   * Optional per-aggregation custom rendering for this column when used as a measure (1D
   * group-header cell / 2D cross-tab cell), keyed by aggregation id. Any aggregation id not present
   * here falls back to the generic `formatMeasureValue(computeMeasureValue(...))` path. This lets a
   * column give specific aggregation choices a richer rendering than a plain formatted value — e.g.
   * identity/tree columns render their "Distinct list" aggregation as clickable issue links (reusing
   * their own `render`) instead of a plain comma-joined string, while every other aggregation (e.g.
   * "Count") still falls back to the generic numeric rendering.
   */
  renderMeasure?: Partial<Record<AggregationId, (ctx: RenderMeasureContext) => ReactNode>>;
}

/**
 * Whether a column's raw (non-aggregated) values are numeric — i.e. its filter is `{ kind:
 * 'number' }`. True for real number fields and the computed Estimation columns (Estimated/Timed/
 * Rolled Up Days), which are quantitative day-count measures even though they render a "last ➡
 * current" diff string. Used to right-align numeric columns per the enterprise data-table
 * convention (quantitative numbers right-align; dates and text stay left).
 */
export function isNumericColumn(column: ColumnDefinition): boolean {
  return column.filter?.kind === 'number';
}
