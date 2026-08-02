# 016 — Report of Reports: optimization 1 — request dedupe

First of the sibling plans in [`../`](../), all measured against [`../before.md`](../before.md). Ranked by
value: **this one**, then a request queue with `Retry-After` backoff (deliberately not planned yet), then
[`../003-skip-child-approximate-count/`](../003-skip-child-approximate-count/),
[`../004-fix-search-expand-changelog/`](../004-fix-search-expand-changelog/), and
[`../005-partial-overlap-dedupe/`](../005-partial-overlap-dedupe/). Nothing here plans any of those.

> Line numbers verified against the working tree at `9093c94d` on `feat/table-report-improvements`.
> They drift with every commit; treat them as anchors to grep for, not addresses. Several `before.md`
> citations have drifted further and two of its claims are now stale — see §Key normalization and
> [`../README.md`](../README.md).

## Context

Production is returning Jira **429 rate-limit errors**. The goal is fewer HTTP requests; CPU and
allocation savings are secondary.

`before.md` Part 2 establishes why a document is the worst case: `ChildReport`
(`src/react/reports/ReportOfReports/components/ChildReport.tsx:58-61`) builds a `ChildReportConfig` per
embedded report, and each runs **its own** fetch through the same helpers the shell uses
(`ChildReportConfig.js:334-348`). Every node mounts in one pass and stays mounted when collapsed
(004-redesign), so N embedded reports start N complete pipelines at once, unthrottled and undeduped.

In practice most embedded reports in a document ask Jira the **same question** — a "Q3 status" document
is typically one JQL shown several ways. Those reports issue N near-identical cascades; with
`loadChildren` over 1000 parents that is N × (count + search + changelog bulkfetch + ~25 recursive child
batches, each with its own three calls) — hundreds of avoidable requests per page load.

Two separate things stop those cascades collapsing today, and this plan fixes both:

1. **Nothing dedupes identical requests.** There is no cache on `getRawIssues`, so two byte-identical
   requests issue two cascades. → Phases 2–3.
2. **Requests that ask the same question aren't identical.** Reports over one JQL differ in their
   requested **field list**, because a Table report contributes its shown columns' fields and a Gantt
   contributes none. → Phase 1.

Fixing only (1) leaves money on the table. Take a typical document: five reports on one JQL, three
needing only core fields, two Tables each adding one custom field.

|                                | fetches                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| today                          | 5                                                                 |
| dedupe alone (Phases 2–3)      | 3 — the three core-only reports collapse, each Table stands alone |
| dedupe + field union (Phase 1) | **1**                                                             |

### Why identical-request sharing is safe where partial overlap is not

`before.md` §1.4 and Part 4 name the trap: rollup folds children into parents, so a report holding a
_different_ set of work items gets _different dates and statuses on the rows it does show_. The mechanism
is `addRollups` (`src/jira/rolledup-and-rolledback/rollup-and-rollback.ts:66-86`), reached from
`rollupAndRollback` (`:34-63`). Membership defines the output.

That trap needs a _membership difference_ to fire, and nothing in this plan produces one: every
subscriber receives the same array of the same work items it would have fetched alone. Downstream,
`derivedIssuesRequestData` maps that array (`state-helpers.js:149-153`) and each report's own
`TimelineReportViewModel` rolls up with its own settings. Only the request count changes.

The shared artifact is the first row of `before.md`'s shareable table — "the raw fetch per work item id".
Its caveat there, "field sets differ per report", is what Phase 1 removes and what the Phase 0 cache key
handles when Phase 1 can't.

### This is **not** partial-overlap dedupe

Phase 1 widens the requested **field projection** so that reports asking the same question send the same
bytes. It never touches `jql`, `childJQL` or `loadChildren`, so the set of work items returned is exactly
what each report would have fetched alone. That is a different operation from sibling plan 5, which shares
work between reports whose _queries_ differ and therefore has to reason about membership. A reader
arriving from plan 5 will flinch at "share one fetch between two reports"; the distinction is that here
membership is identical by construction and only the column projection moves.

## What already exists

| Thing                                                                                                     | Where                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The single fetch entry point, every input in scope as a plain value; the flat / deep fork lives inside it | `src/stateful-data/jira-data-requests.js:100-131`, fork at `:118-120`                                                                     |
| Its only call site                                                                                        | `src/canjs/controls/timeline-configuration/state-helpers.js:36`                                                                           |
| `CORE_FIELDS`, folded into the request and exported                                                       | `jira-data-requests.js:81-93`, `:98`, `:112`                                                                                              |
| A caching precedent (1 s TTL)                                                                             | `jira-data-requests.js:12-26`, used at `:37` and `:45`                                                                                    |
| Canonical field-id helpers — name↔id collapsing, `CORE_FIELDS` absorption                                | `src/canjs/routing/route-data/requested-fields.ts:25`, `:33`, `:55`                                                                       |
| Per-config progress observable and its update callback                                                    | `state-helpers.js:32`, `:46-47`                                                                                                           |
| What the loading UI reads (seven keys under `progressData.value`)                                         | `useReportLoadingState.ts:54-94`                                                                                                          |
| The document's child roster: the `sections` tree and the saved-report lookup                              | `model/sections.ts:32` (`SavedReportNode`), `ReportOfReports.tsx:223`, `services/reports/useAllReports.ts` (already a `useSuspenseQuery`) |
| Per-child param parsers, including `tableColumns`                                                         | `ChildReportConfig.js` `CHILD_PARAMS` at `:77-193`; `tableColumns` at `:151`                                                              |
| The pure column → required-fields registry                                                                | `TableReport/model/builtinFieldRegistry.ts:267-272` (`requiredFieldsFor`)                                                                 |
| Name↔id maps hanging off the helpers, already in `FieldMaps` shape                                       | `jira-oidc-helpers/index.ts:68` sets `jiraHelpers.fields`, which spreads `deriveFieldMaps` (`fields.ts:74`)                               |
| A document-wide React context precedent                                                                   | `components/DocumentEditing.tsx`                                                                                                          |
| Call-counting fake-`jiraHelpers` test pattern                                                             | `ChildReportConfig.test.js:246-266`, `state-helpers.test.js:43-50`                                                                        |

