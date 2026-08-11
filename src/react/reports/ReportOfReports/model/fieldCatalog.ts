/**
 * The field dropdown in the Add Report modal's Work Item Value half, and the expression a pick becomes.
 *
 * Built from Jira's field catalog — the same one `resolveField` resolves against — plus one derived
 * entry for `latestComment`. Deliberately **not** `buildColumnCatalog`: Table's `Computed` and
 * `Report Fields` columns read `derivedTiming` and normalized rollup values off a `TableIssue`, and an
 * inline value is a raw Jira search response, so offering them here would offer picks that resolve and
 * then render nothing.
 *
 * Pure and Jira-free, so it unit-tests against a two-entry array.
 * See spec/016-report-of-reports/009-value-report-modal Phase 3.
 */

import type { JiraFieldLike } from './resolveField';

import { LATEST_COMMENT_ACCESSOR, latestCommentExpression } from './accessors';

export type FieldGroup = 'Derived' | 'Common' | 'Fields';

export interface FieldOption {
  id: string;
  label: string;
  group: FieldGroup;
}

/** Groups render in this order; `Derived` first so `Latest Comment` heads an unfiltered list. */
export const FIELD_GROUP_ORDER: FieldGroup[] = ['Derived', 'Common', 'Fields'];

/**
 * Field **ids** a raw search returns directly and that people actually want to quote.
 *
 * A local constant rather than Table's `BUILTIN_CONCEPTS`: those facets are
 * `get: (issue: TableIssue) => …` readers over rolled-up issues and have no meaning against a search
 * response. Promotion only — every id here also exists in the catalog, and one that doesn't simply
 * doesn't appear.
 */
const COMMON_FIELD_IDS = ['summary', 'status', 'assignee', 'reporter', 'priority', 'issuetype', 'duedate', 'labels'];

export const buildFieldOptions = (fields: JiraFieldLike[]): FieldOption[] => {
  const common = new Set(COMMON_FIELD_IDS);

  return [
    { id: LATEST_COMMENT_ACCESSOR, label: 'Latest Comment', group: 'Derived' as const },
    // `COMMON_FIELD_IDS` order, not catalog order: the curated list is curated in its useful order.
    ...COMMON_FIELD_IDS.flatMap((id) => {
      const field = fields.find((candidate) => candidate.id === id);

      return field ? [{ id: field.id, label: field.name, group: 'Common' as const }] : [];
    }),
    // `useJiraIssueFields` already returns these name-sorted.
    ...fields
      .filter((field) => !common.has(field.id))
      .map((field) => ({ id: field.id, label: field.name, group: 'Fields' as const })),
  ];
};

/**
 * The expression a work item + field pick stores. The one place that knows `latestComment` is special.
 *
 * **Always the field id, never the display name.** Two Jira fields can share a name — `resolveField`
 * refuses such an accessor outright — so a name would let a pick that was never ambiguous store as an
 * error. Nothing displays the expression any more (the node is read-only, see the plan's § The node
 * stops being editable), so the id's unreadability costs nothing and its uniqueness is pure gain.
 */
export const buildValueExpression = (issueKey: string, fieldId: string): string =>
  fieldId === LATEST_COMMENT_ACCESSOR ? latestCommentExpression(issueKey) : `(issue = ${issueKey.trim()}).${fieldId}`;
