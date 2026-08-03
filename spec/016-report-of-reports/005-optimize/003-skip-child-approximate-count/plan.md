# 016 — Report of Reports: optimization 3 — skip approximate-count on child batches

Third of five optimizations sharing the baseline in [`../before.md`](../before.md). Ranked below
[`../001-identical-request-dedupe/plan.md`](../001-identical-request-dedupe/plan.md) and below a request
queue with `Retry-After` backoff (deliberately not planned yet); above
[`../004-fix-search-expand-changelog/plan.md`](../004-fix-search-expand-changelog/plan.md) and
[`../005-partial-overlap-dedupe/plan.md`](../005-partial-overlap-dedupe/plan.md). Independent of all four —
it touches one `if`.

## Context

Users are hitting **Jira 429 rate-limit errors in production**. The goal is fewer _requests_; CPU is
secondary.

`fetchAllJiraIssuesWithJQLAndFetchAllChangelog` opens every call with a
`POST /api/3/search/approximate-count`
(`src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:46-62`). It is unconditional:
`getApproximateCount()` is awaited at `:61` before anything else, guarded only by `if (!params.jql)`
(`:47`). Its single product is `estimatedTotal` (`:62`), whose single consumer is
`progress.data.issuesRequested` (`:68-71`) — verified: `grep estimatedTotal` finds exactly `:62` and `:69`
in this file.

That function is also the `rootMethod` the deep-children loader recurses with
(`src/jira-oidc-helpers/index.ts:109-111`, reassigned at `:132-134`), and the loader calls it once per
40-parent batch (`src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts:34`, `:41`). **So every
child batch pays 3 requests — count, search, changelog bulkfetch — where 2 would do**, and a batch at the
terminal level of the walk pays 2 where 1 would do (a batch that returns no issues does no bulkfetch:
`chunkArray([], 1000)` is `[]`, so `Promise.all([])` at `:117` fires nothing).

The 40 is a real Jira limit the team verified empirically. It is not moving. That is exactly why the cost
_per batch_ is where the requests are.

Worse than the totals: the counts arrive as a **burst**. `fetchChildrenResponses` calls `rootMethod`
synchronously inside `.map` (`:37-42`), so all 25 batches of a 1000-parent level start at once, and the
first thing each one does is await its count. The children phase therefore opens with N simultaneous POSTs
to the same endpoint, with no queue, no throttle and no retry
(`before.md` Part 2). That burst is the single most 429-shaped thing in the walk.

### The request math

`loadChildren` report, root JQL matching 1,000 parents, ~3 children per work item, 2 levels of children.
One search page per call (a 120-issue batch is well under `MAX_RESULTS = 5000`, `:42`) and one changelog
bulkfetch per 1,000 issues (`:107`).

| level              | `rootMethod` calls | issues back | count | search | changelog | today   | after   |
| ------------------ | ------------------ | ----------- | ----- | ------ | --------- | ------- | ------- |
| root (primary JQL) | 1                  | 1,000       | 1     | 1      | 1         | 3       | 3       |
| children L1        | 25                 | 3,000       | 25    | 25     | 25        | 75      | 50      |
| children L2        | 75                 | 9,000       | 75    | 75     | 75        | 225     | 150     |
| terminal probe L3  | 225                | 0           | 225   | 225    | 0         | 450     | 225     |
| **total**          | **326**            | **13,000**  | 326   | 326    | 101       | **753** | **428** |

**325 requests removed, 43%.** The terminal probe is the sharpest part: 225 counts whose entire output is
the number 0. A shallower report behaves the same way — 1,000 parents with a single level of children is
228 requests today and 128 after (44%), because the ratio is structural: one count per call, always.

The invariant: **skipping the count on child batches removes `(total rootMethod calls − 1)` requests.**

## What already exists

