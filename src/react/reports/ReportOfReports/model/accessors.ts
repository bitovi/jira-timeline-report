/**
 * Accessors that aren't Jira fields.
 *
 * An inline value is `(jql).accessor`, and the accessor is normally the `fields` argument of the
 * search — `resolveField` looks it up in `/api/3/field`. `latestComment` is the exception: "the newest
 * of an array, then three of its sub-properties" is not a field, so it can't resolve, and it is
 * fetched from a different endpoint entirely.
 *
 * It lives here rather than in `resolveField` deliberately: that function's contract stays "accessor →
 * a real Jira field", which is what makes its ambiguity handling meaningful.
 *
 * See spec/016-report-of-reports/007-latest-comment-report Phase 1.
 */

import { parseExpression, isExpressionError } from './expression';

export type DerivedAccessor = {
  kind: 'latest-comment';
  /** The muted label shown on the row in place of a field name. */
  label: string;
};

/** The canonical spelling — what the Add button writes, and what error copy should suggest. */
export const LATEST_COMMENT_ACCESSOR = 'latestComment';

// Keyed lower-case and matched case-insensitively, the way `resolveField` matches display names: a
// user who types `.latestcomment` meant the same thing.
const DERIVED: Record<string, DerivedAccessor> = {
  latestcomment: { kind: 'latest-comment', label: 'Latest comment' },
};

export const derivedAccessor = (accessor: string): DerivedAccessor | undefined =>
  DERIVED[accessor.trim().toLowerCase()];

/**
 * Whether an inline value's expression is a latest-comment one.
 *
 * This is what the document's node dispatcher branches on. It lives here rather than in the view
 * because it is the definition of the preset: the node type is the same either way, so the expression
 * is the only thing that says which of the two an `inline-value` node is.
 */
export const isLatestCommentExpression = (expression: string): boolean => {
  const parsed = parseExpression(expression);

  return !isExpressionError(parsed) && derivedAccessor(parsed.field)?.kind === 'latest-comment';
};

/** The expression the Add button seeds, and what the key field writes back. A blank key is legal. */
export const latestCommentExpression = (issueKey: string): string =>
  `(issue = ${issueKey.trim()}).${LATEST_COMMENT_ACCESSOR}`;

/**
 * The work item a comment node's JQL names, so the row can be titled with it.
 *
 * **This is not a JQL parser and must not become one.** It recognizes exactly one shape — a single
 * equality against one bare term — which is the shape the Add Report modal writes. Returns:
 *
 * - the term, for `issue = ABC-1`
 * - `''` for `issue =`, which only a document saved before the modal existed can contain
 * - `null` for anything else, including a real query — the caller then titles the row with the JQL
 *   itself, because `project = A AND status = Done` names no single work item
 *
 * **It does not check that the term is a well-formed key, and must not.** Whether `ASDF` names anything
 * is Jira's to answer, and it answers _"No work item matched."_ under a row still titled `ASDF`. The
 * question here is only **"what should this row be called?"**
 *
 * The **fetch** never uses this: `useLatestComment` takes the JQL and resolves it through the search
 * like any other expression, so a hand-written query works. Short-circuiting a bare key to skip that
 * search is a deliberate non-goal — see 007's § Out of scope.
 */
const SINGLE_KEY = /^(?:issue|issuekey|key|id)\s*=\s*"?([A-Za-z0-9_-]*)"?$/i;

export const issueKeyOf = (jql: string): string | null => {
  const match = SINGLE_KEY.exec(jql.trim());

  return match ? (match[1] ?? '') : null;
};
