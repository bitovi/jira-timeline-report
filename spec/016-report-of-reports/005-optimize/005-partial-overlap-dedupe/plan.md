# 016 — Report of Reports: optimization 5 — partial-overlap sharing

Fifth and last of the optimization plans, layered on
[`../001-identical-request-dedupe/plan.md`](../001-identical-request-dedupe/plan.md), which handles two
reports issuing the _byte-identical_ request. This one is the remainder: two reports whose **different**
JQLs match some of the same work items. Baseline is [`../before.md`](../before.md); every claim relied on
here was re-read against source, and its §4 turns out to be wrong in one row (Trap 3).

**Top-line recommendation: build Phase 0 (measurement) and nothing else yet.** The arithmetic below says
a partial overlap saves ~0 requests by construction, and the traps say the schemes that would save more
are behaviour changes rather than optimizations. Three of the four build-slices are recommended against
unconditionally; the fourth is gated on numbers we do not have.

## Context

The user is hitting **Jira 429 rate-limit errors in production**. The goal is fewer HTTP requests. CPU
and allocation savings do not address the symptom.

A report-of-reports runs N complete pipelines with nothing shared below the config layer: each embedded
report builds its own config and view model (`ChildReport.tsx:53-59`) and runs its own fetch through the
same helpers the shell uses (`ChildReportConfig.js:338-366`, mirroring `route-data.js:286-300`).

`before.md` §3 states the impact as **402 of 1,502 work-item-slots (27%) redundant**. But that comes from
a **hypothetical** document defined at the top of `before.md` Part 3, not measurement — its own appendix
flags real-world overlap as **[UNVERIFIED]** — and it counts **slots, not requests**. Those are not
proportional, and the conversion is what decides this plan: in that same scenario the document issues
**9 requests** and a perfect cross-report cache removes **1**.

## What already exists

| Thing                                                                             | Where                                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Per-report search loop, then changelog bulkfetch in chunks of 1000                | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:77-101`, `:107`                               |
| `fetchBulkChangelogs` — ≤1000 ids per POST, self-paginating                       | `jira-oidc-helpers/jira.ts:320-403`, guard `:328-330`                                           |
| The deep-children walk, re-running the flat pipeline at every level               | `makeDeepChildrenLoaderUsingNamedFields.ts:19-127`; wired `index.ts:80`, `:109-111`, `:132-134` |
| The **only** dedupe in the system — parents already walked, scoped to one fetch   | `makeDeepChildrenLoaderUsingNamedFields.ts:11-18`, `:30-33`                                     |
| A cache primitive: `makeCacheable`, promise-keyed, 1s TTL                         | `stateful-data/jira-data-requests.js:12-26`, used `:37`, `:45`                                  |
| A localStorage feature flag, and a precedent for logging pipeline data behind one | `shared/feature-flag.js:6-36`; `timeline-report-view-model.js:13-19`, `:112-119`                |
| Every report's saved config, available client-side before any fetch               | `useAllReports()` at `ReportOfReports.tsx:51`; `queryParams` at `jira/reports/fetcher.ts:9`     |
| Test harnesses for the rollup and rollback stages                                 | `src/jira/rollup/dates/dates.test.ts`, `src/jira/raw/rollback/rollback.test.ts`                 |

Two properties of the changelog fetch matter and are easy to miss:

- It is keyed by issue **id**, not key. The call site passes `batch.map((i) => i.id)`
  (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:119`), the response map is keyed by `issueId`
  (`jira.ts:372-373`), read back at `:133`.
- It fetches the **whole** changelog — no `fieldIds` filter is ever passed (`:119`; `jira.ts:351-353`
  only adds one if supplied). A cached changelog is therefore complete and **independent of which fields
  the requesting report asked for**, the one thing in the pipeline that dodges Trap 2.

## What doesn't exist

- No cross-report anything: no shared issue store, no changelog cache, no normalize/derive memo
  (`before.md` Part 2).
- No JQL parser. The repo's only parser, `ReportOfReports/model/expression.ts`, is a paren/quote splitter
  for the inline-value syntax, not a grammar.
