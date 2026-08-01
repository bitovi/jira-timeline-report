# 016 — Report of Reports: optimization 1 — identical-request dedupe

First of the sibling plans in [`../`](../), all measured against [`../before.md`](../before.md). Ranked by
value: **this one**, then a request queue with `Retry-After` backoff (deliberately not planned yet), then
[`../003-skip-child-approximate-count/`](../003-skip-child-approximate-count/),
[`../004-fix-search-expand-changelog/`](../004-fix-search-expand-changelog/), and
[`../005-partial-overlap-dedupe/`](../005-partial-overlap-dedupe/). Nothing here plans any of those.

> Line numbers verified against the working tree at `6a7ca435` on
> `feat/012-table-report-crosstab-and-date-bucketing`. The branch is moving; several `before.md`
> citations have drifted and one of its claims is now stale — see §Key normalization.

## Context

Production is returning Jira **429 rate-limit errors**. The goal is fewer HTTP requests; CPU and
allocation savings are secondary.

`before.md` Part 2 establishes why a document is the worst case: `ChildReport`
(`src/react/reports/ReportOfReports/components/ChildReport.tsx:53-62`) builds a `ChildReportConfig` per
embedded report, and each runs **its own** fetch through the same helpers the shell uses
(`ChildReportConfig.js:334-349`). Every node mounts in one pass and stays mounted when collapsed
(004-redesign), so N embedded reports start N complete pipelines at once, unthrottled and undeduped.

In practice most embedded reports in a document ask Jira the **same question** — a "Q3 status" document
is typically one JQL shown five ways. Those five reports issue five byte-identical cascades; with
`loadChildren` over 1000 parents that is 5 × (count + search + changelog bulkfetch + ~25 recursive child
batches, each with its own three calls) — hundreds of avoidable requests per page load.

### Why identical-request sharing is safe where partial overlap is not

`before.md` §1.4 and Part 4 name the trap: rollup folds children into parents, so a report holding a
_different_ set of work items gets _different dates and statuses on the rows it does show_. The mechanism
is `addRollups` (`src/jira/rolledup-and-rolledback/rollup-and-rollback.ts:66-86`), reached from
`rollupAndRollback` (`:34-63`). Membership defines the output.

That trap needs a _membership difference_ to fire, and identical-request sharing produces none: every
subscriber receives the same array of the same work items it would have fetched alone. Downstream,
`derivedIssuesRequestData` maps that array (`state-helpers.js:149-153`) and each report's own
`TimelineReportViewModel` rolls up with its own settings. Only the request count changes.

The shared artifact is the first row of `before.md`'s shareable table — "the raw fetch per work item id".
Its caveat there, "field sets differ per report", is what the cache key exists to handle.

## What already exists

| Thing                                                                                                     | Where                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The single fetch entry point, every input in scope as a plain value; the flat / deep fork lives inside it | `src/stateful-data/jira-data-requests.js:100-131`, fork at `:118-120` |
| Its only call site                                                                                        | `src/canjs/controls/timeline-configuration/state-helpers.js:36`       |
| `CORE_FIELDS`, folded into the request and exported                                                       | `jira-data-requests.js:81-93`, `:98`, `:112`                          |
| A caching precedent (1 s TTL)                                                                             | `jira-data-requests.js:12-26`, used at `:37` and `:45`                |
| Canonical field-id helpers — name↔id collapsing, `CORE_FIELDS` absorption                                | `src/canjs/routing/route-data/requested-fields.ts:25`, `:33`, `:55`   |
| Per-config progress observable and its update callback                                                    | `state-helpers.js:32`, `:46-47`                                       |
| What the loading UI reads (seven keys under `progressData.value`)                                         | `useReportLoadingState.ts:55-94`                                      |
| Field name↔id maps available synchronously off the helpers                                               | `src/jira-oidc-helpers/index.ts:64-71` sets `jiraHelpers.fields`      |

## What doesn't exist