## What doesn't exist

- **No cache on `getRawIssues`.** `before.md` §1.2 says so and it is still true at `:100`.
- **`makeCacheable` cannot be reused as-is.** It is argument-blind: `makeRequest(...args)` returns
  `cachePromise` without ever looking at `args` (`jira-data-requests.js:15-25`). It also starts its
  timer at call time, not at settle time. Fine for `getServerInfo`, useless for a keyed issue cache.
- **No test file for `src/stateful-data/jira-data-requests.js`.** The directory holds only `login.test.js`.
- **No way for the app to force a data reload.** The only refetch triggers are the four observables
  `rawIssuesRequestData` listens to (`state-helpers.js:34-51`, wired at `route-data.js:286-299` and
  `ChildReportConfig.js:334-348`). There is no Refresh button anywhere; site switching does a hard page
  reload (`src/react/SelectCloud/SelectCloud.tsx`). So a TTL cache needs no escape hatch for parity with
  today — only one for tests and for whoever adds that button later.
- **No shared parser for a child's `queryParams`.** The `CHILD_PARAMS` specs are module-private to
  `ChildReportConfig.js`, so nothing outside the class can ask "what query does this saved report run?"
  Phase 0 exports them and adds one.

## Decisions (locked with the user)

- **Reduce request count.** CPU/allocation is secondary.
- **`getRawIssues` is the choke point for the dedupe**, not the request helpers and not
  `rawIssuesRequestData` (argued below).
- **The document is the choke point for the field union** — not a debounce and not a request barrier
  (argued below).
- **The 40-parent chunk at `makeDeepChildrenLoaderUsingNamedFields.ts:34` is a real, empirically
  verified Jira limit.** Untouched here.
- **Sibling plan 2 (queue + `Retry-After`) is deliberately unplanned.** This plan must not grow a queue.
- **Singleflight is the load-bearing part; the TTL is a safety net.**
- **Documents really do reuse one query across their reports.** Counted by the user, not assumed. Earlier
  drafts carried an `[UNVERIFIED]` flag on this, inherited from `before.md`'s appendix and repeated by
  plan 5. That flag belongs to a different question — how much _partially overlapping_ queries share —
  and did not apply here. Retired.
