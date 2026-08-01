# Before — how data is fetched and processed today

A description of the **current** system, written before proposing any change. Every claim carries a
`file:line` citation so it can be checked rather than trusted. Where something could not be verified
from the source alone it is marked **[UNVERIFIED]** and says what would settle it.

Nothing in this document proposes a fix. It exists so the next plan starts from measured ground.

---

## Part 0 — High-level summary

### How one report loads

A report is a saved JQL string plus display settings. Loading it is five stages, in order:

1. **Ask Jira which work items match the JQL**, and get their fields back.
2. **Ask Jira for the full change history** of every one of those work items, in batches of 1000.
3. **Normalize** each work item — turn Jira's field soup into a tidy object.
4. **Derive** each one — work out timing and status from the normalized shape.
5. **Roll up** — walk the parent/child tree and aggregate children into parents, so an Epic gets
   dates and a status from its Stories.

Then the chart draws the result.

Two things about this are worth knowing up front, because they are the whole story:

- **The change history is the expensive part.** It is a separate API call per 1000 work items, and
  it is by far the biggest payload — a work item's fields are a few hundred bytes, its changelog can
  be many kilobytes.
- **Stage 5 depends on exactly which work items the report has.** Rollup aggregates children into
  parents, so a report holding a _different_ set of work items gets _different_ numbers on the rows
  it shows. **This is the sharpest trap in the whole system:** hand a report a superset of its work
  items and it does not render extra rows you could filter away afterwards — it renders _wrong dates
  and statuses on the rows it does show_, because foreign children rolled into its parents. No error,
  no empty chart, just quietly incorrect numbers. Any scheme that shares data between reports has to
  keep each report's set exact. See §1.4 for the mechanism.

### What "the report type" does and doesn't change

It doesn't change what gets fetched. A Gantt, a Table and a Scatter Plot over the same JQL all fetch
the same work items and run all five stages identically. The report type only changes:

- which extra **fields** are asked for (a Table asks for the fields of its visible columns), and
- **how the same rolled-up data is drawn**.

So "a Gantt that relies on issues 200–500" means "a report whose JQL matches issues 200–500". The
reliance comes from the query, never from the chart.

### What a report of reports does

Exactly what one report does, N times, with nothing shared. Each embedded report builds its own
config, runs its own five stages, and holds its own copy of everything. All of them start at once —
there is no limit on how many load simultaneously, no retry, and no handling of Jira rate limits.

### The overlap scenario, in numbers

Three reports in one document — Table over issues 1–1000, Gantt over 200–500, Scatter over 900–1100.
1100 distinct work items between them; 1502 work-item-slots asked for.

|                                                        | count                               |
| ------------------------------------------------------ | ----------------------------------- |
| Distinct work items the document needs                 | **1,100**                           |
| Work items actually fetched (fields **and** changelog) | **1,502**                           |
| Redundant fetches                                      | **402** (27% of everything fetched) |
| `normalizeIssue` calls                                 | **3,004**                           |
| `deriveIssue` calls                                    | **3,004**                           |
| Changelog replays (`rollbackIssue`)                    | **1,502**                           |
| Full rollup pipeline runs                              | **6**                               |

Each distinct work item is normalized and derived **2.7 times** on average across the document.

But note where that factor comes from: **only 402 of the 1,904 redundant operations are caused by
overlap.** The other ~1,500 are caused by every report processing every one of its own work items
_twice_ — once for "now" and once for "how it looked N days ago", which is what powers the
comparison arrows. That second pass happens with a single report on a page and no overlap at all.

### Where the cost actually is — ranked

1. **Every work item is normalized + derived twice per report, always.** Not an overlap problem;
   a single large report pays it. (`state-helpers.js:149-153` and again `rollup-and-rollback.ts:95-101`.)
2. **The rollup pipeline copies every work item ~15 times per report render** and rescans the whole
   array dozens of times. Also not an overlap problem.