- No per-document request accounting. `progress.data`
  (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:32-39`) counts issues and changelogs, never requests.
- No membership mask downstream of the fetch: `filteredDerivedIssues`
  (`timeline-report-view-model.js:52-62`) filters only by `statusesToExclude`, and `rollupAndRollback`
  gets the whole array (`:103-104`).

---

## The three traps

### Trap 1 — exact membership (the central constraint)

Handing a report a **superset** of its work items does not add rows you can filter away. It produces
**wrong dates and statuses on the rows it does show**:

1. `addRollups` stage 3 is `addReportingHierarchy([...releases, ...derivedIssues], levels)` — the report's
   **whole array** (`rollup-and-rollback.ts:69`).
2. That calls `groupIssuesByHierarchyLevelOrType` (`rollup.ts:97-106`), which is
   `levels.map(h => issues.filter(test(h)))` — bottom-up groups of whatever is in the array.
3. `addChildrenFromGroupedHierarchy` (`rollup.ts:119-154`) reads `getParentKeys(issue)` (`:139`, defined
   `:69-80`) and, if the parent is one level up, does `parentData.childKeys.push(issue.key)` (`:144`).
   **A parent's `childKeys` is exactly "the children that happened to be in this array."**
4. `addRollupDates` (`dates.ts:53-65`) rolls children into parents via `rollupDates` (`:73-82`) →
   `parentFirstThenChildren` / `childrenOnly` (`:97-118`), each calling `mergeStartAndDueData`
   (`:84-95`): earliest start, latest due **across whatever children were present**. Stages 5–9 repeat
   the shape (`rollup-and-rollback.ts:71-85`), then `calculateReportStatuses` (`vm.js:110`).

A foreign child changes its parent's `rollupDates`, its `rollupStatuses`, and the bar drawn for it —
invisibly, since the extra issue sits _below_ the report's primary level and `primaryIssuesOrReleases`
shows only `groupedParentDownHierarchy[0]` (`timeline-report-view-model.js:148-152`). (A foreign issue
_at_ the primary level does add a visible row; that half is filterable. The invisible half is the trap.)

**Any sharing scheme must reconstitute each report's exact set before `rollupAndRollback`.** There is no
downstream place to apply a mask.

### Trap 2 — the field set

`normalizeIssue` (`normalize.ts:32-104`) is pure in the issue, but _the issue_ differs by which fields
were fetched. `getStoryPointsDefault` is `fields['Story points'] || null`
(`normalized/defaults.ts:68-73`): a report that never requested Story Points derives `null` today; hand
it a union-fetched issue and it derives a real number, which flows into confidence, `addPercentComplete`
(`rollup-and-rollback.ts:73`) and therefore into rendered dates.

Field sets genuinely differ. `allFieldsToRequest` is `fieldsToRequest ∪ fields ∪ tableColumnFields`
(`ChildReportConfig.js:326-334`, mirroring `route-data.js:423-454`), and `tableColumnFields` comes from
that child's own Table columns (`ChildReportConfig.js:314-319`). Two non-Table reports with no `fields`
param share a signature; two Table reports with different columns almost never do. So **"fetch the union
of fields once" is a behaviour change, not an optimization** — and in the worst direction: a report's
output would depend on what _other_ reports sit in the same document. It also saves **zero** requests;
only the response grows.

### Trap 3 — rollback is not pure either (this corrects `before.md` §4)

`before.md` §4 lists `rollbackIssue(raw, when)` as shareable because it is pure. It is not.
`rollbackIssues` (`rollback.ts:172-179`) first builds three lookups **from the whole array** —
`getSprintsMapsFromIssues` (`:138-148`), `getVersionsFromIssues` (`:150-160`), `getStatusesFromIssues`
(`:162-170`) — and passes them into every per-issue call (`:177`).

Observable consequence: `Status` rollback (`:117-126`) resolves `change.from` through those maps and, on
a miss, falls back to `{ name: change.fromString }` (`:124`) — no `statusCategory`, so
`getStatusCategoryDefault` (`normalized/defaults.ts:216-218`) returns `null` instead of a category.
Adding a foreign issue carrying that Status makes the lookup hit. Same for Sprint (`:61-85`) and Fix
versions (`:93-106`). Membership therefore leaks in at **three** points, not one: rollback lookups,
reporting hierarchy, every rollup stage.

A fourth, smaller one: `when` is `new Date(new Date().getTime() - compareTo * 1000)` computed **at getter
evaluation time** (`timeline-report-view-model.js:101`). Two reports with identical `compareTo` — the
common case, defaulting uniformly to `_15DAYS_IN_S` (`ChildReportConfig.js:18`, `:114-125`) — still get
`when` values milliseconds apart, so a rollback memo keyed on `when` has a ~0% hit rate.

---

## Detection: can the system know two reports overlap?

| Channel                                                                                                                                                                 | Verdict                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Pre-query, by JQL string.** Every node's `queryParams` is available before any fetch (`ReportOfReports.tsx:51`, `fetcher.ts:9`, parsed at `ChildReportConfig.js:79`). | Byte-equality only — plan 001's subject. Beyond that needs JQL semantics _and_ Jira's index: `project = X` and `assignee = me` can overlap 100% or 0%. **Undecidable client-side**; a parser would not help. |
| **Probe requests** — `approximate-count` on `(A) AND (B)` per pair.                                                                                                     | Exact, and O(R²) extra requests on a system already 429ing. **Self-defeating.** A manual diagnostic at best.                                                                                                 |
| **Post-hoc, by issue id**, once each search resolves.                                                                                                                   | Exact and free. **The only usable channel.**                                                                                                                                                                 |

The corollary shapes everything: **the search can never be skipped.** You do not know what a JQL matches
until you run it, so report B issues its search regardless. Only what comes _after_ the search — changelog
bulkfetch, rollback, normalize/derive — is even theoretically shareable.

---

## The arithmetic

Per report of N work items, today (`before.md` §3.1, re-verified):

| call                                   | count                | source                                                   |
| -------------------------------------- | -------------------- | -------------------------------------------------------- |
| `POST /api/3/search/approximate-count` | 1                    | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:46-62` |
| `GET /api/3/search/jql`                | `ceil(N / pageSize)` | `:77-101`, `MAX_RESULTS = 5000` at `:42`                 |
| `POST /api/3/changelog/bulkfetch`      | `ceil(N / 1000)`     | `:107` (`chunkArray(allIssues, 1000)`), `:117-127`       |

Only the third is addressable by sharing, and a bulkfetch batch is **coarse**.

> **Shrinking a batch saves nothing. Only emptying one saves a request.**

With `cᵢ` ids already cached when report _i_ issues its batches:

```
savedᵢ = ceil(Nᵢ/1000) − ceil((Nᵢ − cᵢ)/1000)
       = 1  if Nᵢ ≤ 1000 and cᵢ = Nᵢ    (report i is wholly contained in what came before)
       = 0  otherwise
```

**A partial overlap is by definition not containment, so it contributes zero.** The only paying case is
_containment_ — B's set ⊆ A's set — and the fully-identical instance of that is already plan 001's. What
remains uniquely here is **strict containment with different JQL**: an "everything" Table plus a "just
this epic" Gantt. That is the entire remaining prize.

Applied to `before.md` §3 (Table 1000, Gantt 301, Scatter 201; union 1100), assuming perfect
serialization:

|                     | today | with a perfect changelog-by-id cache            |
| ------------------- | ----- | ----------------------------------------------- |
| approximate-count   | 3     | 3 (plan 003's subject)                          |
| search pages        | 3     | 3 (membership unknowable upfront)               |
| changelog bulkfetch | 3     | 2 (Gantt's batch empties; Scatter's 100 remain) |
| **total**           | **9** | **8**                                           |

**One request. 11%.** The payload saving is the 27% `before.md` quotes — which matters if Jira's limiter
is cost-based, but the stated problem is request count. Generalized, the ceiling is **R − 1 requests per
document**, reached only if every report after the first is wholly contained in its predecessors.

**Concurrency erases even that.** Every node mounts in one pass (`ReportOfReports.tsx:73-80`,
`ChildReport.tsx:53-59`), so all reports reach bulkfetch at once and `cᵢ ≈ 0`. Realizing the single
request needs either an **in-flight registry keyed by issue id** (turns an independent request into a
dependent one, adding a stall surface) or a **document-level barrier** (delays the first chart until the
slowest search returns). Both are real costs for ~1 request.

**The deep-children case is where it could actually pay.** A `loadChildren` report chunks parents 40 at a
time (`makeDeepChildrenLoaderUsingNamedFields.ts:34` — a real Jira limit, not to be raised) and runs the
entire flat pipeline per chunk, per level (`:37-42`). Those batches are far below 1000, so they _can_
empty: 1 count + ≥1 search + 1 bulkfetch each, of which a cache removes at most the last — **one third**,
and only for a subtree another report already walked. On the same batches
[`../003-skip-child-approximate-count/plan.md`](../003-skip-child-approximate-count/plan.md) removes the
count third unconditionally with no cross-report machinery, and
[`../004-fix-search-expand-changelog/plan.md`](../004-fix-search-expand-changelog/plan.md) may collapse
the search third. Both rank above this plan for a reason.

---

## Decisions (locked with the user)

- **Request count is the objective.** CPU wins do not count toward it.
- **This plan is ranked last** of the five and returns least. Recommending against most of its own scope
  is an acceptable — and per the arithmetic, the correct — outcome.
- **Plan 001 owns the exact-match case.** Nothing here duplicates it; the two must compose.
- **The 40-parent chunk size stays.** Empirically verified Jira limit.
- **Measurement gates everything**, and **correctness beats throughput** — any scheme that changes what a
  report renders is out, however fast.

---

## Phase 0 — Measure (the only unconditional work)

Answer, from a real customer document: how much overlap exists, how much is _containment_, and how many
**requests** that is worth.

**Instrumentation.** A `logOverlap` flag via `defineFeatureFlag` (`shared/feature-flag.js:6-36`),
following `logReportData` (`timeline-report-view-model.js:13-19`). Off by default, toggled from the
console, zero production cost when off — no new UI, no new dependencies.

**One hook covers every report.** The shell and every child run the same two functions —
`rawIssuesRequestData` and `derivedIssuesRequestData`
(`canjs/controls/timeline-configuration/state-helpers.js:28-64`, `:131-172`), wired at
`route-data.js:286-300`/`:459-469` and `ChildReportConfig.js:338-366`. Recording inside
`derivedIssuesRequestData`'s `.then` (`state-helpers.js:141-153`) captures all of them with no per-report
wiring: `{ jql, canonical field signature, ids, keys }`. **A second hook for ground truth**: a request
counter bucketed by URL path in `config.requestHelper` (`jira-oidc-helpers/index.ts:73-78`) — shared
infrastructure, since plans 001, 003 and 004 all need a denominator.

**What the aggregator prints** (a pure function over recorded sets, so it unit-tests without Jira):

| Line                                                              | Why it decides something                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| per report: `N`, ids unique to it, field signature                | the raw shape                                                         |
| `Σ Nᵢ`, `Nᵤₙᵢₒₙ`, redundancy %                                    | comparable to `before.md` §3's 1,502 / 1,100 / 27%                    |
| `Σ ceil(Nᵢ/1000)` vs `ceil(Nᵤₙᵢₒₙ/1000)`, and `savedᵢ` per report | **the actual request saving** — the number that matters               |
| containment pairs (B ⊆ A) vs merely-overlapping pairs             | only containment pays; partial overlap is worth 0 by construction     |
| distinct field signatures                                         | reports with different signatures can share nothing but the changelog |
| requests observed, by path                                        | the denominator                                                       |

**Gate — build Phase 1 only if all three hold on a real document:** (1) ≥ 3 saveable changelog requests,
(2) that is ≥ 15% of the document's measured total, and (3) ≥ 1 containment pair exists. The `before.md`
scenario scores 1 and 11% — it does **not** clear the gate. A document of deep-children reports over
overlapping subtrees plausibly does; that is the case worth hunting for.

**Tests.** Unit-test the aggregator against synthetic key sets: disjoint (0 saveable), identical (R−1,
flagged as already plan 001's), containment, partial overlap (0), and a set crossing a 1000 boundary.
Assert the flag-off path retains no ids — measurement must not leak memory on a large document.

## Phase 1 — Changelog-by-id cache (build **only** if Phase 0 clears the gate)

The only slice that dodges all three traps, because it shares a value that is complete, field-set
independent, and **does not touch membership**.

**Layer.** Wrap `fetchBulkChangelogs` (`jira.ts:320-403`) — where the request is actually issued, so it
also covers every deep-children batch. Three parts: a `Map<issueId, { histories, at }>` with a TTL; an
in-flight `Map<issueId, Promise>` for singleflight across concurrently-mounting reports; and batch
reduction — drop cached ids before building `requestBody`, and **skip the POST when the batch empties**.

**Invariants that keep it safe:**

- The batch only shrinks, so the ≤1000 guard (`jira.ts:328-330`) holds and no re-chunking is needed.
- The return contract — a `Map` keyed by `issueId` — is unchanged, so `changelogMap.get(id)`
  (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:133`) still works.
- `issuesWithCompleteChangelogs` (`:129-134`) stays strictly per-report. **The cache supplies a value,
  never a member.** This is what makes Phase 1 acceptable and Phases 3–4 not.

**Staleness.** A Jira changelog is append-only, so a stale entry can only be _missing recent entries_ —
and those are exactly the ones `rollbackIssue` un-applies first (`rollback.ts:206-224`), so the risk is
not zero. But it is not new: today two reports fetch the same issue at different instants and can already
disagree; a shared entry makes a document internally consistent. Use the `makeCacheable` shape
(`jira-data-requests.js:12-26`) with a window in the tens of seconds — long enough for a document load,
short enough that a reload refetches.

**Interaction with plan 001.** Once 001 lands, a byte-identical duplicate never reaches
`fetchBulkChangelogs` at all, so Phase 0's aggregator must not count those savings twice.

## Phase 2 — Normalize/derive memo by `(key, fieldSignature)` — **recommended against**

Saves **zero requests**. Its case would be CPU, and even there it is the wrong target: `before.md` §3.3
puts the intra-report double pass at ~1,502 avoidable calls against overlap's 402 — **3.7× larger,
present with a single report on a page, and fixable with no cross-report machinery.**

Two further obstacles. `normalizeOptions` is shared across a document (`ChildReportConfig.js:290` mirrors
it off the parent; `route-data.js:457`) so it drops out of the key, but it is an object identity and would
still need an epoch. And the memo cannot key on the raw issue by reference — each report fetched its own
copy — so `(key, fieldSignature)` means returning report A's snapshot to report B, taken at a different
instant. Rollback memoization is worse: Trap 3 makes it set-dependent, and the `when` drift gives it a
~0% hit rate. **Flips to "build" only if** profiling _after_ the intra-report double pass is fixed still
shows normalize/derive dominating — and even then it is a responsiveness fix, not a 429 fix.

## Phase 3 — Union-of-fields fetching — **do not build**

Saves zero requests, _increases_ payload for the narrow reports, and changes what those reports compute
(Trap 2, with `getStoryPointsDefault` at `normalized/defaults.ts:68-73` as the concrete instance). A
report's numbers would depend on its neighbours in the document. There is no version of this that is a
pure optimization.

## Phase 4 — Shared issue store with per-report membership slicing — **do not build**

Saves exactly what Phase 1 saves — the same `R − 1` changelog requests, since searches still run per
report — while carrying every trap at once. It needs union-of-fields to be useful (Phase 3), or must
partition by field signature, in which case Table reports rarely share anything. It must reconstitute
each report's exact id set before `rollupAndRollback` (`timeline-report-view-model.js:103-104`), because
there is no downstream mask (Trap 1). And rollback lookups must be rebuilt per report from that exact set
anyway (Trap 3) — most of the work the store was meant to avoid. Maximum benefit equal to Phase 1, at
several times the risk. Not worth it at any measured overlap level.

---

## Ranked recommendation

| Slice                                           | Requests saved                                                                  | Traps hit                  | Verdict                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------- |
| **Phase 0** — measurement + request accounting  | 0 (it is the gate)                                                              | none                       | **Build now**                                             |
| **Phase 1** — changelog-by-id cache             | ≤ `R−1`/document; 1 in `before.md`'s scenario; **0** from partial overlap alone | none — values, not members | **Build only if Phase 0 clears the gate**                 |
| **Phase 2** — normalize/derive memo             | 0                                                                               | 2, and 3 for rollback      | **Do not build** — a 3.7×-bigger CPU win needs no sharing |
| **Phase 3** — union-of-fields fetching          | 0 (payload grows)                                                               | 2                          | **Do not build** — behaviour change                       |
| **Phase 4** — shared store + membership slicing | same as Phase 1                                                                 | 1, 2, 3                    | **Do not build** — no upside over Phase 1                 |

For the 429 problem the sibling plans dominate:
[`001`](../001-identical-request-dedupe/plan.md) removes whole pipelines,
[`003`](../003-skip-child-approximate-count/plan.md) removes one request per child batch,
[`004`](../004-fix-search-expand-changelog/plan.md) may remove ~9 of every 10 search pages, and the
unplanned request queue + `Retry-After` backoff addresses 429s directly rather than by hoping to stay
under the limit. **Do those first.**

---

## Tests and verification

**Phase 0** — the aggregator unit tests listed in the phase.

**Phase 1 — cache mechanics.** Extend
`src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts` (which already simulates the
deep-children caller, `:54`) and add wrapper unit tests: hit / miss / TTL expiry; two concurrent batches
sharing ids issue one POST; a **partially**-cached batch still issues one POST with cached ids removed
from the body; a **fully**-cached batch issues zero POSTs and still returns a complete map; the outgoing
batch never exceeds 1000 (`jira.ts:328-330`).

**Phase 1 — the membership guards**, the first mattering most:

1. **Negative control — prove the trap is real and the guard can see it.** Run `addRollups` over set `S`,
   then over `S ∪ {a foreign child of a parent in S}`, and assert the parent's `rollupDates` **differ**
   (grounded in `mergeStartAndDueData`, `dates.ts:84-95`). If this cannot be made to fail, the invariant
   test below is worthless.
2. **Invariant — a superset must never reach a report.** With the cache installed, run report B's
   `rollupAndRollback` alone, then again after report A (sharing issues) has populated the cache, and
   assert byte-identical output. Compare via a projection like `projectIssueForLog`
   (`timeline-report-view-model.js:23-34`) rather than deep-equalling the raw graph.

**Phase 1 — Trap 3 guard.** `rollbackIssues([X])` vs `rollbackIssues([X, Y])` where `X`'s changelog
references a Status carried only by `Y`'s fields: assert the results differ (bare `{ name }` versus the
full Status object, `rollback.ts:117-126`), and assert installing the cache does **not** introduce that
difference — because the cache supplies changelogs, never members.

**Standard gates.** `npm run typecheck`, `npm test`, `npm run build`. Then, **credentialed** (needs
`npm start` and Jira credentials; nothing here settles without it):

1. Open a real customer report-of-reports with `logOverlap` on; record the printed table.
2. Compare the predicted saveable-request count against the actual `POST /api/3/changelog/bulkfetch`
   count in the network panel. If they disagree the aggregator is wrong and Phase 1 must not proceed.
3. Settle `before.md`'s appendix items 1–3 in the same session. Item 2 in particular — the real byte
   split between search and bulkfetch — is the assumption ("changelog dominates the payload") that this
   plan's only surviving slice rests on. Stated everywhere in the repo, measured nowhere.
   **[UNVERIFIED]**

## Risks and open questions

- **The changelog-dominates-payload assumption is unmeasured.** If search responses are the bulk of the
  bytes, Phase 1 loses even its payload consolation.
- **Concurrency defeats the cache** without an in-flight registry or a document barrier — latency or
  complexity for ~1 request. Decide _after_ Phase 0.
- **Refresh semantics.** A TTL long enough to span a document load can serve a stale changelog to a user
  who just clicked reload; there is no cache-bust affordance today.
- **Sibling interference.** Plan 001 changes what reaches `fetchBulkChangelogs`; plan 004 changes the
  search page count. Take Phase 0's numbers **after** those land, or they measure a system that no longer
  exists.
- **The open question this plan could not settle from source:** whether real customer documents contain
  _containment_ pairs at all. Everything Phase 1 could ever save depends on it, and partial overlap — this
  plan's nominal subject — provably saves nothing. Only Phase 0 against a real document answers it.

**Out of scope:** the request queue and `Retry-After` backoff (deliberately unplanned, and the only
measure that addresses 429s directly rather than by staying under the limit); anything the four sibling
plans own; raising the 40-parent chunk size; server-side or proxy caching; and any change to what a report
renders.
