/**
 * "Filter loaded issues" rules for the Sources panel (spec/042-sources-panel-filters).
 *
 * Same `field · operator · value[]` shape and semantics as `filter-rows.ts`, but these run on the
 * derived issues *before* rollup, so issues they remove never reach any report. Only fields that
 * exist on every derived issue are offered — rollup status doesn't exist yet at this stage.
 */
import type { FilterOperator } from './filter-rows';

export type SourceFilterField = 'status' | 'issueType' | 'labels';

export interface SourceFilterRow {
  id: string;
  field: SourceFilterField;
  operator: FilterOperator;
  value: string[];
}

/** The minimal derived-issue shape this module reads. */
export interface SourceFilterableIssue {
  status?: string;
  type?: string;
  labels?: string[];
}

function issueValues(issue: SourceFilterableIssue, field: SourceFilterField): string[] {
  switch (field) {
    case 'status':
      return issue.status != null ? [issue.status] : [];
    case 'issueType':
      return issue.type != null ? [issue.type] : [];
    case 'labels':
      return issue.labels ?? [];
  }
}

/**
 * A row with no selected values imposes no constraint (always matches). Otherwise "is" keeps an
 * issue with ANY of the selected values and "is not" keeps an issue with NONE of them — so an issue
 * with no labels passes a `labels · is not` row.
 */
export function matchesSourceFilterRow(issue: SourceFilterableIssue, row: SourceFilterRow): boolean {
  if (!row.value.length) {
    return true;
  }
  const anyMatch = issueValues(issue, row.field).some((value) => row.value.includes(value));
  return row.operator === 'is' ? anyMatch : !anyMatch;
}

/** Rows AND together; an empty `rows` array always matches (no filter active). */
export function matchesAllSourceFilterRows(issue: SourceFilterableIssue, rows: SourceFilterRow[]): boolean {
  return rows.every((row) => matchesSourceFilterRow(issue, row));
}