- **Field-set deltas between reports in a document are small and mostly core.** Reports add a field or
  two on top of a largely core set; big disjoint field sets do not occur in practice. Two consequences,
  both deliberate:
  - **No page-size measurement.** A wider field list means a larger per-issue payload, and Jira's
    token-paginated `/search/jql` may cap a page by response size (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:78-101`
    asks for 5000 and loops on `nextPageToken`), which would trade fetches for pages. With deltas of a
    field or two there is nothing for such a cap to bite on. Not measured, by decision. If request counts
    ever look wrong on a large-JQL document, this is the first thing to check: compare `maxResults` sent
    against `issues.length` returned per page.
  - **No cap on union size.** A guard against a pathological group (one report dragging in 40 custom
    fields) is unnecessary complexity given the premise.

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

### Where the field union is computed, and what was rejected

**Chosen: the document, from its static roster (Phase 1).** A child's requested field list is a pure
function of its saved `queryParams`: `allFieldsToRequest = fieldsToRequest ∪ tableColumnFields`
(`ChildReportConfig.js:322-330`), where `fieldsToRequest` is global (`sharedFromParent`, `:288`) and
`tableColumnFields` is `tableColumns.flatMap(requiredFieldsFor)` (`:310-315`) over `tableColumns` parsed
synchronously from `queryParams` (`:151`). The document holds every child's `queryParams` before it
renders any of them, so the union is computable from structure with no coordination at all.

**Rejected: a debounce inside `getRawIssues`.** Tempting, and it would mostly work — children _do_ all
reach `getRawIssues` in one synchronous task, because they bind in one commit's effect flush
(`useCanObservable.ts`, subscription in `useEffect`) and, when `fieldsToRequest` has not resolved yet,
they are all released by a single shared promise (`route-data.js:383-388`). But it makes the request count
a function of arrival order. `registry.ts:17` names `React.lazy` code-splitting per report as the intended
future seam; the moment a report is lazily imported it misses the window and its group splits silently. It
also adds a tick to every load including a single report on its own page, and which tick suffices
(microtask vs macrotask, given CanJS's queues) is a tuning question the static version doesn't have.

**Rejected: a request barrier at the document** — trap each child's request, wait for all N to register,
then group and union. Strictly better than a debounce, because the wait is bounded by a known roster
rather than a guessed interval. But it still needs a timeout for a child that never registers, and that
timeout re-introduces the timing dependence it removed. It builds a coordination protocol to discover
something no request has to announce.

**Rejected: a union request across different queries.** That is partial-overlap dedupe, sibling plan 5,
and it walks straight into the membership trap. Phase 1 is not that — see §This is not partial-overlap
dedupe.

---

## Phase 0 — Shared primitives (pure, no behaviour change)

Three pure functions, in one phase because they are one definition of "the same question," consumed by
both the grouping in Phase 1 and the cache in Phase 2. If those two definitions ever disagree, Phase 1
widens every request and Phase 2 dedupes nothing — cost with no benefit, and silent.

### `queryKeyOf` and `rawIssuesCacheKey`

New module `src/stateful-data/raw-issues-cache-key.ts`. TypeScript imported from `.js` with an explicit
extension, as `route-data.js:7-12` already does.

```ts
queryKeyOf({ jql, childJQL, loadChildren }): string
rawIssuesCacheKey({ isLoggedIn, loadChildren, jql, childJQL, fields }, maps?: FieldMaps): string
```

`rawIssuesCacheKey` is `[loginTag, queryKeyOf(...), canonicalFields]`:

```
[ isLoggedIn === false ? 'sample' : 'jira',
  queryKeyOf({ jql, childJQL, loadChildren }),
  [...canonicalFieldIdSet([...fields, ...CORE_FIELDS], maps)].sort() ]
```

`queryKeyOf` deliberately excludes `isLoggedIn`: it is global to the page, so it cannot distinguish two
children of one document, and the document-layer grouping has no use for it. The cache key keeps it as
cheap insurance — the `isLoggedIn === false` path returns before the cache (`:103-106`), so the tag only
ever separates `true` from not-yet-known, which produce identical requests anyway.

The invariant: **the key must be a function of what will actually be sent, computed by the same rule the
sender uses.** Both senders resolve identifiers with `nameMap[f] || f` (`src/jira-oidc-helpers/jira.ts:547`
for the flat path, `makeDeepChildrenLoaderUsingNamedFields.ts:89` for the deep one), which is exactly
`toFieldId` (`requested-fields.ts:25-29`).

**Where `maps` comes from: `jiraHelpers.fields`, read inside `getRawIssues`.** Do not plumb `fieldMaps`
down from route-data — `getRawIssues` already holds `jiraHelpers`, and `jiraHelpers.fields` is set to a
`FieldsData` that spreads `deriveFieldMaps(fields)` (`jira-oidc-helpers/index.ts:68`, `fields.ts:74`), so it
already satisfies the `FieldMaps` interface (`nameMap`, `idMap`). It is `undefined` until the fields request
resolves, which is exactly the `maps?` optional case. Reading it off the same object the senders read it off
is what keeps the key honest.

`jiraHelpers` is **not** in the string. The cache is a `WeakMap<jiraHelpers, Map<key, Entry>>`, so a
different site physically cannot hit another site's entries, and the map is collected with the helpers.

### `parseChildQuery`

New module `src/react/reports/ReportOfReports/model/childParams.js`:

```js
parseChildQuery(queryParams); // → { jql, childJQL, loadChildren, tableColumns }
```

It **imports `CHILD_PARAMS` from `ChildReportConfig.js`** (adding an `export` to the existing `const`) and
applies the same `parse(raw ?? defaultRaw)` rule `childParam` uses (`ChildReportConfig.js:224-241`). One
parser, one direction of import, no cycle. Not cosmetic: if the document parses a child's query differently
from how the child parses it, groups are computed off the wrong values and split — with nothing thrown and
nothing rendered wrong.

**Do not move `CHILD_PARAMS` into the new module**, which an earlier draft called for. The specs close over
`string/boolean/list/json/isoDate/number`, `isValidIsoDateString`, `REPORTS`, `ROUND_OPTIONS`,
`_15DAYS_IN_S` and four date utils — effectively all of `ChildReportConfig.js:1-193` — and the file also
exports `CHILD_PARAM_KEYS`, consumed by the param-drift test (`ChildReportConfig.test.js:355`, `:372`,
`:382`). Moving it buys nothing the export doesn't.

### Key normalization is a real trap, not a formality

`allFieldsToRequest` is a `[...new Set(...)]` union in both places:

|       | source                                                     | line                       |
| ----- | ---------------------------------------------------------- | -------------------------- |
| shell | `[...new Set([...baseFields, ...this.tableColumnFields])]` | `route-data.js:428`        |
| child | `[...new Set([...baseFields, ...this.tableColumnFields])]` | `ChildReportConfig.js:329` |

**A `Set` preserves insertion order, so the array's order is data.** `baseFields` is `fieldsToRequest`,
global and mirrored to children (`ChildReportConfig.js:288`), so it contributes the same prefix
everywhere. `tableColumnFields` does not: it is **ordered by the report's column order** — the thing users
drag around. Two Table reports over the same JQL with the same columns in a different order produce
different arrays for the same set, and an unsorted key silently misses the dedupe.

Sorting alone is not enough, because the two contributors live in different identifier spaces:
`fieldsToRequest` and `CORE_FIELDS` are display **names** (`jira-data-requests.js:81-93`), while
`requiredFieldsFor` returns field **ids** (`builtinFieldRegistry.ts:267-272` — `field:<id>` → `id`, plus
facet `requires` entries such as `'project'`). Hence `canonicalFieldIdSet` rather than a raw sort, which
buys two more hits for free: **core absorption** (a Table whose only column is Status asks `['Status']`, a
Gantt over the same JQL asks `[]`; `Status` is core at `:87`, so both send the same id set) and **name vs
id** (`Status` and `status` collapse). Before the field maps load, `toFieldId` passes identifiers through
unchanged (`requested-fields.ts:25-29`) — that can only _miss_ a dedupe, never create a false one.

That last case is the likeliest way this ships and quietly under-delivers: an early child keys on
`'Status'` and a later one on `'status'` because `jiraHelpers.fields` resolved in between. See §Risks.

**Do not sort what is actually sent.** Wire order is irrelevant to Jira, `getRawIssues:112` already derives
the sent list deterministically, and the response is re-keyed by display name via `mapIdsToNames`
regardless. Sorting the payload is a request-shape change for zero gain. Consequence for the record: two
reports differing only in field order share the _first_ caller's array; the id sets are equal so the
results are semantically identical, and at most the property insertion order of `issue.fields` differs,
which nothing reads.

**Drift note:** `before.md` §1.1 lists a third contributor, the report's own `fields` URL param. Both
implementations have since dropped it (`route-data.js:428`, `ChildReportConfig.js:322-330`). It is not in
the key — and Phase 1's roster must be updated in step if a third contributor is ever added back.

### Tests

New `raw-issues-cache-key.test.ts`: same set / different order ⇒ same key; `['Status']` vs `[]` with maps
⇒ same key, vs `['customfield_1']` ⇒ different; `'Status'` vs `'status'` ⇒ same with maps, different
without (assert that this is the _conservative_ direction); each of `jql`, `childJQL`, `loadChildren`,
`isLoggedIn` changing ⇒ different key; `queryKeyOf` ignores `fields` entirely.

New `childParams.test.js`: `parseChildQuery` agrees with a `ChildReportConfig` built from the same
`queryParams`, for all four keys — the anti-drift assertion.

Plus a characterization test in `ChildReportConfig.test.js`: two configs whose `tableColumns` differ only
in order emit `allFieldsToRequest` arrays unequal as arrays but equal as canonical sets — the trap made
executable rather than asserted.

## Phase 1 — The field union

Four layers. Nothing here changes the number of requests on its own; it changes the _field lists_ so
Phase 2's key matches more often. It fails safe in every direction: no context, a singleton group, an
unresolvable report or a bad parse all yield today's behaviour.

```
ReportOfReports ──┬─ useReportLayout() → sections (tree)
                  └─ useAllReports()   → Report[]  (already suspense-cached)
                        │
   1. ROSTER  ──────────▼── childQueryGroups(sections, reports) → Map<queryKey, string[]>
                        │
   2. CONTEXT ──────────▼── <ChildQueryGroupsProvider>   (recursive render untouched)
                        │
   3. CONFIG  ──────────▼── new ChildReportConfig({ …, tableColumnFieldsOverride })
                        │
   4. FETCH   ──────────▼── allFieldsToRequest → rawIssuesRequestData → getRawIssues  (unchanged)
```

**1 — Roster.** New pure module `model/childQueryGroups.ts`:

1. Walk `sections` for `SavedReportNode`s, recursing into `SectionNode.children` (`sections.ts:32-38`).
   Skip `InlineReportNode` and `UnknownNode` — neither fetches issues.
2. Resolve each `params.reportId` against `useAllReports()`. Unresolvable ids render `MissingReportNote`
   instead of a `ChildReport` (`ReportOfReports.tsx:258-260`), so they never fetch and contribute nothing.
3. `parseChildQuery(report.queryParams)` per child; group by `queryKeyOf(...)`.
4. For each group with **≥2 members**, build the **sorted** union of `requiredFieldsFor(sourceId)` across
   every member's `tableColumns`.

Returns multi-member groups only. Sorting is not optional: a `Set` built in tree order differs per group
member, which is the same insertion-order trap Phase 0 documents. Phase 0's canonicalization would rescue
it, but do not lean on that.

Settled, so no one re-derives it: `tableColumns` has a non-empty _default_
(`[{ sourceId: 'identity:treeSummary' }]`, `:151`), so even a Gantt child parses to one column — but
`requiredFieldsFor('identity:treeSummary')` returns `[]`. `identity:*` is not in `FACET_BY_SOURCE_ID` and
does not start with `field:`, so it falls through both branches (`builtinFieldRegistry.ts:267-272`,
documented at `:261`). The default column widens nothing.

**Return arrays that are referentially stable across renders** — see the memoization trap in step 3.

**2 — Context.** New `components/ChildQueryGroups.tsx`, mirroring `DocumentEditing.tsx`. Context rather
than a prop because the document renders recursively (`ReportOfReports.tsx:183`) and a prop would thread
through `SectionNode` at every depth. `ChildReport` consumes it and performs **its own** lookup — it
already holds `report`, so it computes `queryKeyOf(parseChildQuery(report.queryParams))` and reads the
map. Consequence: the recursive render code does not change at all; you add a provider at the top and a
lookup in one leaf.

Default context value is an empty map, so `ChildReport` rendered outside a document (its own tests) and
the shell's primary report are unaffected with no conditionals. `React.memo` at `ChildReport.tsx:128`
still works — context updates re-render consumers regardless of memo — and the shallow-compare
justification in its comment stays valid, since no prop is added.

**The provider must memoize the map**, and step 1 must return stable arrays inside it. Step 3 says why.

**3 — Config.** `ChildReportConfig` gains `tableColumnFieldsOverride: { enumerable: false, default: null }`,
mirroring `parent` (`:278-279`), and:

```js
get tableColumnFields() {
  if (this.tableColumnFieldsOverride) return [...this.tableColumnFieldsOverride];
  return (this.tableColumns || [])           // unchanged
    .map((entry) => entry && entry.sourceId)
    .filter((sourceId) => typeof sourceId === 'string')
    .flatMap((sourceId) => requiredFieldsFor(sourceId));
}
```

**`tableColumns` itself is never overridden.** The report renders exactly the columns it was saved with;
only what gets _loaded_ widens. Override the load, never the view — that separation is the invariant the
whole phase rests on. `allFieldsToRequest` (`:322-330`) and `rawIssuesRequestData` (`:334-348`) are
untouched.

#### The memoization trap — the one way this phase can do real damage

`ChildReport` builds its config in a `useMemo` keyed on `[report.queryParams, parent]`
(`ChildReport.tsx:58-61`). Passing the override to the constructor has two failure modes, and they point
opposite ways:

- **Override omitted from the deps** → the config is built once, before or without it, and the override
  never applies. Silent no-op, i.e. the fail-safe direction.
- **Override in the deps but rebuilt every render** → a **new `ChildReportConfig`, a new
  `rawIssuesRequestData`, and therefore a new fetch, on every render.** A document re-renders on every
  hover change (that is precisely why `ChildReport` is memoized, `:117-127`), so this turns a plan about
  _reducing_ requests into an unbounded request loop. Phase 2's cache would absorb some of it and mask how
  bad it is.

So: `childQueryGroups` returns a `Map` whose values are stable arrays, the provider memoizes that `Map` on
`[sections, reports]`, and `ChildReport` adds the looked-up array to its `useMemo` deps. The array's
identity is then stable for as long as the roster is. Assert it: a test that re-renders the document with
an unrelated state change and checks the underlying fetch count is still 1.

#### Why a _static_ override is safe

The override is computed once from saved `queryParams` and never recomputed against the child's live
`tableColumns`. That is only sound because **an embedded child cannot change its columns**: the column
picker lives in `TableReportControls`, mounted only from the shell's control strip
(`ReportControls.tsx:264`) and from stories, while `ChildReport` renders `<PrimaryReport {...props} />`
alone (`:114`). A child's `tableColumns` is therefore immutable after mount, and a load-time override
cannot go stale.

**If a child ever gets its own controls, this breaks** — a column added at runtime would set
`tableColumns`, `tableColumnFields` would keep returning the stale override, the new column's field would
never load, and it would render empty. The fix then is `override ∪ own`, not `override`. Noted here
because nothing in the code will remind you.

**4 — Fetch.** Unchanged.

### It cannot make things worse

When a group's field deltas are all core, the override produces a _different array_ than today but the
_same canonical id set_, so Phase 2's key already matched and the fetch count is unchanged. The override
only alters behaviour where it helps. There is no "wrong grouping makes things worse" mode — only a
"wrong grouping does nothing" mode. That is what makes shipping this without a page-size measurement
defensible.

### One thing to grep for

Every report in a group now loads fields it does not render. Fine as long as no UI enumerates fields from
_loaded issues_ rather than from the field catalog. The two that mattered are clear — Table columns come
from saved `tableColumns`, and the column picker comes from `useJiraIssueFields` (a separate
`useSuspenseQuery`) — but grep for iteration over `issue.fields` (as opposed to keyed lookup) during
implementation.

### Tests

- `childQueryGroups.test.ts`, pure: a `sections` tree + reports ⇒ the expected map; singleton groups
  excluded; unresolvable reports skipped; nested sections walked; the union sorted; `InlineReportNode` and
  `UnknownNode` ignored.
- Stability: re-rendering the document with an unrelated state change does not rebuild any child's config
  or issue a second fetch — the memoization trap made executable.
- `ChildReportConfig.test.js`: with an override set, `tableColumnFields` returns it and `tableColumns` is
  unchanged; two configs with _different_ `tableColumns` but one shared override emit **equal**
  `allFieldsToRequest`. That is this phase's own success condition and needs no cache to assert.
- Without an override, every existing `ChildReportConfig` field test still passes — the fail-safe path.

## Phase 2 — Singleflight and progress fan-out

Where request counts actually drop, and where the risk lives.

New `src/stateful-data/raw-issues-cache.ts`, holding
`Entry = { promise; progress; subscribers: Map<owner, cb>; expiresAt: number | null }` in a
`WeakMap<jiraHelpers, Map<key, Entry>>`. `expiresAt` stays `null` until Phase 3.

Wire it into `getRawIssues` **after** the existing guards (`:103-116`), leaving the sample-data path
(`:103-106`, already module-cached in `src/examples/bitovi-training.js`) and the two `undefined` returns
untouched:

1. if `!jiraHelpers`, skip the cache entirely — a `WeakMap` lookup on a non-object throws, and today a
   missing `jiraHelpers` throws one line later at `:119`, i.e. _after_ the `!fields` / `!jql` guards have
   had their chance to return `undefined`. Do not move that throw earlier.
2. compute `key`, look it up in `cacheFor(jiraHelpers)`
3. **hit** → `join(entry, owner, progressUpdate)`, return `entry.promise`
4. **miss** → build the entry, `join` this caller, **put it in the map**, _then_ call `loadIssues(...)`
   with `entry.progress`. Order matters: the loader runs synchronously to its first `await` and may
   already touch `progress`.
5. attach `entry.promise.then(onResolve, onReject)` for bookkeeping only. Subscribers get `entry.promise`
   itself, so the bookkeeping handler must not rethrow (that would be a second unhandled rejection).

`entry.progress` is a function with a mutable `.data`, which is what both loaders expect — each does
`progress.data = progress.data || {…}` (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:32-39`,
`makeDeepChildrenLoaderUsingNamedFields.ts:92-101`). Its body is
`for (const cb of subscribers.values()) cb(data)`.

