# Saved-report migrations — implementation plan

Sub-plan of [`spec/018-card-report/plan.md`](../plan.md) (decision **D8**, scheduled as
its Phase 1.5). Separated so it can be built, reviewed and shipped on its own: nothing
here is specific to the Cards report.

**Verified against `feat/017-remove-legacy-reports` @ `9093c94d`.** Line numbers below
were checked at that commit; re-verify with `grep` before trusting one that looks off —
the branch is active. This is the branch on which
[spec/017](../../017-remove-legacy-reports/plan.md) has already landed — Grouper and
Estimation Table are deleted and `table2` → `table` is done. That rename shipped
_without_ an alias, deliberately (Phase 3 commit `6a7ca435`: _"No table2->table alias —
old saved keys break, acceptable per 012 Q2"_), so a saved report carrying
`primaryReportType=table2` silently renders **the Gantt** today (see § Problem — not a
blank page, as an earlier draft of this plan claimed). **Ratified 2026-08-01: add the
migration.** It deliberately reverses that decision, on the grounds that the entry costs
three lines and the alternative leaves a user's Table report rendering as somebody
else's report.

**Dependency:** the migration _table_ references keys that Phase 1 of the parent plan
introduces (`cardsMode`, `cardsChildFilterRows`). The _mechanism_ has no such
dependency — build and land it with only the `primaryReportType=breakdown` entry, then
add Cards rows when Phase 1 lands. That ordering also proves the mechanism against a
real, pre-existing bug rather than against a rename we authored.

---

## Status — 2026-08-02

**Phases A and B are implemented** on `feat/017-remove-legacy-reports` (uncommitted as of
this writing). **Phase C is the only work left in this plan**, and it is blocked on the
parent plan's Phase 1 introducing `cardsMode` / `cardsChildFilterRows`. Everything below
describes the shipped design; read § Phases for what is done versus outstanding.

| New                                                          | What it is                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `src/jira/reports/migrations/types.ts`                       | the `Migration` interface                                                   |
| `…/migrations/migrations.ts`                                 | `MIGRATIONS` (3 entries) + `EOL_MONTHS`                                     |
| `…/migrations/index.ts`                                      | `migrateQueryParams` / `migrateReport` / `migrateReports`, table injectable |
| `…/migrations/persist.ts`                                    | `persistMigrations` + `resetPersistMigrationsForTests`                      |
| `…/migrations/url.ts`                                        | `migrateUrlParams`                                                          |
| `…/migrations/{index,migrations,url,persist}.test.ts`        | runner mechanics, per-entry cases + EOL guard, URL layer, write guards      |
| `src/react/TimelineReport/unsupportedReportType.ts` (+ test) | the § 2 raw-value check                                                     |

| Changed                                                                         | Why                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `jira/reports/fetcher.ts`                                                       | `readAllReports` (read layer); `getAllReports` delegates to it        |
| `react/services/reports/useAllReports.ts`                                       | fires the guarded write-back                                          |
| `shared/main-helper.js`                                                         | both `legacy*RoutingFix` deleted; `beforeRouteStart` threaded         |
| `plugin.main.ts`, `web.main.ts`                                                 | `configureRouting(route, { beforeRouteStart })`                       |
| `canjs/routing/state-storage.js`                                                | `directlyReplaceUrlParam` → `directlyReplaceUrlSearch` (see § Wiring) |
| `can.d.ts`                                                                      | declares `value.returnedBy`                                           |
| `TimelineReport.tsx`, `ReportArea.tsx`, `ReportMessages.tsx`, `ChildReport.tsx` | the § 2 guard                                                         |
| `fetcher.test.ts`, `ReportArea.test.tsx`, `ChildReport.test.tsx`                | new cases; one existing child case flipped (§ 2)                      |

Verification: `npx tsc` clean and `npm test` green (1457 tests / 202 files) at
`9093c94d`, with other in-flight branch work in the tree alongside it. At the point A and B
were finished, `npx playwright test --project=unauth` was green (17) and four checks ran
against a built bundle — `?primaryReportType=breakdown&primaryIssueType=Initiative`
rewrites to `start-due` + `primaryReportBreakdown=true` + `selectedIssueType=Initiative`;
`table2` rewrites to `table`; `selectedIssueType=Release-Epic` alongside a derived
`primaryIssueType=Release` is left untouched; an unknown type renders the message and
mounts no report container. Re-run the E2E and browser checks before merging if the boot
path (`main-helper.js`, either `*.main.ts`) has moved since.

---

## Problem

Two independent problems, one shared cause.

**1. The boot-time URL rewrite cannot reach saved reports.** `main-helper.js` ran
`legacyPrimaryReportingTypeRoutingFix()` and `legacyPrimaryIssueTypeRoutingFix()` before
`configureRouting`, using `directlyReplaceUrlParam` — a raw `history.replaceState` that
deliberately does not publish to `pushStateObservable`, so the URL is corrected before
anything observes it. (Both functions are gone as of Phase B; this is the state they left.)

It only ever touches `window.location`. Saved-report params never pass through the URL;
they resolve off `reportData.queryParams` via `paramValue()` (`state-storage.js`).

**This is a live bug, but its failure mode is "wrong report", not "no report".**
`primaryReportType` is clamped on the way in (`route-data.js:587-595`):

```js
parse: (x) => (REPORTS.find((report) => report.key === x) ? x : REPORTS[0].key); // 'start-due'
```

and that `parse` runs on whichever raw value wins — URL, then `reportData`, then the
default (`state-storage.js:232-244` → `265-272`). `ChildReportConfig.js`'s `CHILD_PARAMS.primaryReportType` carries
the identical clamp. So an unrecognized report type never reaches
`reportComponents[…]`:

| Saved value                   | Renders today           | What's actually lost                                                                    |
| ----------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `primaryReportType=breakdown` | Gantt (`REPORTS[0]`)    | only `primaryReportBreakdown=true` — the right primary, minus the work-breakdown option |
| `primaryReportType=table2`    | Gantt over the same JQL | the entire report — a Table report comes back as a timeline                             |

That clamp also means the "unknown report type" fallback this plan used to propose for
the shell would be **unreachable dead code**, and that `ChildReport.tsx`'s existing
`Unknown report type "X"` message is dead for the same reason (its `reportType`
is clamped before it gets there; `registry.test.ts` forbids the only other way in).
§ 2 below is rewritten around raw values because of this.

**2. Renames silently drop user configuration.** Nothing translates an old param key to
a new one in stored data, so a rename either loses the setting or forces the old key to
live forever.

---

## Design

### Layers

| Layer                     | Where                                         | Purpose                          | If it fails                 |
| ------------------------- | --------------------------------------------- | -------------------------------- | --------------------------- |
| **Normalize on read**     | `readAllReports` (`fetcher.ts`)               | **Correctness.** Always applied. | n/a — pure, no I/O          |
| **Persist on write-back** | once per session, from `useAllReports.ts`     | **Convergence.** Cleans storage. | Nothing — retried next load |
| **Rewrite the URL**       | between routing reconcile and `route.start()` | Legacy links/bookmarks.          | Nothing — read layer covers |

Read-time is the correctness layer and is always applied. Write-back is what makes
[EOL](#end-of-life) possible — without it, stored data never converges and no migration
could ever be deleted. But correctness must never _depend_ on the write: if it did, any
report that failed to migrate (offline, no configuration issue, permission error, lost
race) would render broken.

### File layout

```
src/jira/reports/
  fetcher.ts              (existing — gains readAllReports, the read-layer call)
  migrations/
    index.ts              runMigrations() + the public API
    migrations.ts         THE ORDERED TABLE — the only file that changes per migration
    types.ts              Migration interface
    persist.ts            the guarded write-back
    url.ts                the URL consumer
    *.test.ts             per-migration cases, runner mechanics, guards, EOL guard test
```

One array in one file, not a file per migration — there will be a handful, and a single
greppable table is what makes the EOL review a 30-second job. Revisit past ~10 entries.

### The Migration interface

```ts
// types.ts
export interface Migration {
  /** Stable id — appears in EOL test failures and console warnings. Never reused. */
  id: string;
  /** ISO date the migration shipped. Drives EOL. */
  addedOn: `${number}-${number}-${number}`;
  /** What breaks if this is dropped — decides the EOL policy. See § End of life. */
  onDrop: 'fatal' | 'lossy';
  /** One line, present tense: "renames secondaryReportType to cardsMode". */
  describe: string;
  /** True if this migration has anything to do. Must be false after it has run. */
  applies: (params: URLSearchParams) => boolean;
  /** Mutates a COPY. Only called when `applies` is true. */
  migrate: (params: URLSearchParams) => void;
}
```

Splitting `applies` from `migrate` is what makes `changed` trustworthy, and `changed` is
the guard the entire write layer rests on. A migration that cannot answer "is there
anything to do?" cheaply is a migration that will write on every page load. The runner
verifies the postcondition (`applies === false` after `migrate`) whenever anything
applied and warns if an entry violates it — the cheapest possible guard against a
write-every-load loop.

### The API

```ts
// index.ts — pure, no I/O, idempotent
export function migrateQueryParams(
  raw: string | URLSearchParams,
  migrations?: Migration[], // injectable so the runner is testable without the real table
): { params: URLSearchParams; changed: boolean; applied: string[] };
// Both take the same optional `migrations` table, for the same reason.
export function migrateReport(
  report: Report,
  migrations?: Migration[],
): { report: Report; changed: boolean; applied: string[] };
export function migrateReports(
  reports: Reports,
  migrations?: Migration[],
): { reports: Reports; changed: boolean; applied: string[] };
```

`migrateReport` rebuilds only `queryParams` and **spreads the rest** (`{ ...report,
queryParams }`) — it must not enumerate `id` / `name` / `sections`, because
`fetcher.test.ts` ("keeps fields it does not know about, so a newer document survives a
save") pins forward-compatibility for unknown top-level fields. `Reports` is
`Partial<Record<string, Report>>`, so undefined values pass through untouched, and
`queryParams: ''` is a real stored shape (`storedQueryParams.ts` writes it for
report-of-reports documents). When `changed` is false both functions return the **same
object identity**, so the caller's `changed` check is also a cheap referential no-op.

### Wiring

**Read layer** — `fetcher.ts` gains `readAllReports`, which normalizes before publishing
and reports what it did; `getAllReports` keeps its signature and delegates. It stays a
read: no I/O beyond the existing `storage.get`, no `storage.update`.

```ts
export const readAllReports = async (storage: AppStorage) => {
  const stored = (await storage.get<Reports>(reportsKey)) || {};
  const { reports, changed, applied } = migrateReports(stored);
  routeData.reportsData = reports;
  return { reports, changed, applied };
};

export const getAllReports = async (storage: AppStorage) => (await readAllReports(storage)).reports;
```

The `changed` flag has to come out of the same call that read storage. Once the read
layer has normalized, the migrated map is indistinguishable from an already-migrated
one — a write layer that re-ran `migrateReports` on `getAllReports`' output would always
see `changed === false` and never write anything. (The earlier draft of this plan had
exactly that bug.)

**Write layer** — fire-and-forget from `useAllReports.ts`'s `queryFn`, once per session:

```ts
queryFn: async () => {
  const { reports, changed, applied } = await readAllReports(storage);
  void persistMigrations(storage, { reports, changed, applied }, { isLoggedIn });
  return reports;
};
```

_Not_ at the boot call site in `main-helper.js`, which the earlier draft named: that
`getAllReports` lives inside `if (report)` in `main-helper.js`, so it only runs on
a load whose URL already carries `?report=`. A user who lands on the app root and picks
a report from the sidebar navigates client-side and never reloads, so nothing would ever
converge for them — and "converges on first load after the release", the premise the
12-month EOL rests on, would really mean "first load carrying a saved-report deep link".
`useAllReports` runs wherever the reports UI does, which is a strict superset. The
module-level once-per-session flag keeps it to one attempt despite
`useSaveReports.tsx:32` invalidating the query after every save.

`persistMigrations` must satisfy **all** of:

| Guard                                             | Why                                                                                                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| once per session                                  | `useAllReports` refetches on every invalidation; the write is a convergence step, not a per-fetch one.                                                |
| `changed === false` → return                      | The load-bearing one. Turns "a background write to org-shared data on every page load" into "at most one write per install, per migration, ever."     |
| logged in                                         | Anonymous sample-data sessions must never write. Read from `routeData.isLoggedInObservable` (absent in tests → no write, which is the right default). |
| `await storage.storageInitialized()`              | The web backend's `update` **throws** without a configuration issue (`index.web.ts:118`), and `get` returns `null` in that state.                     |
| `.catch(console.warn)`, never awaited by a render | Never block the UI, never raise a user-facing flag. The read layer already made this session correct.                                                 |
| write immediately after the producing fetch       | `updateReports` PUTs the **whole** map (`index.plugin.ts:31` — full overwrite, last-write-wins, no ETag), so keep the read-modify-write window small. |

**Storage is shared, not per-user.** `index.plugin.ts:31` uses
`/rest/atlassian-connect/1/addons/{appKey}/properties/{key}`; addon properties are
per-_installation_, so one blob serves the whole Jira site. The lost-update hazard is
**pre-existing** — every `useSaveReports` call has it today (`useSaveReports.tsx:21`) —
but a background writer is worse than a user-initiated one because nobody is watching.
The `changed` guard is what keeps the exposure to a single write per install.

No cache coordination is needed: the read layer already normalized, so the React Query
cache holds the migrated shape and the write changes nothing observable.

**URL layer** — one function, `migrateUrlParams()` (`migrations/url.ts`), that runs
`migrateQueryParams` over `window.location.search` and writes the result back in **one**
`history.replaceState`. Same table, same order, one source of truth.
`legacyPrimaryIssueTypeRoutingFix` (`primaryIssueType` → `selectedIssueType`) moves into
the table too — it has the identical saved-report blind spot.

Not key-by-key with `directlyReplaceUrlParam`, which this replaces and which had a latent
bug: `history.replaceState(…, '')` resolves the empty string against the current document
URL, so deleting the last param silently did nothing. `state-storage.js` now exports
`directlyReplaceUrlSearch(search)` instead — whole search string, pathname when it comes
out empty, still bypassing `pushStateObservable`. One write also means untouched params
ride along for free (the runner started from a copy of the current search) and the URL
never passes through a half-migrated state. Values get re-encoded by `URLSearchParams` in
the process, which is equivalent for every reader in the app — all of them parse the
search the same way.

**It cannot stay at the current call site.** In the Connect host `configureRouting`
calls `routing.reconcileRoutingState()` (`plugin.main.ts`'s `configureRouting`), which replaces the
entire search string with the container's params —
`history.replaceState(null, '', '?' + objectToQueryString(AP.history.getState('all').query))`
(`routing/index.plugin.ts:20`) — and that happens inside the `configureRouting` call in `main-helper.js`, _after_ the
legacy fixes that preceded it. The raw `replaceState` behind them writes only
`window.location`, never AP state, so those edits are discarded: **the URL rewrite is a
no-op in Connect today**,
which is the one host whose published descriptor still ships the legacy param
(`scripts/atlassian-connect/index.ts:101`).

So the migration has to run _between_ reconcile and `route.start()`. That needs a seam
in the host contract, since both entries pass a single opaque `configureRouting`:

```js
// main-helper.js — replaces the two legacy*RoutingFix calls
configureRouting(route, { beforeRouteStart: migrateUrlParams });
```

```ts
// plugin.main.ts
configureRouting: (route, { beforeRouteStart }) => {
  routing.reconcileRoutingState(); // clobbers anything written before this line
  beforeRouteStart();
  route._onStartComplete = routing.syncRouters;
  route.start();
};
```

Before `route.start()` matters as well as after reconcile: the write deliberately does not
publish to `pushStateObservable`, so a rewrite after start would leave the observable
holding the pre-migration search string.

Only full page loads go through this. CanJS hijacks same-origin anchor clicks into
`pushState`, so an in-app link carrying a legacy param is not rewritten — which is fine,
because legacy URLs arrive as bookmarks and deep links, and those are full loads.

Nothing syncs the rewrite back to `AP.history` (`syncRouters` patches only `pushState`),
so in Connect the container URL keeps its legacy param and the migration re-runs on every
load. That is harmless — the URL layer performs no storage write and the runner is
idempotent — but it should carry a comment so the next reader doesn't hunt for the
convergence that isn't there.

### No version marker

A stored `schemaVersion` would only restate what `changed` already computes, and it
cannot be trusted: an older client can write a legacy-shaped record at any time, so
"this install is fully migrated" is never a durable fact. The EOL guard below is a
source-code check, not a data check, precisely for this reason.

---

<a id="end-of-life"></a>

## End of life

**Policy (ratified 2026-08-01): every migration is deleted 12 months after `addedOn`,
regardless of `onDrop`.** Usage is predominantly weekly, and write-back converges an
install on its first load after the release — so an install still un-migrated at 12
months has not been opened in 12 months. The accepted consequence is that a report
untouched for over a year may not come back cleanly, and for an `onDrop: 'fatal'` entry
that means it comes back as a different report.

Uniform beats nuanced here: one rule, one test, no per-entry argument about whether this
particular migration has earned an exemption. **`onDrop` is still required** — not to
alter the deadline, but to tell a reviewer how bad the deletion is, and to decide whether
an entry needs a release-note mention on its way out.

That trade is only acceptable because of the mechanisms below — in particular § 2, which
is what turns a `'fatal'` deletion from a silent substitution into an explanation. Do not
adopt the policy without it.

### 1. Classify by failure mode — `onDrop`

The right EOL differs by what breaks, which is why it is a required field. Note that
because `primaryReportType` is clamped to a known key (§ Problem), **no dropped
migration produces a blank page** — the worst case is a report that renders as a
different report:

| `onDrop`  | Meaning                                                                        | Example                                                                                              | On deletion                                                     |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `'lossy'` | A setting silently reverts to its default. The report still renders as itself. | `secondaryReportType` → `cardsMode`, `primaryReportType=breakdown` (loses only the breakdown toggle) | Ships quietly.                                                  |
| `'fatal'` | The saved report comes back as a **different** report.                         | `table2` → `table` (a Table report renders as a Gantt)                                               | Needs the § 2 guard **and** a release note naming the dead key. |

Both are deleted at 12 months (above). `onDrop` drives _how the deletion is handled_, not
_when_: a `'fatal'` removal is a user-visible breaking change and should be announced, a
`'lossy'` one is housekeeping.

### 2. Fail loudly, not wrongly — the permanent guard

Independent of any migration, and the single highest-value item in this plan:

A dead report-type key does not blank the page — `route-data.js:587-595` clamps it to
`REPORTS[0]`, so the user gets a Gantt over their JQL with no indication that this was
saved as something else. An empty page would at least look like a bug; this looks like
the app quietly disagreeing with them.

So the guard must be built on the **raw** value, not the clamped one:

```ts
// unsupportedReportType.ts — pure, sibling of showSecondaryReport.ts
// URL wins over the saved report, mirroring proposeValueFromState (state-storage.js:232-244).
// `knownReportTypes` is a string LIST, not the component map: `map[raw]` reports `constructor`
// and friends as known. `urlParams` is optional — embedded children never read the page URL.
const raw = urlParams?.get('primaryReportType') ?? paramValue(savedReport, 'primaryReportType');
return raw && !knownReportTypes.includes(raw) ? raw : undefined;
```

`ReportArea` takes it as a prop and short-circuits every other view state — the report
type is dead whatever the request does, so it must not wait on `resolved &&
primaryIssuesCount > 0` to say so. The message:

> **This report was saved in a format we no longer support.**
> It refers to a report type (`<type>`) that no longer exists. Pick a report type above
> to rebuild it, or delete it from Saved Reports.

Deliberately _not_ done by removing the clamp: an unrecognized key also arrives whenever
a **newer** client has saved a report type this build doesn't have yet, and degrading to
a Gantt is friendlier there than refusing to render. The raw-value check distinguishes
the two cases about as well as either can be distinguished — and after an EOL deletion
the dead key is exactly what's sitting in storage, so it reads correctly then.

**Wiring it into the shell without a URL subscription.** `TimelineReport` needs both
sources to stay live, but `useQueryParams(pushStateObservable)` would re-render the whole
shell on _every_ URL change — including a compare-slider drag. Derive instead, and
subscribe to the derived string:

```ts
const obs = useMemo(() => value.returnedBy<string | undefined>(() => unsupportedReportType({ … })), []);
const deadReportType = useCanObservable(obs);
```

`value.returnedBy` tracks both `pushStateObservable.value` and `rd.reportData`, so the
message clears the moment a real report type is picked, and the shell re-renders only when
the answer changes. It needs adding to the hand-written `Value` type in `can.d.ts` (it
exists in can-value and is already used from `.js`).

`ChildReport.tsx` already has an `Unknown report type` message but cannot reach it (its
`reportType` comes from the same clamp, `ChildReportConfig.js`'s `CHILD_PARAMS.primaryReportType`); give it the same raw
check off the child's own `queryParams`. Compare against the **`REPORTS` catalog**, not the
injected `components` map — the map is a test seam, and an incomplete one must still fall
through to the existing `Unknown report type` backstop rather than be reported as a dead
saved format. This flips an existing test: `ChildReport.test.tsx`'s "falls back to the
default report type for a value it does not recognize, as route-data does" documented
exactly the behaviour this replaces. The clamp stays; the child just stops _rendering_ the
substitute.

This is permanent — it is not a migration and never expires. It converts every future
EOL from "silently wrong" into "explained, recoverable," which is what makes deleting
migrations defensible at all. **Land it in the same PR as the migration runner**, before
any migration is ever dropped.

### 3. Make the deadline unmissable — the EOL test

Scheduled cleanup that depends on someone remembering does not happen. So:

```ts
// migrations.test.ts
it('has no migrations past their end of life', () => {
  const expired = MIGRATIONS.filter((m) => monthsSince(m.addedOn) > EOL_MONTHS);
  expect(
    expired.map(
      (m) => `${m.id} (added ${m.addedOn}) — see spec/018-card-report/saved-report-migrations/plan.md § End of life`,
    ),
  ).toEqual([]);
});
```

This test **will fail spontaneously**, on a date nobody chose. That is the feature: it
is the only reminder mechanism that cannot be ignored, and the fix is deleting a table
entry. Escape hatch for a mid-release failure: bump that entry's `addedOn` with a
comment saying why — an explicit, reviewable deferral rather than silent drift.

No exemptions — the policy is uniform, so the test covers every entry. Until the § 2
guard ships, that test failing on a `'fatal'` entry means _land the guard_, not _defer
the entry_.

### Deletion checklist

Per migration, when its test goes red:

1. Check `onDrop`. If `'fatal'`, confirm the § 2 guard shipped and draft the release
   note naming the dead key. If `'lossy'`, proceed.
2. Delete the entry from `migrations.ts` and its cases from `migrations.test.ts`.
3. `grep` the old param key across `src/`, `playwright/`, `scripts/` — a migration is
   not the only thing that can reference a dead key.
4. Note the removal in this file's changelog below, so a future reader can tell "EOL'd
   deliberately" from "never existed."

### Changelog

| Migration id                           | Added                 | `onDrop` | Removed |
| -------------------------------------- | --------------------- | -------- | ------- |
| `breakdown-primary-report-type`        | 2026-08-01            | lossy    | —       |
| `primary-issue-type-to-selected`       | 2026-08-01            | lossy    | —       |
| `table2-to-table`                      | 2026-08-01            | fatal    | —       |
| `secondary-report-type-to-cards-mode`  | (with parent Phase 1) | lossy    | —       |
| `secondary-child-filter-rows-to-cards` | (with parent Phase 1) | lossy    | —       |

---

## Phases

### Phase A — Mechanism (no behaviour change) — **LANDED**

- `migrations/types.ts`, `migrations/index.ts`, `migrations/migrations.ts` with an
  **empty** table, plus `migrations/persist.ts` and `migrations/url.ts`.
- Wire all three layers: read via `readAllReports` in `fetcher.ts`, guarded write from
  `useAllReports.ts`, URL rewrite behind the new `beforeRouteStart` seam (which means
  touching `main-helper.js`, `plugin.main.ts` and `web.main.ts`).
- Tests: runner over a synthetic table (ordering, `changed`, `applied`, input not
  mutated, object identity preserved), idempotency (`migrate(migrate(x))` equal **and**
  `changed === false` on the second pass), and each write guard proven to suppress the
  write.

**Exit:** empty table is a no-op; `tsc` + `vitest` green; no storage write occurs on any
load.

### Phase B — The pre-existing bugs — **LANDED**

- Add `breakdown-primary-report-type` (`primaryReportType=breakdown` → `start-due` +
  `primaryReportBreakdown=true`), `table2-to-table` (`onDrop: 'fatal'`, ratified — see
  the header), and move `primary-issue-type-to-selected` in from
  `legacyPrimaryIssueTypeRoutingFix`.

  That last one changes precedence on the way in, deliberately. The URL fix always let the
  legacy key win; the migration only applies when `selectedIssueType` is **absent**, because
  `primaryIssueType` is now a derived getter — `toSelectedParts(selectedIssueType).primary`
  (`route-data.js:787`) — so on a `Release-Epic` hierarchy pick it reads just `Release`.
  Copying that over `selectedIssueType` would flatten the selection, and any config that
  picks the derived key up again would re-trigger the migration on every read. Leaving both
  keys in place is harmless: nothing reads the legacy one.

- Delete both `legacy*RoutingFix` functions; `migrateUrlParams` replaces them.
- Add the § 2 unsupported-report-type guard: `unsupportedReportType.ts`, the message in
  `ReportMessages.tsx`, the `ReportArea` short-circuit, the `TimelineReport` wiring, and
  the raw check in `ChildReport.tsx`.

**Exit:** saved reports carrying `primaryReportType=breakdown` or `=table2` resolve to
the right report; a genuinely unknown type shows a message instead of silently rendering
a Gantt; the storage blob is rewritten once and not on the next load.

### Phase C — Cards entries (needs parent Phase 1) — **OUTSTANDING**

The whole of Phase C is two entries in `migrations.ts`, their cases in
`migrations.test.ts`, and two changelog rows. No new files, no new wiring — the mechanism
is done.

**Additive only.** Write `cardsMode` / `cardsChildFilterRows`; **keep**
`secondaryReportType` and `secondaryChildFilterRows` in place. Deleting them belongs to
the parent plan's **Phase 4**, alongside the code that reads them.

Additive changes what `applies` can test. "Source key present" would stay true forever —
the source is not being removed — so the entry would apply on every read and hand the write
layer a `changed: true` on every load. It has to be **source present _and_ target absent**,
which is also the behaviour you want the second time around: once a user has set
`cardsMode`, a stale `secondaryReportType` must not overwrite it. The idempotency test in
`migrations.test.ts` enforces this; the runner also warns at runtime.

```ts
{
  id: 'secondary-report-type-to-cards-mode',
  addedOn: '<ship date>',
  onDrop: 'lossy',
  describe: 'copies the legacy secondary report type into cardsMode',
  // 'none' is the slot's off switch, not a layout — it has no cardsMode to seed.
  applies: (params) =>
    ['status', 'breakdown'].includes(params.get('secondaryReportType') ?? '') && !params.get('cardsMode'),
  migrate: (params) => params.set('cardsMode', params.get('secondaryReportType') as string),
},
{
  id: 'secondary-child-filter-rows-to-cards',
  addedOn: '<ship date>',
  onDrop: 'lossy',
  describe: 'copies secondaryChildFilterRows into cardsChildFilterRows',
  // `'[]'` is truthy as a string — copying an empty list across would buy a write per install
  // for nothing.
  applies: (params) => {
    const rows = params.get('secondaryChildFilterRows');
    return !!rows && rows !== '[]' && !params.get('cardsChildFilterRows');
  },
  migrate: (params) => params.set('cardsChildFilterRows', params.get('secondaryChildFilterRows') as string),
},
```

Both values are copied verbatim: `cardsMode` takes the same `'status' | 'breakdown'`
strings, and `cardsChildFilterRows` the same JSON payload, provided Phase 1 defines those
params with the `secondary*` counterparts' serialization (`route-data.js`). If it doesn't,
convert here rather than teaching the report two shapes.

Parent Phase 4 then needs a **third, delete-only entry** (`drop-legacy-secondary-keys`) in
the same release that removes the params from `route-data.js` — that is what finally clears
the legacy keys out of stored data.

Dropping `secondaryReportType` at Phase C would take the card board away a release
early: `showSecondaryReport.ts:24` requires it to be `'status' | 'breakdown'`, and a
legacy saved report keeps `primaryReportType=start-due`, so the board would simply stop
rendering — and the Phase 3 deprecation warning, gated on the same call, would never
appear to explain it. The parent plan's § Migration policy (c) promises legacy configs
render unchanged through Phase 3; an additive migration keeps that promise while still
making the new keys available. Same argument for `secondaryChildFilterRows`, which the
legacy slot reads as `childFilterRowsObs` (`reportProps.ts:52-59`).

**No `secondaryFilterRows` → `filterRows` entry.** D4's losslessness argument holds for
a Cards report, but not for the legacy shape it would be migrating: the primary there is
the Gantt, and `primaryIssuesOrReleases` applies `routeData.effectiveFilterRows`
(`timeline-report-view-model.js:148-155, 202`) while the cards get `secondaryFilterRows`
as their own `filterRowsObs` (`reportProps.ts:57`). Merging the two lists therefore
narrows **the timeline** — visibly during Phases 1–3, and permanently after Phase 4,
when the cards are gone and the merged rows keep filtering the Gantt. Gating the entry on
`primaryReportType === 'cards'` would make it dead code (no legacy record carries that
value), so the merge belongs to the explicit conversion action instead — the Phase 3
"Show this as a Cards report" link and the optional Phase 3.5 split, both of which do set
the primary to `cards`.

**Tests to add**, alongside the existing per-entry blocks in `migrations.test.ts`: a line in
`APPLIES_TO` for each new id (a test fails if you forget, and without it the idempotency loop
would pass vacuously); each entry's happy path; `secondaryReportType=none` is a no-op; an
existing `cardsMode` is never overwritten; and — the one that matters — the shared idempotency
loop still passes, which it will only do if `applies` tests the target key. The `fetcher.test.ts` read-layer block
is the place for one end-to-end case over a stored report.

**Exit:** legacy saved reports resolve `cardsMode` / `cardsChildFilterRows` correctly
while continuing to render the legacy slot; a second load writes nothing. Closes parent
**D2**'s residual case — a legacy saved report switched to Cards now picks up its old mode,
because `cardsMode` is present in the normalized `queryParams`.

---

## Open questions

1. ~~Should `persistMigrations` be skipped in the Connect deep-link context?~~
   Resolved by the write layer moving to `useAllReports`: the write is no longer tied to
   a page load at all, and the Connect deep-link path needs the _URL_ layer (which does
   no writing). A one-off embed that never opens the reports UI never writes.
2. `migrateUrlParams` rewrites the iframe URL only; the Connect container keeps its
   legacy param, so the rewrite repeats every load. Worth teaching `syncRouters` to
   mirror `replaceState` into `AP.history`, or leave it? (Out of scope here — the repeat
   is harmless.)