| thing                                                                   | where                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A clean split between the root call and the child calls                 | `makeDeepChildrenLoaderUsingNamedFields.ts:105` vs `:41`              |
| Params already carry keys the search ignores (`childJQL`, `limit`)      | `:39`; `searchJiraIssuesWithJQL` whitelists 6 keys, `jira.ts:118-124` |
| A three-phase progress model with `phase`, `parentsToProcess/Processed` | `types.ts:55-68`, set at `makeDeep…:104` and `:111-116`               |
| A smoothed children projection that does **not** read `issuesRequested` | `LoadingProgressContainer.tsx:77-80`                                  |
| A test file with a fake `requestHelper` that already answers the count  | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts:8-36`          |

### Does the UI need the denominator during `phase === 'children'`?

This is the load-bearing question, and the answer is _mostly no, with one window_. The three-phase loader
landed in `cbd111f0`. Tracing what consumes `issuesRequested` after the flip to `'children'`
(`makeDeep…:111-116`):

1. **The primary step** takes `primaryRequested`, the snapshot captured _at the flip_
   (`LoadingProgressContainer.tsx:60-64`, read at `LoadingProgress.tsx:92`). Frozen before any child count
   exists. **Unaffected.**
2. **The smoothed children projection** is `frozenProjected = parentsToProcess × (childRec /
parentsProcessed)` (`LoadingProgressContainer.tsx:77-80`). Its inputs are `issuesReceived`,
   `parentsToProcess` and `parentsProcessed` — **none of them `issuesRequested`**. Traced against the
   existing smoothing test (`LoadingProgress.test.tsx:178-250`): freeze `issuesRequested` at 20 for every
   rerender in that test and every assertion still holds (`20 of ~400` / `5%`, then `20%`, then
   `80 of ~800` / `20%`). **Unaffected.**
3. **The history step** runs off `changeLogsRequested/Received`, incremented per batch from the batch's own
   issue count (`fetchAll…:113`, `:121`). No network cost, unaffected — so one of the three bars keeps
   moving no matter what.
4. **The pre-projection fallback — the one real dependency.** Before the first top-level parent's _entire
   subtree_ completes (`makeDeep…:67-77`), `frozenProjected` is null, and both the container
   (`LoadingProgressContainer.tsx:83`) and `computeSteps` (`LoadingProgress.tsx:124`, `:131`) fall back to
   `childReq = issuesRequested − primaryRequested`. Stop growing `issuesRequested` and `childReq` is 0,
   which yields a 0% bar (already correct — `:131` guards on `childReq`) but the string
   **`"132 of ~0 found"`**, because `:124` does not guard. That is the only breakage, and it is a copy bug,
   not a data bug.

Worth being honest about what that fallback is worth today: with 25 batches counting concurrently,
`childReq` jumps to the whole level's total almost at once, so `childRec / childReq` climbs to the 0.85
pre-projection cap (`LoadingProgressContainer.tsx:87`) and parks there. The information being given up is a
bar that races to 85% and stops.

**Second consumer, outside the stepper:** the settings sidebar renders
`Loaded {receivedChunks} of {totalChunks} issues` (`JqlTextArea.tsx:30-37`) from
`rawIssuesRequestData.progressData.issuesRequested` (`useRawIssueRequestData.ts:19`, `:27`). If that path
resolves, the deep path would read "Loaded 13,000 of 1,000 issues" after this change. **[UNVERIFIED]** — the
key path omits the `.value` segment that `progressData` (a `value.with(null)`,
`state-helpers.js:32`, `:47`) requires, and `useReportLoadingState.ts:43-45` states in terms that
`value.from` does not auto-unwrap it, so `totalChunks` is probably always `undefined` and the branch dead.
Settled by one five-line vitest mirroring `useReportLoadingState.test.tsx:16-26` and reading
`progressData.issuesRequested` without `.value`, or one look at the sidebar in the running app.

## What doesn't exist

- Any way for a caller to tell `fetchAllJiraIssuesWithJQLAndFetchAllChangelog` to skip the count.
- Any test file for `makeDeepChildrenLoaderUsingNamedFields.ts` (`ls src/jira-oidc-helpers/*.test.*` →
  `fetchAllJiraIssuesWithJQLAndFetchAllChangelog`, `fields`, `jira` only). Nothing pins the root/child call
  shapes today.
- Any request queue, concurrency cap, or 429 retry — that is optimization (2), unplanned.

## Decisions (locked with the user)

- **An explicit `skipApproximateCount` param on `params`**, threaded at exactly one call site
  (`makeDeep…:41`). Rejected alternatives:
  - _Reuse `progress.data.phase === 'children'`._ Free — the discriminator already exists, and the root
    call at `:105` runs while phase is `'primary'` (`:104`). But it makes a **request-shaping** decision
    depend on a **UI-progress** field that callers may share, mutate, or omit (`progress` defaults to
    `() => {}` at `fetchAll…:28`), and it cannot be unit-tested without building progress state. Rejected.
  - _A separate entry point._ `RootMethod` is `(params, progress) => Promise<Issue[]>`
    (`makeDeep…:9`) and `makeDeep` is applied to two different root methods (`index.ts:109-112`), only one
    of which would have the variant. Widening the loader's contract for one boolean. Rejected.
- **The root call keeps its count.** It is the primary-phase denominator; without it the primary step reads
  `estimating scope…` forever (`LoadingProgress.tsx:104`).
- **The flat (non-`loadChildren`) path does not change at all.** It reaches
  `fetchAllJiraIssuesWithJQLAndFetchAllChangelog` through `…UsingNamedFields` (`jira.ts:540-558`, called at
  `jira-data-requests.js:120`), which never sets the flag.
- **The `try/catch` stays** (`fetchAll…:55-58`). It is load-bearing for the root call: a failed count must
  degrade the progress bar, not the report.

---

## Phase 1 — the skip parameter

`src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts`

- Add `skipApproximateCount?: boolean` to the inline params type (`:18-24`).
- Destructure it out **alongside `limit`** at `:30`, so it never lands in `apiParams` and therefore never
  reaches `searchJiraIssuesWithJQL` (`:80-85`). Belt and braces — that helper whitelists its query keys
  (`jira.ts:118-124`), which is why `childJQL` already rides along harmlessly — but a request-shaping flag
  should not be one whitelist edit away from the wire.
- Guard `:61-71`: when set, skip both the call and the `issuesRequested` accumulation/emit. Not "add 0" —
  emit nothing, so the batch's first progress tick is its search result (`:96`).

`src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts`

- `:41` becomes `rootMethod({ ...params, jql, skipApproximateCount: true }, progress)`. The root call at
  `:105` is untouched.

`src/jira-oidc-helpers/types.ts`

- Add `skipApproximateCount?: boolean` to `Params` (`:45-48`) for discoverability. It is `[key: string]: any`
  today, so this is documentation, not a type fix.

**Not touched:** the other `rootMethod`, `fetchAllJiraIssuesWithJQL` (`index.ts:112`, `:128-130`), which runs
its own count inside `searchAllJiraIssuesWithJQL` (`jira.ts:138-149`). It ignores unknown params and — more
to the point — `fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields` has no caller anywhere in `src`
(verified by grep; only the two definitions in `index.ts`). It also takes a single argument
(`jira.ts:219`), so the loader's `progress` is dropped on the floor there already. Out of scope.

## Phase 2 — the pre-projection children copy

`src/react/TimelineReport/components/LoadingProgress/LoadingProgress.tsx`

One line. Guard the discovered-total branch at `:124` on `childReq`:

```ts
: childReq
  ? `${fmt(childRec)} of ~${fmt(childReq)} found`
  : `${fmt(childRec)} found`,
```

`barValue` (`:126-132`) already yields 0 when `childReq` is 0, and the container already yields no
projection (`LoadingProgressContainer.tsx:83`) — **neither file needs a change**. The children step now
reads `"132 found"` with an empty bar until the first parent subtree completes, then switches to the
smoothed `"132 of ~600"` exactly as today.

Keep the `of ~N found` branch rather than deleting it: it becomes unreachable on the real deep path (nothing
grows `issuesRequested` after the flip) but stays reachable by props, and deleting it would ripple through
`childReq`, `primaryRequested` and the container. Note it in the docblock at `:57-70`.

**Stories** (`LoadingProgress.stories.tsx`): `LoadingChildren` (`:37`) and `ChildrenTotalGrew` (`:67`) both
depict `issuesRequested > primaryRequested` during the children phase, which can no longer happen. Replace
`LoadingChildren` with a `ChildrenDiscovering` story where `issuesRequested === primaryRequested === 342` and
`issuesReceived` is 474, and delete `ChildrenTotalGrew`. Storybook is the design-review surface; a story of
an unreachable state is a lie.

## Phase 3 — the sidebar denominator (conditional)

Settle the **[UNVERIFIED]** above first. If `totalChunks` does resolve, change `JqlTextArea.tsx:30-37` to
render `Loaded {receivedChunks} of {totalChunks} issues` only when `receivedChunks <= totalChunks`, and
`Loaded {receivedChunks} issues…` otherwise. If it resolves to `undefined` (the expectation), the branch is
already dead and this phase is one line in the plan's As-built section saying so. Fixing the key path is a
separate change and not this plan's business.

---

## Tests

### `src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts` (exists, 1 test)

`makeConfig` (`:8-36`) already answers `approximate-count` (`:10-13`), `search/jql` and
`changelog/bulkfetch` off a `vi.fn`, so the assertions are `mock.calls` filters. Add:

| test                            | assertion                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| skips the count when asked      | `skipApproximateCount: true` ⇒ zero calls matching `approximate-count`; still exactly one `search/jql` and one `changelog/bulkfetch`    |
| leaves `issuesRequested` alone  | same call ⇒ `progress.data.issuesRequested` is 0 while `issuesReceived` is 2 — proves the emit was skipped, not zeroed                  |
| counts by default               | no flag ⇒ exactly one `approximate-count` call and `issuesRequested === 2` (makes explicit what `:39-73` asserts only as a side effect) |
| the flag never reaches the wire | the `search/jql` URL fragment contains no `skipApproximateCount`                                                                        |

### `src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.test.ts` (new)

The test that actually protects the optimization. Reuse the `makeConfig` shape from the file above — its
`fieldsRequest` already returns `{ list, nameMap, idMap }`, which is what `makeDeep…:85` and `:121` need.
Drive one root JQL matching 2 parents, each with 2 children, children with none.

- **The root call counts, the child batches don't** — exactly one `approximate-count` call for the whole
  walk, and its body's `jql` is the root JQL, not a `parent in (…)` one.
- **Request count is what the math says** — for that fixture: 1 root (count+search+changelog) + 1 L1 batch
  (search+changelog) + 1 terminal batch (search only) = 6 requests, down from 8.
- **Regression guard on the walk itself** — the same issue set comes back, `keysWhoseChildrenWeAreAlreadyLoading`
  still dedupes (`:30-33`), and `phase` / `parentsToProcess` / `parentsProcessed` end at
  `'children'` / 2 / 2 (`:111-116`, `:67-77`).

### `src/react/TimelineReport/components/LoadingProgress/LoadingProgress.test.tsx` (exists, 10 tests)

- **One existing assertion changes** — `:68` expects `'0 of ~0 found'`; it becomes `'0 found'`. That test
  (`:57-70`) is the canary for Phase 2, not a breakage to route around.
- **New (`computeSteps`)** — children phase, `issuesRequested === primaryRequested === 342`,
  `issuesReceived: 474`, no projection props ⇒ detail `'132 found'`, `barValue` 0.
- **New (container)** — copy the smoothing test (`:178-250`) with `issuesRequested` frozen at 20 across every
  rerender. All four of its assertions must still pass unchanged. This is the test that proves the projection
  never needed the count.
- Unchanged: `:31-55` and `:113-128` pass props directly and keep documenting the shape.

### Verification

- `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- Storybook: the new `ChildrenDiscovering` story, plus `LoadingChildrenSmoothed` (`:51`) to confirm the
  post-projection state is untouched.
- **Credentialed pass (`npm start`), the only place the win is real.** Open a `loadChildren` report with the
  network panel filtered to `approximate-count`: **exactly one request**, before any `parent in (…)` search.
  Compare total request count against `main` for the same report — expect roughly a 40% drop and, separately,
  watch whether the 429s stop. Check the stepper through a whole load: primary counts up normally, children
  shows `N found` then flips to `N of ~M`, history fills throughout, all three finish green. Check the
  sidebar text (Phase 3).
- Regression: a flat report (`loadChildren` off) must still issue its one `approximate-count` and show
  `Loaded X of Y` normally.

## Risks / caveats

- **A quiet children bar early in a big walk.** `parentsProcessed` only ticks when a top-level parent's whole
  subtree finishes (`makeDeep…:67-77`), and with all batches concurrent that first tick can be late. The
  children bar sits at 0 with a growing `N found` until then, where today it races to the 0.85 cap. Honest,
  but less reassuring. If it reads as stalled, the fix is a new count-free signal — e.g. incrementing a
  `parentsDirectChildrenLoaded` counter when a batch's own `rootMethod` resolves, before recursion, giving a
  children-per-parent ratio one round trip in. Deliberately not built here: it is a progress-model change,
  not a request-count change.
- **Composes with, and is partly masked by, optimization (4).** If `expand=changelog` really does cap page
  size (`before.md` §1.2, **[UNVERIFIED]**), each batch is making ~2 search requests, so the count is a
  smaller fraction of the total and this saves a smaller percentage — while
  [`../004-fix-search-expand-changelog/plan.md`](../004-fix-search-expand-changelog/plan.md) saves more. Fix
  both; the absolute 325 requests saved here does not change either way.
- **Report of reports multiplies this by N.** Each embedded report runs its own walk with nothing shared
  (`before.md` Part 2), so a document with four `loadChildren` reports saves ~1,300 requests. It also means
  this change alone will not stop 429s if the document is large enough — that needs the queue, optimization
  (2).
- **No test can prove the 429s stop.** Everything here is verifiable as request _shape_; the rate-limit
  outcome is only observable against a real instance under real load.

## Out of scope

The 40-parent chunk size (a verified Jira limit). Request queuing, concurrency caps and `Retry-After`
handling. `fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields` and the dead
`fetchChildrenResponses`/`fetchDeepChildren` exports (`jira.ts:560-581`, `:586`; `index.ts:113-114`). Fixing
the `useRawIssueRequestData` key path. Any change to what the deep walk fetches.
