/**
 * The field dropdown in the Add Report modal's Work Item Value half, and the expression a pick becomes.
 *
 * Built from Jira's field catalog — the same one `resolveField` resolves against — plus the derived
 * entries, which are not Jira fields at all. Deliberately **not** `buildColumnCatalog`: Table's `Computed` and
 * `Report Fields` columns read `derivedTiming` and normalized rollup values off a `TableIssue`, and an
 * inline value is a raw Jira search response, so offering them here would offer picks that resolve and
 * then render nothing.
 *
 * Pure and Jira-free, so it unit-tests against a two-entry array.
 * See spec/016-report-of-reports/009-value-report-modal Phase 3.
 */

import type { JiraFieldLike } from './resolveField';

import { LATEST_COMMENT_ACCESSOR /* , STATUS_UPDATE_ACCESSOR */ } from './accessors';

export type FieldGroup = 'Derived' | 'Common' | 'Fields';

export interface FieldOption {
  id: string;
  label: string;
  group: FieldGroup;
}

/** Groups render in this order; `Derived` first so `Latest Comment` heads an unfiltered list. */
export const FIELD_GROUP_ORDER: FieldGroup[] = ['Derived', 'Common', 'Fields'];

/**
 * The picks that aren't Jira fields, in the order they're offered.
 *
 * Latest Comment stays first: it heads an unfiltered list, and it is the older and more general of the
 * two. Status Update is a sibling preset, not a replacement — the question it answers ("is there one
 * *this week*?") is narrower, so it sits second.
 * See spec/027-status-updates § The accessor and the dropdown.
 *
 * **Status Update temporarily withdrawn from this list** — its label collides with the real "Status
 * Update" custom field now offered under `Fields` (same display name, distinguished only by the group
 * header), which was confusing enough post-spec/030-inline-custom-field-report to pull it here
 * for now rather than rename either. The accessor, `StatusUpdateView`, and `useStatusUpdate` are all
 * untouched — an already-saved `.statusUpdate` node keeps rendering exactly as before; only *picking it
 * new* from this dropdown is disabled. Restore by uncommenting the entry below.
 */
const DERIVED_OPTIONS: FieldOption[] = [
  { id: LATEST_COMMENT_ACCESSOR, label: 'Latest Comment', group: 'Derived' },
  // { id: STATUS_UPDATE_ACCESSOR, label: 'Status Update', group: 'Derived' },
];

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
    ...DERIVED_OPTIONS,
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
 * The expression a work item + field pick stores.
 *
 * **Always the field id, never the display name.** Two Jira fields can share a name — `resolveField`
 * refuses such an accessor outright — so a name would let a pick that was never ambiguous store as an
 * error. Nothing displays the expression any more (the node is read-only, see 009's § The node stops
 * being editable), so the id's unreadability costs nothing and its uniqueness is pure gain.
 *
 * **The derived ids need no special case, and never did.** This used to route `latestComment` through
 * `latestCommentExpression`, which produced character-for-character what this line already produces for
 * that id. A second preset made the dead branch obvious, so it went rather than doubling.
 * See spec/027-status-updates § The accessor and the dropdown.
 */
export const buildValueExpression = (issueKey: string, fieldId: string): string =>
  `(issue = ${issueKey.trim()}).${fieldId}`;