**Subscribers are keyed, not appended.** `rawIssuesPromise` builds a **new** arrow closure on every
recompute (`state-helpers.js:46-47`), and a config can legitimately recompute onto the same key — e.g. a
Table child adding a core column, since the child's `allFieldsToRequest` has no `sameRequestedFields` gate
(`ChildReportConfig.js:322-330`) where route-data's does (`route-data.js:422-433`). Appending would
register a second closure for the same observable, so every tick would write it twice and re-render twice.
The entry therefore keys subscribers by a stable owner token.

**The owner token is the `progressData` observable** created at `state-helpers.js:32`. It is the only thing
in scope that is one-per-config _and_ stable across recomputes: `rawIssuesRequestData` is a module-level
function shared by every config, and the `rawIssuesPromise` closure is rebuilt on each recompute — the very
problem being solved. It is also the right identity semantically, since the subscriber's whole job is to
write to it. Subscribers are cleared on settle.

**This changes `getRawIssues`'s second argument** from `{ progressUpdate }` to `{ progressUpdate, owner }`.
`state-helpers.js:45-49` is the only caller, so the change is local; `owner` is optional and a call without
one falls back to the `progressUpdate` function itself as its own key, which preserves today's behaviour
for any future caller that doesn't know about the cache.

**Bonus, premise-independent:** that same ungated getter means a child refetches today when a core column
is added, where the shell would not. The cache turns that into a hit. This win does not depend on any
document containing two similar reports.