3. **`expand=changelog` is being sent on every search request even though the code is written to
   avoid it** — see §1.2. If this makes Jira cap page size, a 1000-issue report is
   doing ~10 round trips where it should do 1. This is a plain bug in the current code, unrelated to
   report-of-reports, and the strongest candidate for "large reports are already slow".
   **[UNVERIFIED]** against a real instance.
4. **Overlap between reports** — 27% redundancy in the scenario above. Real, but the smallest of the
   four, and by far the hardest to fix safely: it is the only one that requires sharing data between
   reports, which runs straight into the exact-membership trap above.

Note the ordering. (1), (2) and (3) are all present with a **single** report on a page and are fixed
without any cross-report machinery; (4) needs the riskiest change and returns the least. (3) in
particular is a live bug and is the most likely explanation for a single large report being slow —
so "documents are slow" may be mostly "reports are slow, times N" rather than a sharing problem.

---

## Part 1 — One report, end to end

### 1.1 Config → the request

The shell's config object is `RouteData` (`src/canjs/routing/route-data/route-data.js`). The three
inputs that define _which_ work items load:

| property       | line                | meaning                                          |
| -------------- | ------------------- | ------------------------------------------------ |
| `jql`          | `route-data.js:223` | the report's query                               |
| `loadChildren` | `route-data.js:227` | also walk down the parent/child tree             |
| `childJQL`     | `route-data.js:228` | extra filter applied at every level of that walk |

And the field list, `allFieldsToRequest` (`route-data.js:423-452`), a union of:

- `fieldsToRequest` — from team configuration, global (`route-data.js:371`)
- `fields` — the report's own extra-fields URL param
- `tableColumnFields` — Jira fields implied by the Table report's visible columns
  (`route-data.js:414-419`)

`allFieldsToRequest` deliberately **excludes** the always-loaded `CORE_FIELDS`; the comment at
`route-data.js:421-422` says so explicitly, because `getRawIssues` adds them. That is a real trap for
anything that bypasses `getRawIssues`.

`rawIssuesRequestData` (`route-data.js:286-299`) wires those into
`state-helpers.js:28-64`, which calls `getRawIssues` inside a `value.returnedBy`, so **any change to
jql / childJQL / loadChildren / fields re-runs the whole fetch**.

### 1.2 The fetch

`getRawIssues` (`src/stateful-data/jira-data-requests.js:100-131`):

```js
if (isLoggedIn === false) return bitoviTrainingData(new Date());   // :103-106
if (!fields) return undefined;                                      // :108
let fieldsToLoad = [...new Set([...fields, ...CORE_FIELDS])];       // :112
if (!jql) return undefined;                                         // :115
const loadIssues = loadChildren ? …DeepChildren… : …flat…;           // :118-120
return loadIssues({ jql, childJQL: childJQL ? ' and ' + childJQL : '',
                    fields: fieldsToLoad, expand: ['changelog'] }, progressUpdate);  // :122-130
```

`CORE_FIELDS` (`jira-data-requests.js:81-93`) is 11 entries: `summary`, `Rank`, `Issue Type`,
`Fix versions`, `Labels`, `Status`, `Sprint`, `Created`, `Parent`, `Team`, `Linked Issues`.

There is **no cache on `getRawIssues`**. `getServerInfo` and `getSimplifiedIssueHierarchy` directly
above it are wrapped in `makeCacheable` with a 1-second TTL (`jira-data-requests.js:12-26`, `:37`,
`:45`); `getRawIssues` is not.

#### Flat path

`fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields` (`jira.ts:540-558`) translates display
names to field ids via `nameMap`, calls
`fetchAllJiraIssuesWithJQLAndFetchAllChangelog` (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:16`),
then translates ids back to names with `mapIdsToNames`.

Inside that function:

1. **`POST /api/3/search/approximate-count`** — one call, purely to give the loading bar a
   denominator (`:46-62`).
2. **`GET /api/3/search/jql`**, looped until `isLast` (`:77-101`). `MAX_RESULTS = 5000` (`:42`).
3. **`POST /api/3/changelog/bulkfetch`**, one per 1000 work items (`:107`, `chunkArray(allIssues, 1000)`).
   `fetchBulkChangelogs` (`jira.ts:320-403`) rejects >1000 per request (`:328`) and paginates its own
   response by `nextPageToken` (`:341-399`).
4. Rebuilds each issue as `{ id, key, fields, changelog }` (`:129-134`) and dedupes by key
   (`uniqueKeys`, `:140`).

#### Deep-children path

`makeDeepChildrenLoaderUsingNamedFields` (`makeDeepChildrenLoaderUsingNamedFields.ts:19`) wraps the
flat fetch as a `rootMethod` and recurses:

- parents are chunked **40 per request** (`:34`)
- each request is `` `parent in (${keys.join(', ')}) ${params.childJQL || ''}` `` (`:39`)
- every level runs the _entire_ flat pipeline again — count, search pages, and a full changelog
  bulkfetch (`:41`)
- recursion continues until a level returns nothing (`:53-61`)

So a `loadChildren` report over 1000 parents issues at least `ceil(1000/40) = 25` child requests at
the first level alone, each with its own count call and its own changelog bulkfetch.

#### 🔴 Finding: `expand=changelog` is sent despite the code trying not to

`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:10-14` states the intent:

> When true: search omits `expand:['changelog']`, then fetches all changelogs via a single bulk call.
> **Allows up to 5000 issues per search page instead of ~100.**

The implementation (`:73`, `:80-85`):

```js
const searchExpand = USE_DIRECT_BULK_CHANGELOG ? [] : ['changelog'];   // → []
…
const response = await searchJiraIssuesWithJQL(config)({
  ...apiParams,                                          // ← carries expand: ['changelog']
  maxResults: pageSize,
  nextPageToken,
  ...(searchExpand.length > 0 && { expand: searchExpand }),  // ← spreads `false`, a no-op
});
```

`apiParams` comes from `getRawIssues`, which always sets `expand: ['changelog']`
(`jira-data-requests.js:127`). The intended override spreads `false` when the flag is on, so it never
removes anything. `searchJiraIssuesWithJQL` then serializes it (`jira.ts:125`).

Verified by executing the exact expression:

```
expand actually sent: ["changelog"]
URL: /api/3/search/jql?jql=project+%3D+X&maxResults=5000&fields=summary&expand=changelog
```

Consequences, in order of confidence:

- **Certain:** every search page carries inline changelog data that is then thrown away —
  `:129-134` overwrites `changelog` with the bulkfetch result unconditionally.
- **[UNVERIFIED]:** if Jira caps page size when `expand=changelog` is present (the code comment says
  ~100), then a 1000-item report makes ~10 search round trips instead of 1, and a `loadChildren`
  report multiplies that at every level. Settled by one network-panel look at the `maxResults`
  actually honoured on a real instance.

This is independent of report-of-reports and affects every report in the product today.

### 1.3 Normalize and derive

`derivedIssuesRequestData` (`state-helpers.js:131-172`) gates on three promises and then maps:

```js
Promise.all([issuesPromise, configurationPromise, licensingPromise])
  .then(([rawIssues, configuration, licensing]) => {
    if (!licensing.active) { throw tagged 'no-licensing' }   // :142-147
    return rawIssues.map((issue) => {
      const normalized = normalizeIssue(issue, configuration);   // :150
      const derived = deriveIssue(normalized, configuration);    // :151
      return derived;
    });
  });
```

- `normalizeIssue` (`src/jira/normalized/normalize.ts:32-104`) is pure: raw issue + config → a flat
  object (`summary`, `key`, `parentKey`, `dueDate`, `startDate`, `storyPoints`, `team`, `status`,
  `releases`, `rank`, …), keeping the raw issue at `.issue` (`:102`).
- `deriveIssue` (`src/jira/derived/derive.ts:21-35`) adds `derivedTiming` and `derivedStatus`.
- `configuration` is `normalizeOptions`, a **global** settable async property (`route-data.js:457`).

Before `configurationPromise` resolves, this returns a promise that never settles, flagged
`__isAlwaysPending` (`state-helpers.js:155-159`) so the UI shows loading rather than empty.

### 1.4 Rollup — the per-report stage

`TimelineReportViewModel` (`src/react/TimelineReport/timeline-report-view-model.js`) turns derived
issues into what charts draw.

```
filteredDerivedIssues                      :52-62    drop statusesToExclude
  ↓
rollupTimingLevelsAndCalculations          :66-93    slice hierarchy to From→To
  ↓
rolledupAndRolledBackIssuesAndReleases     :96-122   ← the expensive getter
  ↓
groupedParentDownHierarchy                 :124-133
  ↓
primaryIssuesOrReleases                    :148-214  top level, filtered + sorted
```

`rolledupAndRolledBackIssuesAndReleases` calls `rollupAndRollback`
(`src/jira/rolledup-and-rolledback/rollup-and-rollback.ts:34-64`) with
`when = now − compareTo seconds` (`timeline-report-view-model.js:101`), which does **two** full passes:

**Past pass** — `rollbackNormalizeAndDeriveEverything` (`:88-102`):

1. `rollbackIssues(rawIssues, when)` (`rollback.ts:172-179`) — for each issue, walk its changelog
   newest-first and un-apply every change until reaching `when` (`rollback.ts:206-224`). Issues
   created after `when` are dropped (`:194`). **This is the only consumer of the changelog.**
2. `normalizeIssue` again (`rollup-and-rollback.ts:98`)
3. `deriveIssue` again (`rollup-and-rollback.ts:99`)
4. `addRollups` (`rollup-and-rollback.ts:101`)

**Current pass** — `addRollups(derivedIssues, …)` (`rollup-and-rollback.ts:49`).

Then the two are joined by key (`:52-62`) so each current issue carries `issueLastPeriod`.

`addRollups` (`rollup-and-rollback.ts:66-86`) is nine stages:

| #   | stage                       | source    |
| --- | --------------------------- | --------- |
| 1   | `normalizeReleases`         | `:67`     |
| 2   | `deriveReleases`            | `:68`     |
| 3   | `addReportingHierarchy`     | `:69`     |
| 4   | `addRollupDates`            | `:70`     |
| 5   | `rollupBlockedStatusIssues` | `:71`     |
| 6   | `rollupWarningIssues`       | `:72`     |
| 7   | `addPercentComplete`        | `:73`     |
| 8   | `rollupChildStatuses`       | `:74/:82` |
| 9   | `addWorkTypeDates`          | `:85`     |

Stages 4–9 each follow the same shape — verified by grepping each module for
`groupIssuesByHierarchyLevelOrType` + `zipRollupDataOntoGroupedData` (4 hits in every one of
`blocked-status-issues.ts`, `warning-issues.ts`, `percent-complete.ts`, `child-statuses.ts`,
`work-type.ts`; the pattern is visible in full at `dates.ts:53-65`):

```js
const grouped = groupIssuesByHierarchyLevelOrType(issues, levels);   // L filter passes over N
const rolled  = rollupGroupedHierarchy(grouped, …);                  // 1 pass
return zipRollupDataOntoGroupedData(grouped, rolled, (item, values) => ({ ...item, … })).flat();
                                                                     // 1 pass, new object per issue
```

`groupIssuesByHierarchyLevelOrType` (`rollup.ts:93-103`) is
`levels.map(h => issues.filter(test(h)))` — **L full scans of the array**, where L is the number of
hierarchy levels in range.

So per `addRollups`: ~7 new objects per issue (stages 3–9), and ~7 × L full-array scans. With L = 3
that is ~21 scans. `rollupAndRollback` runs `addRollups` twice, then
`calculateReportStatuses` (`work-status.ts:88-103`) copies every issue once more
(`timeline-report-view-model.js:110`), and `groupedParentDownHierarchy` groups again
(`timeline-report-view-model.js:128`).

**≈15 object allocations and ≈45 full-array scans per issue-bearing report render.**

> **Why rollup cannot be shared between reports.** It aggregates children into parents. A report
> holding a different set of work items produces _different dates and statuses on the rows it does
> show_, because different children rolled into its parents. In the scenario below, the Gantt covers
> issues 200–500; if issue 300's children are 600–700, the Gantt's rollup for 300 is computed without
> them — by design. Membership defines the rollup. This is a correctness property, not a performance
> one, and it is the constraint any sharing scheme has to respect.

### 1.5 What the report plucks

Every report gets the same prop bag from `propsFor` (`src/react/reports/reportProps.ts:15-53`). Three
props carry data:

| prop                         | source                                      | what it is                       |
| ---------------------------- | ------------------------------------------- | -------------------------------- |
| `filteredDerivedIssuesObs`   | `vm.filteredDerivedIssues`                  | pre-rollup, all levels           |
| `allIssuesOrReleasesObs`     | `vm.rolledupAndRolledBackIssuesAndReleases` | post-rollup, all levels          |
| `primaryIssuesOrReleasesObs` | `vm.primaryIssuesOrReleases`                | post-rollup, top level, filtered |

All three of the reports in the scenario read all three props:

- **Table** — `TableReport.tsx:710-712`
- **Gantt** — `GanttGrid.tsx:80-82`
- **Scatter** — `ScatterTimeline.tsx:114-117`

The remaining ~30 props are display settings bound straight off the config (`reportProps.ts:20-52`).

**Nothing about the report type narrows the data pipeline.** All five stages run in full for every
report type; only the drawing differs.

---

## Part 2 — Report of reports

Structurally identical to Part 1, N times, with nothing shared below the config layer.

`ChildReport` (`src/react/reports/ReportOfReports/components/ChildReport.tsx:47-92`) builds, per
embedded report:

```js
const config = new ChildReportConfig({ queryParams: report.queryParams, parent }); // :53-56
const vm = new TimelineReportViewModel({ routeData: config }); // :58
const props = propsFor(vm, config); // :59
const loadingState = useLoadingState(config); // :62
```

`ChildReportConfig` (`src/react/reports/ReportOfReports/model/ChildReportConfig.js`) parses every
setting out of that report's saved `queryParams` (`CHILD_PARAMS`, `:77-197`) and mirrors the
genuinely global things off the parent `routeData` (`:287-293`) — `jiraHelpers`,
`isLoggedInObservable`, `licensingPromise`, `normalizeOptions`, `simplifiedIssueHierarchy`,
`fieldsToRequest`, `fieldMaps`.

Then it runs **its own** copy of the shell's fetch, through the same helpers
(`ChildReportConfig.js:336-382`): `rawIssuesRequestData` → `derivedIssuesRequestData` →
`derivedIssues`. Those are the same `state-helpers.js` functions the shell uses, so §1.2–1.4 apply
verbatim, once per embedded report.

What that means concretely:

- **N complete pipelines.** N counts, N paginated searches, N changelog bulkfetch sets, N normalize
  passes, N derive passes, N rollback passes, 2N `addRollups` runs.
- **No dedupe anywhere.** Two children with byte-identical JQL and fields are two full fetches.
- **All at once.** Every node in the document tree renders in one pass
  (`ReportOfReports.tsx:169-177` for sections, `:230-266` for reports); there is no windowing, no
  lazy mount, no stagger.
- **No concurrency limit, no retry, no 429 handling.** Both request helpers are a bare `fetch` with
  auth headers — `hosted-request-helper.js:26-73` and `connect-request-helper.js:7-40`. Grepping
  `src/jira-oidc-helpers/` and `src/stateful-data/` for `concurren|throttle|p-limit|semaphore|queue`
  returns only comments.
- **Collapsing does not help.** Collapsed content stays mounted behind `hidden`
  (`ReportOfReports.tsx:166-168`) precisely so it does not refetch — so it also never stops fetching.

---

## Part 3 — The overlap scenario, quantified

**Setup.** One document, three embedded reports, all flat (`loadChildren = false`):

| report  | JQL matches     | count |
| ------- | --------------- | ----- |
| Table   | issues 1–1000   | 1000  |
| Gantt   | issues 200–500  | 301   |
| Scatter | issues 900–1100 | 201   |

Overlaps: Table ∩ Gantt = 200–500 (301). Table ∩ Scatter = 900–1000 (101). Gantt ∩ Scatter = ∅.

- **Distinct work items:** 1,100
- **Work-item-slots requested:** 1,000 + 301 + 201 = **1,502**
- **Redundant:** 1,502 − 1,100 = **402** (26.8%)

### 3.1 HTTP requests

Per report with N work items:

| call                                   | count                                     | source                                                |
| -------------------------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `POST /api/3/search/approximate-count` | 1                                         | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:49` |
| `GET /api/3/search/jql`                | `ceil(N / pageSize)`                      | `:80`, `MAX_RESULTS = 5000` at `:42`                  |
| `POST /api/3/changelog/bulkfetch`      | `ceil(N / 1000)`, each possibly paginated | `:107`, `jira.ts:341-399`                             |

|                                                 | Table | Gantt | Scatter | total  |
| ----------------------------------------------- | ----- | ----- | ------- | ------ |
| count calls                                     | 1     | 1     | 1       | **3**  |
| search pages, if 5000 honoured                  | 1     | 1     | 1       | **3**  |
| search pages, if capped at 100 **[UNVERIFIED]** | 10    | 4     | 3       | **17** |
| changelog bulkfetch                             | 1     | 1     | 1       | **3**  |

**9 requests** in the good case, **23** if the `expand` finding caps page size.

Of those, the _payload_ redundancy is what matters: **402 work items' fields and 402 work items'
changelogs are transferred twice**. Changelog is the dominant payload.

### 3.2 Processing

Per report, per work item in that report's set:

| operation                          | site                                              | times |
| ---------------------------------- | ------------------------------------------------- | ----- |
| `normalizeIssue` (current)         | `state-helpers.js:150`                            | 1     |
| `deriveIssue` (current)            | `state-helpers.js:151`                            | 1     |
| `rollbackIssue` — changelog replay | `rollback.ts:177` via `rollup-and-rollback.ts:96` | 1     |
| `normalizeIssue` (past)            | `rollup-and-rollback.ts:98`                       | 1     |
| `deriveIssue` (past)               | `rollup-and-rollback.ts:99`                       | 1     |

Totals for the document:

| operation                 | Table | Gantt | Scatter | **total** | distinct needed                |
| ------------------------- | ----- | ----- | ------- | --------- | ------------------------------ |
| `normalizeIssue`          | 2,000 | 602   | 402     | **3,004** | 1,100 (current) + 1,100 (past) |
| `deriveIssue`             | 2,000 | 602   | 402     | **3,004** | as above                       |
| `rollbackIssue`           | 1,000 | 301   | 201     | **1,502** | 1,100                          |
| `addRollups` runs         | 2     | 2     | 2       | **6**     | 6 — not shareable              |
| `calculateReportStatuses` | 1     | 1     | 1       | **3**     | 3 — not shareable              |

Object allocations in the rollup stages, at ~15 copies per work item per report (§1.4):
≈ 1,502 × 15 ≈ **22,500 objects per document render**.

**Each distinct work item is normalized 2.73× and derived 2.73×** (3,004 / 1,100).

### 3.3 Where that 2.73× actually comes from

This is the part worth sitting with:

| cause                                                   | avoidable normalize+derive calls | fixable by                                     |
| ------------------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| Every report processes its own items twice (now + past) | ~1,502                           | memoising the past pass, or not recomputing it |
| Overlap between the three reports                       | 402                              | sharing fetched/derived items across reports   |

**The double pass costs ~3.7× more than the overlap does**, and it is paid by a single report on a
single page with no document involved. It is also the cheaper of the two to address, because the
current-pass and past-pass results are pure functions of `(raw issue, normalizeOptions)` and
`(raw issue, when, normalizeOptions)` respectively — no membership dependency at all.

### 3.4 The `loadChildren` multiplier

If any of the three reports has `loadChildren = true`, the request counts change shape entirely.
A report with P top-level parents issues, **per level of depth**:

- `ceil(P / 40)` child searches (`makeDeepChildrenLoaderUsingNamedFields.ts:34`)
- each of which runs a full count + search + changelog bulkfetch (`:41`)

A 1000-parent report with two levels of children is ~25 requests at level 1, plus one per 40
discovered children at level 2 — hundreds of round trips, none of them limited or throttled. **This
dwarfs everything else in Part 3** and is unaffected by any issue-level sharing scheme, because the
walk itself is what costs.

---

## Part 4 — What is and isn't shareable

For any future plan, the dividing line:

**Shareable — pure functions of a work item plus global config:**

| thing                                               | why                                                | caveat                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the raw fetch (fields + changelog) per work item id | identical whoever asked                            | field sets differ per report                                                                                                                                       |
| `normalizeIssue(raw, normalizeOptions)`             | `normalizeOptions` is global (`route-data.js:457`) | output depends on which fields were fetched                                                                                                                        |
| `deriveIssue(normalized, options)`                  | pure                                               | as above                                                                                                                                                           |
| `rollbackIssue(raw, when)`                          | pure                                               | `when` is per-report (`vm:101`, from `compareTo`) — shareable only between reports with the same `compareTo`, which is the common case since it defaults uniformly |

**Not shareable — depends on the report's exact membership and its own settings:**

- `addRollups` and everything downstream — depends on `rollupTimingLevelsAndCalculations`
  (per-report: `primaryIssueType`, `toIssueType`, `timingCalculations`) **and** on which work items
  are present, since children aggregate into parents
- `calculateReportStatuses`, `groupedParentDownHierarchy`, `primaryIssuesOrReleases`
- everything in `TimelineReportViewModel`

**A trap worth naming:** normalize/derive are pure functions of the issue, but _the issue itself
differs_ depending on which fields were fetched. Two reports asking for different field sets do not
get the same normalized object for the same work item id — an estimate field one report omits will
be `null` for it and populated for its neighbour. Any "fetch the union of fields once" scheme
therefore changes what individual reports compute, not just how fast they compute it.

---

## Appendix — verification status

**Verified by reading the source, with citations above:** the fetch pipeline shape and call counts;
`CORE_FIELDS` handling; the absence of caching on `getRawIssues`; the double normalize/derive; the
nine rollup stages and their copy-per-issue pattern; the absence of concurrency limiting, retry and
rate-limit handling; the deep-children chunk size of 40 and changelog chunk size of 1000; that all
children mount at once and stay mounted when collapsed.

**Verified by executing the expression:** that `expand=changelog` survives the intended override in
`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:80-85`.

**[UNVERIFIED] — needs one session against a real Jira instance:**

1. Whether `expand=changelog` causes Jira to cap `maxResults` below 5000, and at what value. This
   decides whether §3.1 is 9 requests or 23, and whether it is the real cause of slow large reports.
2. Actual wall-clock and byte split between search and `changelog/bulkfetch` for a 1000-item report —
   the assumption that changelog dominates is stated everywhere in this repo but measured nowhere.
3. Whether `/api/3/search/jql` honours a 5000 `maxResults` at all in practice.
4. Real-world overlap: what fraction of work items in an actual multi-report document are shared. The
   27% in §3 comes from the hypothetical set-up defined at the top of Part 3, not from measurement.

**Deliberately not addressed here:** any proposal. That belongs in `plan.md`, written once the four
unknowns above have been settled.
