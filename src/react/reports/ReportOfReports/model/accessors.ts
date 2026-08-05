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
 * A work-item key out of the simplest possible JQL, so a comment node can be edited as a key field
 * rather than as an expression.
 *
 * **This is not a JQL parser and must not become one.** It recognizes exactly one shape — a single
 * equality against one bare term — which is the shape the Add button writes. Returns:
 *
 * - the term, for `issue = ABC-1`
 * - `''` for `issue =`, the freshly-added node: the shape is right, the key isn't typed yet
 * - `null` for anything else, including a real query — the caller then falls back to editing the
 *   whole expression, because a key field cannot represent `project = A AND status = Done`
 *
 * **It does not check that the term is a well-formed key, and must not.** It used to require
 * `[A-Za-z][A-Za-z0-9_]*-\d+`, and that made a typo unrecoverable: `issue = ASDF` fell through to
 * `null`, so the node flipped to editing its whole expression and showed
 * `(issue = ASDF).latestComment` as its heading — and typing a real key into *that* field produced the
 * expression `SUNNYSUSHI-54`, which doesn't parse, so the node stopped being a comment node at all.
 * The only way out was to hand-type the full expression.
 *
 * The question this answers is **"can a key field represent this JQL?"**, not "is this a valid key".
 * Whether `ASDF` names anything is Jira's to answer, and it answers _"No work item matched."_ — in
 * place, beside a field that still edits a key.
 *
 * The **fetch** never uses this: `useLatestComment` takes the JQL and resolves it through the search
 * like any other expression, so a hand-written query works. Short-circuiting a bare key to skip that
 * search is a deliberate non-goal — see the plan's § Out of scope.
 */
const SINGLE_KEY = /^(?:issue|issuekey|key|id)\s*=\s*"?([A-Za-z0-9_-]*)"?$/i;

export const issueKeyOf = (jql: string): string | null => {
  const match = SINGLE_KEY.exec(jql.trim());

  return match ? (match[1] ?? '') : null;
};

/**
 * Whether text typed into a comment node's one field is a work item key rather than an expression.
 *
 * The second half of the recovery above, and it covers the case `issueKeyOf` cannot: a node whose JQL is
 * a genuine query (`(project = ABC).latestComment`) legitimately edits as an expression, and typing a
 * bare key into that field would otherwise write the unparseable expression `SUNNYSUSHI-54` and un-make
 * the node. A bare term is always meant as a key, so the caller wraps it in
 * {@link latestCommentExpression} instead. **A node added with "Add Work Item Update" cannot be knocked out
 * of being a comment node by anything typed into it.**
 *
 * Empty counts, deliberately: clearing the field should blank the key, not turn the node into an empty
 * inline value.
 */
export const looksLikeKey = (text: string): boolean => /^[A-Za-z0-9_-]*$/.test(text.trim());