- **No cache on `getRawIssues`.** `before.md` §1.2 says so and it is still true at `:100`.
- **`makeCacheable` cannot be reused as-is.** It is argument-blind: `makeRequest(...args)` returns
  `cachePromise` without ever looking at `args` (`jira-data-requests.js:15-25`). It also starts its
  timer at call time, not at settle time. Fine for `getServerInfo`, useless for a keyed issue cache.
- **No test file for `src/stateful-data/jira-data-requests.js`.** The directory holds only `login.test.js`.
- **No way for the app to force a data reload.** The only refetch triggers are the four observables
  `rawIssuesRequestData` listens to (`state-helpers.js:34-51`, wired at `route-data.js:286-299` and
  `ChildReportConfig.js:334-348`). There is no Refresh button anywhere; site switching does a hard page
  reload (`src/react/SelectCloud/SelectCloud.tsx:22`). So a TTL cache needs no escape hatch for parity
  with today — only one for tests and for whoever adds that button later.

## Decisions (locked with the user)

- **Reduce request count.** CPU/allocation is secondary.
- **`getRawIssues` is the choke point**, not the request helpers and not `rawIssuesRequestData`
  (argued below).
- **The 40-parent chunk at `makeDeepChildrenLoaderUsingNamedFields.ts:34` is a real, empirically
  verified Jira limit.** Untouched here.
- **Sibling plan 2 (queue + `Retry-After`) is deliberately unplanned.** This plan must not grow a queue.
- **Singleflight is the load-bearing part; the TTL is a safety net.**

### Where the cache layer goes, and what was rejected

**Chosen: `getRawIssues` (`jira-data-requests.js:100`).** Four checkable reasons: both loaders are
selected inside it, after every input is normalized (`:118-120`); all key inputs are present as plain
values, already unwrapped from observables by the caller (`state-helpers.js:38-44`), so the key needs no
CanJS; `CORE_FIELDS` folding is already its job (`:112`), which is exactly the normalization the key needs;
and it has one call site (`state-helpers.js:36`).

**Rejected: the request helpers** (`hosted-request-helper.js`, `connect-request-helper.js`). An HTTP-level
cache would have to key `POST /api/3/changelog/bulkfetch` on its JSON body and hold every response body
for the whole load rather than one array at the end; it would still run N orchestration cascades and N
`mapIdsToNames` passes; and it is the home of sibling plan 2 — a cache and a queue in the same object make
both harder to reason about, and the queue is the more valuable.

**Rejected: `rawIssuesRequestData` (`state-helpers.js:28`).** One level too high. Its inputs are
observables, so keying would have to be reactive; its whole job is per-config plumbing; and sharing there
means sharing the `{ progressData, issuesPromise }` pair — one progress observable across two configs, at
which point either config's `progressData.value = null` (`:35`) blanks the other's loading bar.

**Rejected: a union request at the document layer.** That is partial-overlap dedupe, sibling plan 5, and
it walks straight into the membership trap.

---

## Phase 0 — The cache key (pure, no behaviour change)

New module `src/stateful-data/raw-issues-cache-key.ts`, exporting one function. TypeScript imported from
`.js` with an explicit extension, as `route-data.js:7-12` already does.

```ts
rawIssuesCacheKey({ isLoggedIn, loadChildren, jql, childJQL, fields }, maps?: FieldMaps): string
```

The invariant: **the key must be a function of what will actually be sent, computed by the same rule the
sender uses.** Both senders resolve identifiers with `nameMap[f] || f`
(`src/jira-oidc-helpers/jira.ts:546` for the flat path, `makeDeepChildrenLoaderUsingNamedFields.ts:89` for
the deep one), which is exactly `toFieldId` (`requested-fields.ts:25-29`). So:

```
[ isLoggedIn === false ? 'sample' : 'jira',
  !!loadChildren,
  jql,
  childJQL || '',
  [...canonicalFieldIdSet([...fields, ...CORE_FIELDS], maps)].sort() ]
```

`jiraHelpers` is **not** in the string. The cache is a `WeakMap<jiraHelpers, Map<key, Entry>>`, so a
different site physically cannot hit another site's entries, and the map is collected with the helpers.

### Key normalization is a real trap, not a formality

