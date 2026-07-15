/**
 * Generic, Jira-Plans-style filter row predicate.
 *
 * A `FilterRow` expresses `field · operator · value[]` (e.g. "Rollup Status · is any of ·
 * [Blocked, Warning]"). A row's `value` array ORs together (any selected value can match); rows
 * passed to {@link matchesAllFilterRows} AND together. This module is intentionally decoupled
 * from the full pipeline types — it only reads the small slice of shape it needs — so it stays
 * trivial to unit test with inline fixtures and can be shared by both the CanJS primary-issue
 * pipeline (`timeline-report.js`) and the TypeScript Work Breakdown pipeline (`buildBoard.ts`).
 */

/** "Jira Status" = the literal `issue.status`. "Rollup Status" = the app's computed status. */
export type FilterField = 'jiraStatus' | 'rollupStatus';

export type FilterOperator = 'is' | 'is not';

export interface FilterRow {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string[];
}

/** The three "Newly ..." values are read off booleans, not the `rollup.status` string. */
const NEWLY_VALUES = ['newlyStarted', 'newlyCompleted', 'newlyDated'] as const;
type NewlyValue = (typeof NEWLY_VALUES)[number];

function isNewlyValue(value: string): value is NewlyValue {
  return (NEWLY_VALUES as readonly string[]).includes(value);
}

/** The minimal issue/release shape this module reads. */
export interface FilterableIssueOrRelease {
  status?: string;
  /** Releases don't have their own status — they're matched via their children's statuses. */
  childStatuses?: { children?: { status: string }[] };
  rollupStatuses?: {
    rollup?: {
      status?: string;
      newlyStarted?: boolean;
      newlyCompleted?: boolean;
      newlyDated?: boolean;
    };
  };
}

function matchesJiraStatusRow(issue: FilterableIssueOrRelease, row: FilterRow): boolean {
  const children = issue.childStatuses?.children;

  // Releases don't have their own status, so we look at their children — mirroring the rule
  // `timeline-report.js` used before this generic filter existed:
  //  - "is" (was `statusesToShow`)   → keep if ANY child matches one of the selected values.
  //  - "is not" (was `statusesToRemove`) → keep unless EVERY child matches one of the selected
  //    values (i.e. only hide a release once none of its children are "shown").
  if (children && children.length) {
    if (row.operator === 'is') {
      return children.some((child) => row.value.includes(child.status));
    }
    return !children.every((child) => row.value.includes(child.status));
  }

  const included = issue.status != null && row.value.includes(issue.status);
  return row.operator === 'is' ? included : !included;
}

function matchesRollupStatusValue(issue: FilterableIssueOrRelease, value: string): boolean {
  const rollup = issue.rollupStatuses?.rollup;
  if (!rollup) {
    return false;
  }
  if (isNewlyValue(value)) {
    return rollup[value] === true;
  }
  return rollup.status === value;
}

function matchesRollupStatusRow(issue: FilterableIssueOrRelease, row: FilterRow): boolean {
  const anyMatch = row.value.some((value) => matchesRollupStatusValue(issue, value));
  return row.operator === 'is' ? anyMatch : !anyMatch;
}

/** A row with no selected values imposes no constraint (always matches). */
export function matchesFilterRow(issue: FilterableIssueOrRelease, row: FilterRow): boolean {
  if (!row.value.length) {
    return true;
  }
  return row.field === 'jiraStatus' ? matchesJiraStatusRow(issue, row) : matchesRollupStatusRow(issue, row);
}

/** Rows AND together; an empty `rows` array always matches (no filter active). */
export function matchesAllFilterRows(issue: FilterableIssueOrRelease, rows: FilterRow[]): boolean {
  return rows.every((row) => matchesFilterRow(issue, row));
}
