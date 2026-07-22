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
export type ColumnGroup = 'Common' | 'Identity' | 'Fields' | 'Report Fields' | 'Estimation' | 'Computed';

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
   * Opens the estimate-breakdown modal for the given issue. Supplied by the report only in hierarchy
   * mode (Phase 2); the "Estimated Days" column wires its cell to this when present.
   */
  onEstimateBreakdown?: (issue: TableIssue) => void;
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
}