**Error semantics.** A rejected fetch rejects every subscriber with the same reason (they share the
promise), and `onReject` **deletes the entry immediately** — a failure is never cached and the next mount
retries. The shared reason is read-only: `useReportLoadingState.ts:107-110` stores it and
`ChildReport.tsx:104-105` reads `.type` / `.errorMessages?.[0]`. Note the widened blast radius: one 429 now
rejects every report that joined that fetch, where today it would break one. Sibling plan 2 is what makes
that recoverable rather than merely rarer.

### Progress fan-out, including late subscribers

Today each caller gets its own `progressData` observable (`state-helpers.js:32`) fed by its own arrow
function (`:46-47`). Share a promise naively and only the first caller's bar ever moves; the others sit at
`null` until the whole load finishes.

**Fan-out.** `join(entry, owner, cb)` sets `subscribers[owner] = cb`; every `entry.progress(data)` invokes
all of them. Each subscriber's callback already shallow-copies before writing to its observable
(`state-helpers.js:47`), so no two configs share a snapshot object.

**Late subscribers.** A report joining mid-flight must not wait for the next tick — under `loadChildren`
those can be seconds apart. On `join`, if `entry.progress.data` already exists, deliver it to the new
subscriber on a **microtask** (not synchronously: `getRawIssues` runs inside a `value.returnedBy`
recompute that has just set `progressData.value = null`, `state-helpers.js:34-51`, and re-entering that
recompute's own observable is avoidable risk for no gain). Guard the microtask on the entry not having
settled.

**What the UI consumes**, so one snapshot is provably sufficient: `useReportLoadingState` binds seven key
paths under `derivedIssuesRequestData.progressData.value` — `issuesRequested`, `issuesReceived`, `phase`,
`changeLogsRequested`, `changeLogsReceived`, `parentsToProcess`, `parentsProcessed`
(`useReportLoadingState.ts:54-94`) — plus the promise's settle state (`:100-114`). All seven live on the
one shared `ProgressData` object (`src/jira-oidc-helpers/types.ts`); `LoadingProgressContainer.tsx:34-95`
derives everything else from them.

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
(`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:63-71`, `:112-127`;
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

### Tests (new `src/stateful-data/jira-data-requests.test.js`)

With a call-counting fake `jiraHelpers`, as `ChildReportConfig.test.js:246-266` and
`state-helpers.test.js:43-50` already do:

- two identical calls ⇒ **one** underlying call; both resolve to the _same array identity_
- field lists differing only in order ⇒ still one call (the Phase 0 trap, end to end)
- different `jql` / `childJQL` / `loadChildren` ⇒ two calls each
- `loadChildren: true` picks the deep loader, once
- a missing `jiraHelpers` behaves exactly as today (throws at the same place, not earlier)
- rejection ⇒ both callers reject with the same reason; a third call refetches; no unhandled-rejection
  warning when one subscriber attaches handlers late
- **mutation safety:** `Object.freeze` the resolved array, run `derivedIssuesRequestData` and
  `rollupAndRollback` over it, assert no throw (see §Mutation safety)

And in `state-helpers.test.js`:

- two `rawIssuesRequestData` instances over identical inputs ⇒ one underlying call, and **both**
  `progressData` observables advance on each tick
- one config recomputing onto the same key ⇒ still one subscriber for it, so a tick writes its observable
  once (the keyed-subscriber rule)
- a subscriber joining after two ticks gets the current counts on the next microtask, with no third tick
  emitted; a subscriber joining before any tick gets no phantom snapshot
- deep children: with a fake recording child JQLs, two identical `loadChildren` requests produce the same
  `ceil(P/40)` batches as one — not double
- extend `useReportLoadingState.test.tsx` with a second config driven off the same shared load

> **As built:** Phases 2 and 3 landed as one module, `raw-issues-cache.ts`, because they are one
> `Entry` and one lookup path — see "Shape: one entry, not two" below. `__clearRawIssuesCache` shipped
> with Phase 2 rather than Phase 3, since every test in both phases needs it. Also as built:
> `CORE_FIELDS` moved to `core-fields.ts` (re-exported from `jira-data-requests.js`, so no importer
> changed) — the key module folds it into a key, and importing it from the module that imports the key
> module would be a cycle.

## Phase 3 — TTL on the resolved value

Singleflight covers requests overlapping in time, which — given how children are released (see §Where the
field union is computed) — is the whole mount cascade. The TTL covers what that misses: a report **added
or remounted later**. `ReportOfReports.tsx:179` and `:252` both note that a remounted `ChildReport`
refetches from Jira, which is exactly the case a settled entry absorbs.

> Earlier drafts justified the TTL with "children do not all reach `getRawIssues` in the same microtask,
> each gated on its own parsed `tableColumns`." That is wrong: `tableColumns` is parsed synchronously at
> `ChildReportConfig.js:151`, and `fieldsToRequest` is a single shared promise that _synchronises_
> children rather than staggering them. The TTL still earns its place, for the reason above.

**Decision: 30 s, timed from settle.**

- `makeCacheable`'s 1 s (`jira-data-requests.js:12`) is right for `getServerInfo` and wrong here — it is
  also timed from _call_, so a 40 s deep-children load would expire while still in flight.
- 30 s comfortably spans adding a report to an open document, which is the window that matters.
- It is far below any human "I changed something in Jira, let me look again" loop, and that loop goes
  through a page reload today, which clears an in-memory cache entirely.
- It bounds the one genuine staleness case: `jql` A → B → A inside 30 s serves the cached A.

**Shape: one entry, not two.** Keep the Phase 2 `Entry` and set `expiresAt` on settle; do not introduce a
separate settled `{ value, expiresAt }` variant. One lookup path, and a TTL hit returns the _original_
promise, which preserves array identity across the hit — the follow-up derived-array `WeakMap` below wants
exactly that. Only fulfilments get an `expiresAt`; `onReject` deletes.

Optionally retain the last `ProgressData` (Set stripped) on the entry and deliver it to a cache-hit
caller, so a late report shows a completed bar rather than an empty stepper for the frame it exists.
`LoadingProgressContainer` survives the un-retained case (`?? 0` at `:71-74`), so this is cosmetic.

**Escape hatch:** export `__clearRawIssuesCache()`. Nothing in production calls it; tests do, and it is the
hook a future Refresh button must call — worth a comment saying so, because nothing forces a reload today
(§What doesn't exist) and the next person to add one will not think to look here.

### Tests

`vi.useFakeTimers()`: a second call 5 s after settle ⇒ no new request, same array; 31 s after ⇒ new
request; the clock starts at settle (a 40 s fake load serves a joiner at t=39 s from the in-flight entry,
and the settled entry lives to t=70 s); a rejected load is never cached; a TTL hit yields the same promise
identity; a TTL-hit report reaches `resolved` and renders with all progress counts `undefined`;
`__clearRawIssuesCache()` forces a refetch.

## Phase 4 — Prove it in a document

**Write this phase's first test before Phases 1–3.** It is the only executable statement of what the whole
plan is _for_. Every other test checks one layer in isolation, and all of them can pass while the feature
saves zero requests — failures like "`queryKeyOf` edited without updating the grouping" or "the provider
stops reaching a `ChildReport`" break no layer, only the composition between them. This is the one
assertion downstream of the entire chain.

New document-level test (not an extension of `ChildReport.tableChild.test.tsx`, which renders a single
child — the provider is document-level). A fake `jiraHelpers` recording every call, per
`ChildReportConfig.test.js:246-266`:

```
two saved reports, both jql=project = ORDER
  - primaryReportType=start-due                                    (contributes no extra fields)
  - primaryReportType=table, tableColumns=[{sourceId:'field:customfield_1'}]   (NON-core)

expect(requested).toHaveLength(1);                        // 1. the dedupe fired
expect(requested[0].fields).toContain('customfield_1');   // 2. via the union, not by dropping a field
expect(reportCards()).toHaveLength(2);                    // 3. both reports still render
```

All three assertions are load-bearing. Without (2), a bug that simply ignores the Table's columns also
yields one fetch — you would have "deduped" by not loading a field the Table needs, and its custom column
would render empty. Without (3), a child that is broken and never fetches also yields one fetch. The
column must be **non-core**: with a core column Phase 0's canonicalization already dedupes and the test
proves nothing about Phase 1.

Assert on the **id** `customfield_1`, not on a display name. `requiredFieldsFor('field:customfield_1')`
strips the `field:` prefix and returns the id (`builtinFieldRegistry.ts:270`), the union carries ids
through unchanged, and `getRawIssues` passes the list to the loader as-is — the name→id resolution
(`nameMap[f] || f`) happens further down, inside the helper the fake replaces. An earlier draft asserted
`'Story points'` here; that is the wrong side of that boundary and the test would fail.

Then the rest of the suite:

- three embedded reports with byte-identical saved `queryParams` ⇒ one call; all three render and leave
  the loading state
- a Table + a Gantt over the same JQL where the Table's only extra column is **core** ⇒ still one fetch
  (core absorption, no union needed)
- a third report with a genuinely different JQL ⇒ exactly two fetches, each with its own data (guards
  against an over-broad key, and against the union crossing group boundaries)

## Verification

- `npm run typecheck`, `npm test`, `npm run build`.
- Credentialed (`npm start`): a document with several reports over one JQL should show, in the Network
  panel, one `approximate-count`, one `search/jql` cascade and one `changelog/bulkfetch` set for the whole
  document; every bar moves together and every chart renders. Repeat with `loadChildren` on, which is
  where the 429s live. **Mix report types** so the union is exercised, not just byte-identical copies.
- Regression: a single report on its own page is unchanged; two documents with different JQLs do not
  cross-contaminate.
- While there: sanity-check page size on a large-JQL document — `maxResults` sent vs `issues.length`
  returned per `search/jql` response. Not a gate (see Decisions), but this is the one load where a
  payload-capped page would show up.

### Mutation safety

A shared array is only safe if no consumer writes to it. Audited:

- **The array** has two consumers: `derivedIssuesRequestData` calls `rawIssues.map(...)`
  (`state-helpers.js:149-153`), and `useRawIssueRequestData.ts:17` reads `.length`.
- **`normalizeIssue`** (`normalize.ts:32-103`) builds a fresh object, keeping the raw issue by reference at
  `:102`; it writes nothing to `issue`. **`deriveIssue`** (`derive.ts:21-34`) returns a spread.
- **The rollup pipeline does see the raw issue _objects_** — not the array. `derivedIssuesToRawIssues`
  (`rollup-and-rollback.ts:104-106`) maps `dI.issue`, i.e. the very objects the fetch returned, and hands
  them to `rollbackIssues` (`:94`). So the rollback path is the audit that matters:
  - **`rollbackIssue`** (`rollback.ts:183-225`) copies rather than mutates — confirmed: destructures
    `{ changelog, ...rest }` at `:188`, shallow-copies `rolledBackIssue.fields = { ...issue.fields }` at
    `:204`, and every field handler returns a _new_ `{ [fieldName]: … }` `Object.assign`ed onto that copy.
    Nested Sprint / Fix-version / Status values are shared by reference from lookup maps built out of the
    raw issues (`:138-170`), but only ever read.
  - `addRollups` (`:66-86`) runs on _derived_ issues, and its `.sort()` / `.reverse()` calls all run on
    freshly built arrays (e.g. `rollup.ts:105`, `dates.ts:85-86`).
- **This is not a new class of risk.** `rollupAndRollback` already re-runs whenever `when` changes, so an
  in-place raw mutation would corrupt a single report today. The freeze test is cheap insurance against
  someone adding an in-place sort later, not a new obligation this plan creates.

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
   a shared `DerivedIssue` is nine rollup modules to audit, not the handful above.
3. **It gets strictly easier afterwards.** Once raw sharing lands, two identical reports already hold the
   _same array identity_, so the WeakMap hits with no key computation at all — which is why Phase 3
   preserves promise identity across a TTL hit.

## Risks and open questions

- **The maps-not-loaded race is the likeliest quiet under-delivery.** `toFieldId` passes identifiers
  through unchanged until `jiraHelpers.fields` resolves (`requested-fields.ts:26`), so a child computing
  its key before that keys on `'Status'` while a later one keys on `'status'`. Conservative — it can only
  miss a dedupe — but it makes the win timing-sensitive on a cold load. Mitigation: log `key` on cache
  miss, so an unexpected miss is visible. That log is also how you would notice a group splitting for any
  of the Phase 1 reasons.
- **Subscriber lifetime.** `rawIssuesRequestData` never signals that a config went away, so a subscriber
  closure outlives a removed report until the load settles. Bounded by one in-flight load; not worth a
  disposal protocol.
- **Page size is unmeasured, by decision.** See Decisions. The exposure is the root search of a large JQL;
  child batches are 40 parents (`makeDeepChildrenLoaderUsingNamedFields.ts:34`) and return a single page
  either way.
- **A queue is still needed.** Dedupe removes duplicate cascades; it does nothing about a _single_
  `loadChildren` report issuing hundreds of unthrottled child requests (`before.md` §3.4 — and the deep
  loader starts every child batch synchronously in one `.map`, `:37-42`). Sibling plan 2 is what makes
  429s recoverable rather than merely rarer, and Phase 2's shared rejection widens the blast radius of
  each one in the meantime.

## Out of scope

Partial-overlap dedupe (sibling plan 5 — and note that Phase 1 is _not_ it); any concurrency limit, retry
or `Retry-After` handling; the `expand=changelog` fix; skipping approximate-count on child batches; the
deep-children chunk size; sharing derived or rolled-back data; any change to `TimelineReportViewModel` or
the rollup pipeline; overriding what a report _renders_ (only what it loads); persistence across page
loads.