`allFieldsToRequest` is a `[...new Set(...)]` union in both places:

|       | source                                                     | line                       |
| ----- | ---------------------------------------------------------- | -------------------------- |
| shell | `[...new Set([...baseFields, ...this.tableColumnFields])]` | `route-data.js:428`        |
| child | `[...new Set([...baseFields, ...this.tableColumnFields])]` | `ChildReportConfig.js:329` |

**A `Set` preserves insertion order, so the array's order is data.** `baseFields` is
`fieldsToRequest`, global and mirrored to children (`ChildReportConfig.js:288`), so it contributes the
same prefix everywhere. `tableColumnFields` does not: it is `tableColumns.flatMap(requiredFieldsFor)`
(`route-data.js:402-408`, `ChildReportConfig.js:310-315`), i.e. **ordered by the report's column order** —
the thing users drag around. Two Table reports over the same JQL with the same columns in a different
order produce different arrays for the same set, and an unsorted key silently misses the dedupe.

Sorting alone is not enough, because the two contributors live in different identifier spaces:
`fieldsToRequest` and `CORE_FIELDS` are display **names** (`jira-data-requests.js:81-93`), while
`requiredFieldsFor` returns field **ids** (`builtinFieldRegistry.ts:260-265` — `field:<id>` → `id`, plus
facet `requires` entries such as `'project'`). Hence `canonicalFieldIdSet` rather than a raw sort, which
buys two more hits for free: **core absorption** (a Table whose only column is Status asks `['Status']`, a
Gantt over the same JQL asks `[]`; `Status` is core at `:87`, so both send the same id set) and **name vs
id** (`Status` and `status` collapse). Before the field maps load, `toFieldId` passes identifiers through
unchanged (`requested-fields.ts:25-29`) — that can only _miss_ a dedupe, never create a false one.

**Do not sort what is actually sent.** Wire order is irrelevant to Jira, `getRawIssues:112` already derives
the sent list deterministically, and the response is re-keyed by display name via `mapIdsToNames`
regardless. Sorting the payload is a request-shape change for zero gain. Consequence for the record: two
reports differing only in field order share the _first_ caller's array; the id sets are equal so the
results are semantically identical, and at most the property insertion order of `issue.fields` differs,
which nothing reads.

**Drift note:** `before.md` §1.1 lists a third contributor, the report's own `fields` URL param. Both
implementations have since dropped it (`route-data.js:428`, `ChildReportConfig.js:322-330`). It is not in
the key.

### Tests

New `raw-issues-cache-key.test.ts`: same set / different order ⇒ same key; `['Status']` vs `[]` with maps
⇒ same key, vs `['customfield_1']` ⇒ different; `'Status'` vs `'status'` ⇒ same with maps, different
without (assert that this is the _conservative_ direction); each of `jql`, `childJQL`, `loadChildren`,
`isLoggedIn` changing ⇒ different key.

Plus a characterization test in `ChildReportConfig.test.js`: two configs whose `tableColumns` differ only
in order emit `allFieldsToRequest` arrays unequal as arrays but equal as canonical sets — the trap made
executable rather than asserted.

## Phase 1 — Singleflight (no TTL yet)

New `src/stateful-data/raw-issues-cache.ts`, holding
`Entry = { promise; progress; subscribers: Set<cb> }` in a `WeakMap<jiraHelpers, Map<key, Entry>>`.

Wire it into `getRawIssues` **after** the existing guards (`:103-116`), leaving the sample-data path
(`:103-106`, already module-cached at `src/examples/bitovi-training.js:12-27`) and the two `undefined`
returns untouched:

1. compute `key`, look it up in `cacheFor(jiraHelpers)`
2. **hit** → `join(entry, progressUpdate)`, return `entry.promise`
3. **miss** → build the entry, `join` this caller, **put it in the map**, _then_ call `loadIssues(...)`
   with `entry.progress`. Order matters: the loader runs synchronously to its first `await` and may
   already touch `progress`.
4. attach `entry.promise.then(onResolve, onReject)` for bookkeeping only. Subscribers get `entry.promise`
   itself, so the bookkeeping handler must not rethrow (that would be a second unhandled rejection).

