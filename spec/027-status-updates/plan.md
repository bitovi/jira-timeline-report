# Status Update — a second derived comment report

> Extends [spec/016/007](../016-report-of-reports/007-latest-comment-report/plan.md), whose two-request
> shape, row-is-the-key layout, and ADF rendering this reuses wholesale.

## Context

Report of Reports has one derived field, **Latest Comment** (`fieldCatalog.ts:43`). It answers "what is
the most recent word on this work item" — whatever that word is, however old.

That is the wrong question for a weekly status report. A team that posts a `Status Update:` comment every
week wants a node that says either _this week's update_ or _nobody has posted one yet_. Latest Comment
can't say the second thing: a three-week-old comment renders identically to one posted this morning, and
the reader has to notice the date and do the arithmetic. Worse, an unrelated comment ("can you rebase
this?") posted after the real update silently displaces it.

**Outcome:** a second entry in the Derived group, **Status Update**. It scans the current week's comments
for one beginning with `Status Update`, shows it exactly as Latest Comment would, and otherwise says
_"No status update has been posted yet."_

Latest Comment is unchanged and stays in the dropdown. This is a sibling preset, not a replacement.

---

## Decisions (locked with the user)

| Question                         | Decision                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Week boundary                    | Monday 00:00 UTC → the following Monday 00:00 UTC, half-open                 |
| Match rule                       | Leading plain text, lowercased, `startsWith('status update')` — nothing else |
| Which timestamp decides the week | `created` — an update belongs to the week it was posted in                   |
| Which timestamp picks the winner | `updated` (Jira's last-edited), falling back to `created`                    |
| Two matches in one week          | The most recently edited one wins                                            |
| The `Status Update` prefix       | Left in the rendered body                                                    |

Two of these are worth their reasoning:

**The prefix stays.** Stripping it means cloning the ADF tree and trimming the first text node, and the
right trim differs depending on whether the prefix is its own paragraph, a heading, bolded, or inline
before a colon. Leaving it in removes the only piece of document surgery in the feature, and `<AdfDocument>`
keeps receiving the author's document byte-for-byte.

**The two timestamps do different jobs.** `created` decides _membership_, because which week an update
belongs to is when it was posted: editing a comment does not move it to another week, so a September edit
of a June update is not this week's news, and a Monday correction to last Thursday's update is still last
week's. `updated` then decides _the winner_ among the week's updates, because an edit is a correction and
a corrected update is the current one.

Filtering on `created` also makes the fetch's bound tight rather than approximate — see § The scan limit,
which is where an `updated`-based filter would have leaked.

---

## The match rule

Both spellings the user named must match, and they are the same rule:

```
Status Update              Status Update: shipped the auth refactor
shipped the auth refactor
```

The first is a paragraph break, the second a colon. Neither is special-cased. `adfToBlocks` already
flattens a document into blocks and left-trims the first run, so **the first block's plain text** is the
whole input to the test — the paragraph break simply ends that block early.

```ts
// src/react/reports/ReportOfReports/model/statusUpdate.ts
import { adfToBlocks, inlineToText } from '../../../components/AdfBlocks';

const PREFIX = 'status update';

/** The plain text of the comment's first block — a paragraph break ends it, which is the point. */
const leadingText = (body: unknown): string => {
  const [first] = adfToBlocks(body);

  if (!first) return '';
  if (first.type === 'codeBlock') return first.text;
  if (first.type === 'orderedList' || first.type === 'bulletList') return '';

  return inlineToText(first.content);
};

export const isStatusUpdateComment = (body: unknown): boolean =>
  leadingText(body).trimStart().toLowerCase().startsWith(PREFIX);
```

`adfToBlocks` and `inlineToText` are already exported from `src/react/components/AdfBlocks/index.ts:3` and
already tested — **do not write a second ADF walker.** Reusing them is also what makes a bolded or
heading-styled prefix match for free: marks and heading levels are stripped by the time text comes out.

Deliberately not handled, because the user asked for `startsWith` and nothing more: a prefix behind a
greeting ("Hi all — Status Update: …"), and localized spellings. `Status Updates:` matches, since it
starts with the prefix; that is a consequence of the rule, not a special case.

---

## The week

```ts
// src/react/reports/ReportOfReports/model/currentWeek.ts

/** Half-open: `start` is in the week, `end` is the next week's Monday. */
export interface WeekWindow {
  start: number;
  end: number;
}

/** The Monday 00:00 UTC that starts the week containing `time`. */
export const startOfWeekUTC = (time: number): number => { … };

export const weekContaining = (time: number): WeekWindow => { … };

/** `false` for missing or unparseable timestamps — never a throw, never a silent `NaN` compare. */
export const isWithinWeek = (timestamp: string | undefined, week: WeekWindow): boolean => { … };
```

`startOfWeekUTC` is a six-line algorithm that **already exists**, at
`src/react/reports/TableReport/model/dateBucketing.ts:46`, and the copy here must match it. It is copied
rather than imported: the two live in different report modlets with no shared date module between them,
and inventing one to move six lines is more churn than the duplication costs. Worth consolidating the day
a third caller appears — not before.

Note the mismatch this creates with the display formatter: `formatCommentTime` renders in **local** time
(`LatestComment.tsx:20`, deliberately), while the window is **UTC**. A comment posted Sunday 8pm US
Central shows a Sunday date and counts as the following week. That is inherent to the choice and is
called out in § Known trade-offs rather than papered over.

`weekContaining(Date.now())` is called in the hook, not in the pure module, so every test drives the
boundary with an explicit number and only the hook test needs `vi.setSystemTime`.

---

## Fetching

`fetchLatestComment` cannot be reused: it hardcodes `maxResults: 1` (`src/jira-oidc-helpers/jira.ts:81`),
which is exactly the guarantee it was written to provide. A week needs a page.

Add a sibling, and build both on one URL helper so the query-string shape stays in one place:

```ts
// src/jira-oidc-helpers/jira.ts

/** How far back a status-update scan looks. See the plan's § The scan limit. */
export const COMMENT_SCAN_SIZE = 100;

export function fetchRecentComments(config: Config) {
  return (issueIdOrKey: string, maxResults = COMMENT_SCAN_SIZE): Promise<JiraCommentsPage> =>
    config.requestHelper(
      `/api/3/issue/${encodeURIComponent(issueIdOrKey)}/comment?` +
        new URLSearchParams({ orderBy: '-created', maxResults: String(maxResults) }).toString(),
    ) as unknown as Promise<JiraCommentsPage>;
}
```

`JiraComment` and `JiraCommentsPage` (`jira.ts:53-66`) already carry `body`, `author.displayName`,
`created`, and `updated` — no new types. Register on the service at `src/jira-oidc-helpers/index.ts:29`
and `:105`, beside `fetchLatestComment`.

Query key, beside `latestComment` at `src/react/services/jira/key-factory.ts:28`:

```ts
recentComments: (issueKey: string) => [...jiraKeys.all, 'recent-comments', issueKey],
```

**No week in the key, and no paging loop.** Both are deliberate. A week-dependent key would miss the cache
on every Monday rollover for no benefit, and one fixed page keeps this at a single request per work item —
the same cost as Latest Comment.

### The scan limit

`-created` is the ordering that matters, because membership is decided by when an update was posted. So one
page of the newest-created comments is not a heuristic: **the 100 most recently created comments contain
every comment created this week**, unless a single work item took more than 100 comments in one week. Only
then can an update be missed, and it would have to be among the oldest of that week's hundred.

Worth recording what this dodges. Jira's comment endpoint documents `orderBy` values of `created` /
`-created` / `+created` only — **there is no `-updated`.** Had membership been decided by the edit date, a
comment created long ago and edited this week could sit arbitrarily deep in the list with no ordering Jira
offers to bring it forward, and the bound would have been an accepted wrongness rather than a real one. It
isn't, which is what makes this tight.

If a real work item does take 100+ comments in a week, § Open questions has the escalation.

`spec/029-status-updates-refactor` moved the matched window to the previous week rather than the
current one; the same page of 100 now has to cover both the (ignored) current week's comments and the
previous week's, so the bound is looser in practice than a single week's worth of activity, though the
membership guarantee itself is unchanged.

---

## The hook

Latest Comment's step 1 — resolve a JQL to exactly one issue key, and map "none" / "more than one" to
error copy — is identical for both presets and is lifted out verbatim:

```ts
// src/react/reports/ReportOfReports/hooks/useCommentReport.ts
export type CommentReportState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ok'; body: unknown; author: string; updated: string };

/** Step 1 of both comment presets: the one work item a JQL names. */
export const useResolvedIssueKey = (jql: string): { issueKey: string; state?: CommentReportState } => { … };
```

It keeps `jiraKeys.inlineExpression(trimmedJql, 'summary')` and `maxResults: 2` **unchanged** — that key is
shared with Add Value nodes so they dedupe rather than race (`useLatestComment.ts:44-45`), and two rows is
what distinguishes "exactly one" from "more than one". `LatestCommentState` becomes an alias of
`CommentReportState`, so `useLatestComment.ts` shrinks to step 2 and nothing downstream of it changes.

Then the new hook:

```ts
// src/react/reports/ReportOfReports/hooks/useStatusUpdate.ts
export const useStatusUpdate = (jql: string): CommentReportState => {
  const jira = useJira();
  const { issueKey, state } = useResolvedIssueKey(jql);

  const comments = useQuery({
    queryKey: jiraKeys.recentComments(issueKey),
    queryFn: () => jira.fetchRecentComments(issueKey),
    enabled: issueKey.length > 0,
  });

  if (state) return state;
  if (comments.error) return { status: 'error', message: `Jira couldn't return comments for ${issueKey}.` };
  if (!issueKey || comments.isPending || !comments.data) return { status: 'loading' };

  const match = pickStatusUpdate(comments.data.comments ?? [], weekContaining(Date.now()));

  // One `empty` for both "no comments this week" and "comments, but none of them an update" — the
  // reader is told the same true thing either way, and the view has one note to render.
  if (!match) return { status: 'empty' };

  return {
    status: 'ok',
    body: match.body,
    author: match.author?.displayName ?? 'Unknown',
    updated: match.updated ?? match.created ?? '',
  };
};
```

`pickStatusUpdate` is pure and lives beside the match rule, which is where it is testable without Jira:

```ts
// model/statusUpdate.ts
export const pickStatusUpdate = (comments: JiraComment[], week: WeekWindow): JiraComment | undefined =>
  comments
    .filter((c) => isWithinWeek(c.created, week) && isStatusUpdateComment(c.body))
    .sort((a, b) => stamp(b) - stamp(a))[0];
```

The explicit sort is not redundant with `orderBy=-created`: the response is ordered by **created** and the
winner is chosen by **updated**, so an edited earlier comment must be able to overtake a later one from the
same week. A comment with no readable `created` is excluded rather than guessed at from its `updated` —
"this week's" is a claim about when it was posted, so with nothing saying when that was there is no claim
to make. Jira always sends one, so this is a guard, not a case.

---

## The accessor and the dropdown

`accessors.ts` already has the registry — it just has one entry. Widen the kind and add the second:

```ts
export type DerivedAccessor = {
  kind: 'latest-comment' | 'status-update';
  label: string;
};

export const LATEST_COMMENT_ACCESSOR = 'latestComment';
export const STATUS_UPDATE_ACCESSOR = 'statusUpdate';

const DERIVED: Record<string, DerivedAccessor> = {
  latestcomment: { kind: 'latest-comment', label: 'Latest comment' },
  statusupdate: { kind: 'status-update', label: 'Status update' },
};
```

Replace `isLatestCommentExpression` — a boolean can't express three outcomes — with the kind itself:

```ts
export const derivedKindOf = (expression: string): DerivedAccessor['kind'] | undefined => {
  const parsed = parseExpression(expression);

  return isExpressionError(parsed) ? undefined : derivedAccessor(parsed.field)?.kind;
};
```

`ReportOfReports.tsx:159` is its only production caller. Lower-cased keying already gives
`.statusupdate` and `.STATUSUPDATE` for free, matching how `resolveField` matches display names.

In `fieldCatalog.ts`, the Derived group becomes a list:

```ts
const DERIVED_OPTIONS: FieldOption[] = [
  { id: LATEST_COMMENT_ACCESSOR, label: 'Latest Comment', group: 'Derived' },
  { id: STATUS_UPDATE_ACCESSOR, label: 'Status Update', group: 'Derived' },
];
```

**And `buildValueExpression` collapses to one line.** Its special case (`fieldCatalog.ts:65-66`) routes the
derived id through `latestCommentExpression`, which produces `` `(issue = ${key.trim()}).latestComment` `` —
character-for-character what the generic branch already produces for that id. The branch never did
anything:

```ts
export const buildValueExpression = (issueKey: string, fieldId: string): string =>
  `(issue = ${issueKey.trim()}).${fieldId}`;
```

That leaves `latestCommentExpression` with no production caller; delete it and its block in
`accessors.test.ts`, and add no status-update twin. If that cleanup looks like scope creep at review time,
the alternative is a two-entry lookup — but do not add a second hardcoded `if`.

---

## The view

`components/LatestComment.tsx` is already generic apart from two strings. Rename it to
`components/CommentReport.tsx` and rename its two exports:

| Was                 | Becomes       | Change                                                                  |
| ------------------- | ------------- | ----------------------------------------------------------------------- |
| `LatestComment`     | `CommentRow`  | none — it is an `<h3>` of the key and was never latest-comment-specific |
| `LatestCommentBody` | `CommentBody` | two new props: `emptyNote: string`, `testId: string`                    |

`formatCommentTime`, `KEY_PLACEHOLDER`, `isEmptyDocument`, and `Note` move with the file unchanged.
`data-testid` becomes `{testId}` / `{testId}-error` so the existing `latest-comment` /
`latest-comment-error` assertions keep passing when `LatestCommentView` passes `testId="latest-comment"`.

Rename `LatestComment.test.tsx` and `LatestComment.stories.tsx` to match. This is a mechanical find/replace
across three importers, and it is worth doing rather than leaving a `LatestCommentBody` that renders
status updates — but it is the one part of this plan that touches passing tests, so do it as its own commit.

In `ReportOfReports.tsx`, the two-way branch at `:153-163` becomes three-way:

```tsx
if (node.type === 'inline-value') {
  const kind = derivedKindOf(node.params.expression);

  if (kind === 'latest-comment') return <LatestCommentView node={node} path={path} />;
  if (kind === 'status-update') return <StatusUpdateView node={node} path={path} />;

  return <InlineValueView node={node} path={path} />;
}
```

`LatestCommentView` (`:465-497`) and `StatusUpdateView` differ only in which hook they call, so they stay
two components — a hook cannot be called conditionally, which is the reason this dispatcher exists at all.
Their shared JSX (the `NodeRow`, the caret, the controls, the collapsed body wrapper) extracts to a
`CommentReportView` taking `state` plus the three strings, and the shared expression-to-target derivation
(`parseExpression` → `issueKeyOf` → `target`) extracts to one helper both call:

```tsx
const StatusUpdateView: FC<{ node: InlineValueNode; path: LayoutPath }> = ({ node, path }) => {
  const target = commentTargetOf(node);
  const state = useStatusUpdate(target.trim() ? jqlOf(node) : '');

  return (
    <CommentReportView
      node={node}
      path={path}
      state={state}
      target={target}
      fallbackLabel="status update"
      testId="status-update"
      emptyNote="No status update has been posted yet."
    />
  );
};
```

The wrapper's `data-testid` becomes `status-update-node`, beside the existing `latest-comment-node`.

Everything else is inherited and must not be re-litigated: the row is the key, there is no
"Status Update" label above the content, the body stays mounted while collapsed so print restores it,
nothing is `print-hidden`, and the footer is the same two muted lines —
`Updated by: {author}` and `Last updated: {formatCommentTime(updated)}`.

Finally, the `.comment` signpost at `InlineValue.tsx:58-59` should name both accessors now.

---

## Files

| Action | Path                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------- |
| add    | `src/react/reports/ReportOfReports/model/currentWeek.ts` (+ test)                               |
| add    | `src/react/reports/ReportOfReports/model/statusUpdate.ts` (+ test)                              |
| add    | `src/react/reports/ReportOfReports/hooks/useCommentReport.ts` — `CommentReportState`, step 1    |
| add    | `src/react/reports/ReportOfReports/hooks/useStatusUpdate.ts` (+ test)                           |
| add    | `fetchRecentComments` + `COMMENT_SCAN_SIZE` in `src/jira-oidc-helpers/jira.ts`                  |
| rename | `components/LatestComment.{tsx,test.tsx,stories.tsx}` → `components/CommentReport.*`            |
| edit   | `src/react/reports/ReportOfReports/model/accessors.ts` — kind union, `derivedKindOf`            |
| edit   | `src/react/reports/ReportOfReports/model/fieldCatalog.ts` — `DERIVED_OPTIONS`, collapse builder |
| edit   | `src/react/reports/ReportOfReports/ReportOfReports.tsx` — 3-way dispatch, `StatusUpdateView`    |
| edit   | `src/react/reports/ReportOfReports/hooks/useLatestComment.ts` — use step 1, alias the state     |
| edit   | `src/react/services/jira/key-factory.ts` — `recentComments`                                     |
| edit   | `src/jira-oidc-helpers/index.ts` — register the fetcher                                         |
| edit   | `src/react/reports/ReportOfReports/components/InlineValue.tsx` — signpost names both accessors  |

## Phases

Each phase is green on its own and commits separately.

1. **Pure model** — `currentWeek.ts`, `statusUpdate.ts` and their tests. No React, no Jira. The week
   boundaries and every prefix spelling are settled here, before anything can fetch.
2. **Fetch** — `fetchRecentComments`, the service registration, the query key.
3. **Rename** — `LatestComment.*` → `CommentReport.*` with `emptyNote` / `testId`. Existing suite stays
   green with no assertion changes; if one needs changing, the rename was wrong.
4. **Accessor + dropdown** — `derivedKindOf`, the second Derived option, the `buildValueExpression`
   collapse. `Status Update` is now pickable and stores an expression, but renders as an unknown accessor.
5. **Hook + view** — `useCommentReport`, `useStatusUpdate`, `StatusUpdateView`, the dispatch branch. The
   feature works end to end at the end of this phase.
6. **Signpost + stories** — `InlineValue.tsx` copy, and `CommentReport.stories.tsx` gains a status-update
   empty-state story.

## Test impact

Existing suites that must stay green with **no assertion changes**: `LatestComment.test.tsx` (18 cases),
`useLatestComment.test.tsx`, `ReportOfReports.test.tsx` § `latest comment values`
(`:1072-1300`). Changing one of those is the signal that a shared extraction went wrong.

Existing suites that gain cases: `fieldCatalog.test.ts:15` (Derived now holds two, Latest Comment still
first), `accessors.test.ts` (`derivedKindOf`, the new accessor, case-insensitivity),
`ValueReportForm.test.tsx:122` (picking Status Update yields `(issue = ABC-1).statusUpdate`),
`jira.test.ts:50` (the new URL, beside the existing `?orderBy=-created&maxResults=1` assertion).

New cases worth naming, because they are the ones that catch a wrong implementation:

- `Status Update` alone on the first line, body beneath — matches (the paragraph-break spelling)
- `Status Update: …` inline — matches
- prefix bolded, and prefix as a heading — both match, because marks are stripped
- `status update` all-lower and `STATUS UPDATE` — match
- `Weekly Status Update: …` — does **not** match; the prefix must lead
- a matching comment from last week — `empty`, not `ok`
- comments this week, none matching — `empty`
- two matches this week — the one with the newer `updated` wins
- a comment created last month and edited this week — does **not** match; an edit doesn't move an update
  into this week
- a comment created this week and edited after it — **does** match; a later correction doesn't take the
  week's update away
- two matches this week, the earlier-created one edited later — the edited one wins (this is the whole
  point of ordering on `updated`)
- Sunday 23:59 UTC and Monday 00:00 UTC — opposite sides of the boundary
- an unparseable or absent `created` — excluded, no throw

`useStatusUpdate.test.tsx` models on `useLatestComment.test.tsx:36-59`'s fake `Jira` and pins the clock
with `vi.setSystemTime`.

## Verification

```
npm run test -- currentWeek statusUpdate useStatusUpdate CommentReport ReportOfReports fieldCatalog accessors jira
npm test
npm run typecheck
```

Storybook, no Jira needed: the `CommentReport` stories cover the rendered update, the empty note, the
error note, and loading.

End to end against a real Jira, on a work item you can comment on:

1. Add Report → Work Item Value → the Field dropdown shows **Derived** with both Latest Comment and
   Status Update. Pick Status Update, give it a key, add it.
2. With no comment this week, the node reads _"No status update has been posted yet."_
3. Post `Status Update: hello` and reload — the comment renders, with `Updated by:` and `Last updated:`.
4. Post a second, unrelated comment. Latest Comment on the same work item follows it; Status Update does
   not move. **This is the behaviour the feature exists for** — verify it explicitly.
5. Post `Status Update: corrected` — the node switches to the newer one.
6. Edit the _first_ status update so its `updated` is newest — the node switches back to it, because both
   were posted this week and `updated` breaks the tie. Then edit a status update from a _previous_ week —
   the node does **not** move to it, because `created` is what decides the week.
7. Collapse the node, print-preview the document, confirm the comment still appears.
8. Point a node at a bad key and at a multi-match JQL — the same two error messages Latest Comment gives.

## Known trade-offs

1. **UTC weeks, local timestamps.** The window is UTC; `formatCommentTime` renders local. Late-Sunday
   comments in western timezones show a Sunday date and belong to the next week. Accepted for a
   deterministic boundary that every viewer of a shared report agrees on.
2. **100-comment scan depth.** See § The scan limit. Exact unless one work item takes 100+ comments in a
   single week, since `created` decides membership and `-created` is the ordering Jira gives.
3. **One request per node, not batched.** Same as Latest Comment, and for the same reason — the comment
   sub-resource is not an issue search, so `childQueryGroups` (`childQueryGroups.ts:53-55`) cannot fold it
   in. Ten status-update nodes are twenty requests.
4. **`Status Updates:` and `Status Update…` both match.** A literal `startsWith` was the requirement; the
   looseness is the rule working, not a bug.

## Out of scope

Stripping the prefix from the rendered body. Configurable prefixes. A configurable week start or a
"last N days" variant. Showing _every_ update from the week. A Table report column — the Derived group is
the Add Report modal's field dropdown, and Table's column catalog is a separate, `TableIssue`-based
registry (`fieldCatalog.ts:5-8`).

## Open questions

1. Does any real work item carry more than 100 comments in a week? If so, page `fetchRecentComments`
   until the page's oldest `created` falls before the week start — the shape is already there, it just
   needs a loop inside the `queryFn` and no key change.
2. ~~Is `orderBy=-updated` quietly accepted by the comment endpoint even though it is undocumented?~~
   Moot: membership is decided by `created`, which the endpoint does sort by.
3. Should Status Update sit above Latest Comment in the Derived group? `FIELD_GROUP_ORDER`
   (`fieldCatalog.ts:27`) puts Derived first specifically so Latest Comment heads an unfiltered list; if
   status reports become the common case, the order inside the group is a one-line change.