`entry.progress` is a function with a mutable `.data`, which is what both loaders expect — each does
`progress.data = progress.data || {…}` (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:32-38`,
`makeDeepChildrenLoaderUsingNamedFields.ts:92-101`). Its body is `for (const s of subscribers) s(data)`.

**Error semantics.** A rejected fetch rejects every subscriber with the same reason (they share the
promise), and `onReject` **deletes the entry immediately** — a failure is never cached and the next mount
retries. The shared reason is read-only: `useReportLoadingState.ts:107-110` stores it and
`ChildReport.tsx:78-85` reads `.type` / `.errorMessages?.[0]`.

### Tests (new `src/stateful-data/jira-data-requests.test.js`)

With a call-counting fake `jiraHelpers`, as `state-helpers.test.js:43-50` and
`ChildReportConfig.test.js:249-256` already do:

- two identical calls ⇒ **one** underlying call; both resolve to the _same array identity_
- field lists differing only in order ⇒ still one call (the Phase 0 trap, end to end)
- different `jql` / `childJQL` / `loadChildren` ⇒ two calls each
- `loadChildren: true` picks the deep loader, once
- rejection ⇒ both callers reject with the same reason; a third call refetches; no unhandled-rejection
  warning when one subscriber attaches handlers late
- **mutation safety:** `Object.freeze` the resolved array, run `derivedIssuesRequestData` and
  `rollupAndRollback` over it, assert no throw (see §Mutation safety)

## Phase 2 — Progress fan-out, including late subscribers

The main implementation work. Today each caller gets its own `progressData` observable
(`state-helpers.js:32`) fed by its own arrow function (`:46-47`). Share a promise naively and only the
first caller's bar ever moves; the others sit at `null` until the whole load finishes.

**Fan-out.** `join(entry, cb)` adds `cb` to `entry.subscribers`; every `entry.progress(data)` invokes all
of them. Each subscriber's callback already shallow-copies before writing to its observable
(`state-helpers.js:47`), so no two configs share a snapshot object. Subscribers are cleared on settle.

**Late subscribers.** A report joining mid-flight must not wait for the next tick — under `loadChildren`
those can be seconds apart. On `join`, if `entry.progress.data` already exists, deliver it to the new
subscriber on a **microtask** (not synchronously: `getRawIssues` runs inside a `value.returnedBy`
recompute that has just set `progressData.value = null`, `state-helpers.js:34-51`, and re-entering that
recompute's own observable is avoidable risk for no gain). Guard the microtask on the subscriber still
being registered.

**What the UI consumes**, so one snapshot is provably sufficient: `useReportLoadingState` binds seven key
paths under `derivedIssuesRequestData.progressData.value` — `issuesRequested`, `issuesReceived`, `phase`,
`changeLogsRequested`, `changeLogsReceived`, `parentsToProcess`, `parentsProcessed`
(`useReportLoadingState.ts:55-94`) — plus the promise's settle state (`:100-114`). All seven live on the
one shared `ProgressData` object (`src/jira-oidc-helpers/types.ts:57-68`);
`LoadingProgressContainer.tsx:34-95` derives everything else from them.

**One accepted degradation.** `LoadingProgressContainer` snapshots the primary totals the first time it
_observes_ `phase === 'children'` (`:60-64`). A subscriber joining after that transition snapshots
mid-flight global totals as its "primary" numbers, so its first step reads inflated and its children bar
starts at zero. Monotonic and it resolves correctly; a real fix means letting the container take an
externally supplied snapshot, which is out of scope.

**Second progress consumer, flagged:** `useRawIssueRequestData.ts:18-19` reads
`rawIssuesRequestData.progressData.issuesReceived`, without the `.value` segment
`useReportLoadingState.ts:41-45` documents as mandatory. **[UNVERIFIED]** whether it resolves to anything
today; settled by logging it during a live load. Unchanged either way — this plan keeps one `progressData`
observable per config.

### The shared mutable progress object

`progress.data` is one object mutated in place across every concurrent and recursive call of a load
(`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:63-70`, `:107-114`;
`makeDeepChildrenLoaderUsingNamedFields.ts:92-116`). It carries a `Set`,
`keysWhoseChildrenWeAreAlreadyLoading`, whose job is to stop the deep walk revisiting a parent it has
already queued (`makeDeepChildrenLoaderUsingNamedFields.ts:11-18`, consumed at `:30-33`).

Request-sharing does not change its meaning: one shared request is still exactly **one walk**, hence one
Set scoped to that walk. Two rules keep it that way:

- **One progress object per fetch**, created with the entry and discarded when it settles. Never reused
  across keys or across a second load of the same key — a retained Set would make the next walk skip
  parents it genuinely needs to expand, silently returning fewer children.
- **The TTL cache (Phase 3) stores the resolved array only.** If a final snapshot is retained for the UI
  (below), strip the Set from it.

The shallow copy at `state-helpers.js:47` leaks the Set by reference into `progressData.value` — true
today, and harmless, since nothing in the UI reads it.

### Tests

- extend `state-helpers.test.js`: two `rawIssuesRequestData` instances over identical inputs ⇒ one
  underlying call, and **both** `progressData` observables advance on each tick
- a subscriber joining after two ticks gets the current counts on the next microtask, with no third tick
  emitted; a subscriber joining before any tick gets no phantom snapshot
- deep children: with a fake recording child JQLs, two identical `loadChildren` requests produce the same
  `ceil(P/40)` batches as one — not double
- extend `useReportLoadingState.test.tsx` with a second config driven off the same shared load

## Phase 3 — TTL on the resolved value

Singleflight covers requests overlapping in time. The TTL covers the tail: a document's children do not
all reach `getRawIssues` in the same microtask (each waits on its own `allFieldsToRequest`, gated on the
global `fieldsToRequest` and on that child's parsed `tableColumns`), so a fast load can resolve before a
sibling mounts.

**Decision: 30 s, timed from settle.**

- `makeCacheable`'s 1 s (`jira-data-requests.js:12`) is right for `getServerInfo` and wrong here — it is
  also timed from _call_, so a 40 s deep-children load would expire while still in flight.
- 30 s comfortably spans a document's mount cascade, which is the window that matters.
- It is far below any human "I changed something in Jira, let me look again" loop, and that loop goes
  through a page reload today, which clears an in-memory cache entirely.
- It bounds the one genuine staleness case: `jql` A → B → A inside 30 s serves the cached A.

Shape: one map, entries discriminated in-flight vs settled `{ value, expiresAt }`. Only fulfilments are
cached; `onReject` deletes. Optionally retain the last `ProgressData` (Set stripped) per settled key and
hand it to a cache-hit caller, so a late report shows a completed bar rather than an empty stepper for the
frame it exists.

**Escape hatch:** export `__clearRawIssuesCache()`. Nothing in production calls it; tests do, and it is the
hook a future Refresh button must call — worth a comment saying so, because nothing forces a reload today
(§What doesn't exist) and the next person to add one will not think to look here.

### Tests

`vi.useFakeTimers()`: a second call 5 s after settle ⇒ no new request, same array; 31 s after ⇒ new
request; the clock starts at settle (a 40 s fake load serves a joiner at t=39 s from the in-flight entry,
and the settled entry lives to t=70 s); a rejected load is never cached; `__clearRawIssuesCache()` forces
a refetch.

## Phase 4 — Prove it in a document

Extend `ChildReport.test.tsx` / `ChildReport.tableChild.test.tsx` (the latter already exercises the
Table-child wiring):

- three embedded reports with byte-identical saved `queryParams` ⇒ **one** call to the fake
  `fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields`; all three render and leave the loading
  state
- a Table + a Gantt over the same JQL where the Table's only extra column is core ⇒ still one fetch
  (core absorption, end to end)
- a third report with a genuinely different JQL ⇒ exactly two fetches, each with its own data (guards
  against an over-broad key)

## Verification

- `npm run typecheck`, `npm test`, `npm run build`.
- Credentialed (`npm start`): a document with four copies of one saved report should show, in the Network
  panel, one `approximate-count`, one `search/jql` cascade and one `changelog/bulkfetch` set for the whole
  document; all four bars move together and all four charts render identically. Repeat with
  `loadChildren` on, which is where the 429s live.
- Regression: a single report on its own page is unchanged; two documents with different JQLs do not
  cross-contaminate.

### Mutation safety

A shared array is only safe if no consumer writes to it. Audited:

- **The array** has two consumers: `derivedIssuesRequestData` calls `rawIssues.map(...)`
  (`state-helpers.js:149-153`), and `useRawIssueRequestData.ts:17` reads `.length`.
- **`normalizeIssue`** (`normalize.ts:32-103`) builds a fresh object, keeping the raw issue by reference at
  `:102`; it writes nothing to `issue`. **`deriveIssue`** (`derive.ts:21-34`) returns a spread.
- **`rollbackIssue`** (`rollback.ts:183-225`) copies rather than mutates — confirmed: destructures
  `{ changelog, ...rest }` at `:188`, shallow-copies `rolledBackIssue.fields = { ...issue.fields }` at
  `:204`, and every field handler returns a _new_ `{ [fieldName]: … }` `Object.assign`ed onto that copy
  (`:57-127`). Nested Sprint / Fix-version / Status values are shared by reference from lookup maps built
  out of the raw issues (`:138-170`), but only ever read.
- **The rollup pipeline** never sees the raw array; `rollupAndRollback` re-derives raw issues from the
  derived ones (`rollup-and-rollback.ts:41`, `:104-106`), and its `.sort()` / `.reverse()` calls all run
  on freshly built arrays (e.g. `rollup.ts:105`, `dates.ts:85-86`).

The Phase 1 freeze test is the standing guard against someone adding an in-place sort later.

## Optional extension: sharing the derived array — **follow-up, not this plan**

`normalizeIssue(raw, configuration)` and `deriveIssue(normalized, configuration)` are pure, and
`configuration` is `normalizeOptions`, a single global mirrored into every child
(`ChildReportConfig.js:286`). So the derived array is shareable too, keyed on
`(raw array identity, configuration identity)` — a `WeakMap<rawArray, WeakMap<config, DerivedIssue[]>>`
at `state-helpers.js:135-161`, needing no TTL because both keys are already lifetime-scoped.

Follow-up, for three reasons:

1. **It saves CPU, not requests.** The goal here is 429s. `before.md` §3.3 does rank the double
   normalize/derive above overlap for CPU, but that is _one report processing its own items twice_ — a
   different problem with a different fix.
2. **It widens the contract** from "the same bytes" to "the same object graph". Proving nothing writes to
   a shared `DerivedIssue` is nine rollup modules to audit, not the two consumers below.
3. **It gets strictly easier afterwards.** Once raw sharing lands, two identical reports already hold the
   _same array identity_, so the WeakMap hits with no key computation at all. Doing it first means
   building a second key.

## Risks and open questions

- **Subscriber lifetime.** `rawIssuesRequestData` never signals that a config went away, so a subscriber
  closure outlives a removed report until the load settles. Bounded by one in-flight load; not worth a
  disposal protocol.
- **[UNVERIFIED] — real-world hit rate.** `before.md`'s appendix flags that nobody has measured document
  overlap. This plan's premise — most embedded reports in a document are byte-identical — is the strongest
  form of that claim and equally unmeasured. Settled by one credentialed pass counting distinct cache
  keys, and the instrumentation is free once the key function exists (log `key` on miss).
- **A queue is still needed.** Dedupe removes duplicate cascades; it does nothing about a _single_
  `loadChildren` report issuing hundreds of unthrottled child requests (`before.md` §3.4). Sibling plan 2
  is what makes 429s recoverable rather than merely rarer.

## Out of scope

Partial-overlap dedupe; any concurrency limit, retry or `Retry-After` handling; the `expand=changelog`
fix; skipping approximate-count on child batches; the deep-children chunk size; sharing derived or
rolled-back data; any change to `TimelineReportViewModel` or the rollup pipeline; persistence across page
loads.
