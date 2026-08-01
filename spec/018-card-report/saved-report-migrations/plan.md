# Saved-report migrations — implementation plan

Sub-plan of [`spec/018-card-report/plan.md`](../plan.md) (decision **D8**, scheduled as
its Phase 1.5). Separated so it can be built, reviewed and shipped on its own: nothing
here is specific to the Cards report.

**Verified against `feat/017-remove-legacy-reports` @ `1386d392`**, on which
[spec/017](../../017-remove-legacy-reports/plan.md) has already landed — Grouper and
Estimation Table are deleted and `table2` → `table` is done. That rename shipped
_without_ an alias, deliberately (Phase 3 commit `6a7ca435`: _"No table2->table alias —
old saved keys break, acceptable per 012 Q2"_), so a saved report carrying
`primaryReportType=table2` renders blank today. **Ratified 2026-08-01: add the
migration.** It deliberately reverses that decision, on the grounds that the entry costs
three lines and the alternative leaves working reports blank. It is `onDrop: 'fatal'`.

**Dependency:** the migration _table_ references keys that Phase 1 of the parent plan
introduces (`cardsMode`, `cardsChildFilterRows`). The _mechanism_ has no such
dependency — build and land it with only the `primaryReportType=breakdown` entry, then
add Cards rows when Phase 1 lands. That ordering also proves the mechanism against a
real, pre-existing bug rather than against a rename we authored.

---

## Problem

Two independent problems, one shared cause.

**1. The boot-time URL rewrite cannot reach saved reports.** `main-helper.js:32-33`
runs `legacyPrimaryReportingTypeRoutingFix()` and `legacyPrimaryIssueTypeRoutingFix()`
before `configureRouting`, using `directlyReplaceUrlParam` (`state-storage.js:415`) — a
raw `history.replaceState` that deliberately does not publish to `pushStateObservable`
(`:423`), so the URL is corrected before anything observes it.

It only ever touches `window.location`. Saved-report params never pass through the URL;
they resolve off `reportData.queryParams` via `paramValue()` (`state-storage.js:437`).

**This is a live bug, not a hypothetical.** A saved report still carrying
`primaryReportType=breakdown` is never fixed. `reportComponents['breakdown']` is
`undefined`, and `TimelineReport.tsx:132` renders `{PrimaryReport && …}` — so the report
area is **silently blank**. (`ChildReport.tsx` does better: it shows
`Unknown report type "X"`. The shell has no such fallback.)

**2. Renames silently drop user configuration.** Nothing translates an old param key to
a new one in stored data, so a rename either loses the setting or forces the old key to
live forever.

---

## Design

### Layers

| Layer                 | Where                             | Purpose                          | If it fails                 |
| --------------------- | --------------------------------- | -------------------------------- | --------------------------- |
| **Normalize on read** | `getAllReports` (`fetcher.ts:23`) | **Correctness.** Always applied. | n/a — pure, no I/O          |
| **Persist on boot**   | once, at `main-helper.js:94`      | **Convergence.** Cleans storage. | Nothing — retried next load |
| **Rewrite the URL**   | `main-helper.js:170`              | Legacy links/bookmarks.          | Nothing — read layer covers |

Read-time is the correctness layer and is always applied. Write-back is what makes
[EOL](#end-of-life) possible — without it, stored data never converges and no migration
could ever be deleted. But correctness must never _depend_ on the write: if it did, any
report that failed to migrate (offline, no configuration issue, permission error, lost
race) would render broken.

### File layout

```
src/jira/reports/
  fetcher.ts              (existing — gains the read-layer call)
  migrations/
    index.ts              runMigrations() + the public API
    migrations.ts         THE ORDERED TABLE — the only file that changes per migration
    types.ts              Migration interface
    migrations.test.ts    per-migration cases + the EOL guard test
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
anything to do?" cheaply is a migration that will write on every page load.

### The API

```ts
// index.ts — pure, no I/O, idempotent
export function migrateQueryParams(raw: string | URLSearchParams): {
  params: URLSearchParams;
  changed: boolean;
  applied: string[]; // migration ids, for logging
};
export function migrateReport(report: Report): { report: Report; changed: boolean }; // `sections` passes through untouched
export function migrateReports(reports: Reports): { reports: Reports; changed: boolean };
```

`migrateReport` rebuilds only `queryParams`; `id`, `name` and `sections` are copied by
reference. When `changed` is false it returns the **same object identity**, so the
caller's `changed` check is also a cheap referential no-op.

### Wiring

**Read layer** — `getAllReports` (`fetcher.ts:23`) normalizes before publishing. It stays
a read: no I/O, no `storage.update`.

```ts
const raw = (await storage.get<Reports>(reportsKey)) || {};
const { reports } = migrateReports(raw);
routeData.reportsData = reports;
return reports;
```

**Write layer** — at the existing boot call site (`main-helper.js:94`), _not_ inside the
fetcher. `useAllReports.ts:16` refetches on invalidation and `useSaveReports.tsx:32`
invalidates after every save; a write inside `getAllReports` would re-run this check on
each one. At boot it runs exactly once per load.

```ts
getAllReports(storage).then((reports) => {
  // …existing seeding…
  void persistMigrations(storage, reports); // fire-and-forget
});
```

`persistMigrations` must satisfy **all** of:

| Guard                                       | Why                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed === false` → return                | The load-bearing one. Turns "a background write to org-shared data on every page load" into "at most one write per install, per migration, ever."     |
| logged in                                   | Anonymous sample-data sessions must never write.                                                                                                      |
| `await storage.storageInitialized()`        | The web backend's `update` **throws** without a configuration issue (`index.web.ts:115-119`), and `get` returns `null` in that state.                 |
| after first paint, `.catch(console.warn)`   | Never block boot, never raise a user-facing flag. The read layer already made this session correct.                                                   |
| write immediately after the producing fetch | `updateReports` PUTs the **whole** map (`index.plugin.ts:31` — full overwrite, last-write-wins, no ETag), so keep the read-modify-write window small. |

**Storage is shared, not per-user.** `index.plugin.ts:31` uses
`/rest/atlassian-connect/1/addons/{appKey}/properties/{key}`; addon properties are
per-_installation_, so one blob serves the whole Jira site. The lost-update hazard is
**pre-existing** — every `useSaveReports` call has it today (`useSaveReports.tsx:21`) —
but a background writer is worse than a user-initiated one because nobody is watching.
The `changed` guard is what keeps the exposure to a single write per install.

No cache coordination is needed: the read layer already normalized, so the React Query
cache holds the migrated shape and the write changes nothing observable.

**URL layer** — refactor `legacyPrimaryReportingTypeRoutingFix` (`main-helper.js:170`) to
run `migrateQueryParams` over the current search params and apply each changed key with
`directlyReplaceUrlParam`. Same table, same order, one source of truth.

`legacyPrimaryIssueTypeRoutingFix` (`primaryIssueType` → `selectedIssueType`) should
move into the table too — it has the identical saved-report blind spot.

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
that means it does not come back at all.

Uniform beats nuanced here: one rule, one test, no per-entry argument about whether this
particular migration has earned an exemption. **`onDrop` is still required** — not to
alter the deadline, but to tell a reviewer how bad the deletion is, and to decide whether
an entry needs a release-note mention on its way out.

That trade is only acceptable because of the mechanisms below — in particular § 2, which
is what turns a `'fatal'` deletion from a blank page into an explanation. Do not adopt
the policy without it.

### 1. Classify by failure mode — `onDrop`

The right EOL differs by what breaks, which is why it is a required field:

| `onDrop`  | Meaning                                                          | Example                                           | On deletion                                                     |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `'lossy'` | A setting silently reverts to its default. Report still renders. | `secondaryReportType` → `cardsMode`               | Ships quietly.                                                  |
| `'fatal'` | The report does not render at all.                               | `primaryReportType=breakdown`, `table2` → `table` | Needs the § 2 guard **and** a release note naming the dead key. |

Both are deleted at 12 months (above). `onDrop` drives _how the deletion is handled_, not
_when_: a `'fatal'` removal is a user-visible breaking change and should be announced, a
`'lossy'` one is housekeeping.

### 2. Fail loudly, not blankly — the permanent guard

Independent of any migration, and the single highest-value item in this plan:

`TimelineReport.tsx:132` resolves `reportComponents[primaryReportType]` and renders
`{PrimaryReport && …}`. An unrecognized type therefore produces **no report and no
message** — an empty page with working chrome, indistinguishable from a bug.

Add the shell fallback that `ChildReport.tsx` already has:

> **This report was saved in a format we no longer support.**
> It refers to a report type (`<type>`) that no longer exists. Pick a report type above
> to rebuild it, or delete it from Saved Reports.

This is permanent — it is not a migration and never expires. It converts every future
EOL from "broken, silently" into "explained, recoverable," which is what makes deleting
migrations defensible at all. **Land it in the same PR as the migration runner**, before
any migration is ever dropped.

### 3. Make the deadline unmissable — the EOL test

Scheduled cleanup that depends on someone remembering does not happen. So:

```ts
// migrations.test.ts
it('has no migrations past their end of life', () => {
  const expired = MIGRATIONS.filter((m) => monthsSince(m.addedOn) > EOL_MONTHS);
  expect(expired.map((m) => `${m.id} (added ${m.addedOn}) — see spec/018 § End of life`)).toEqual([]);
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

| Migration id                          | Added                 | `onDrop` | Removed |
| ------------------------------------- | --------------------- | -------- | ------- |
| `breakdown-primary-report-type`       | 2026-08-xx            | fatal    | —       |
| `primary-issue-type-to-selected`      | 2026-08-xx            | lossy    | —       |
| `secondary-report-type-to-cards-mode` | (with parent Phase 1) | lossy    | —       |
| `secondary-filter-rows-to-cards`      | (with parent Phase 1) | lossy    | —       |

---

## Phases

### Phase A — Mechanism (no behaviour change)

- `migrations/types.ts`, `migrations/index.ts`, `migrations/migrations.ts` with an
  **empty** table.
- Wire all three layers: read in `getAllReports`, guarded write at `main-helper.js:94`,
  URL rewrite refactored to call `migrateQueryParams`.
- Tests: runner over a synthetic table (ordering, `changed`, `applied`), idempotency
  (`migrate(migrate(x))` equal **and** `changed === false` on the second pass), and each
  write guard proven to suppress the write.

**Exit:** empty table is a no-op; `tsc` + `vitest` green; no storage write occurs on any
load.

### Phase B — The pre-existing bugs

- Add `breakdown-primary-report-type` (`primaryReportType=breakdown` → `start-due` +
  `primaryReportBreakdown=true`), `table2-to-table` (`onDrop: 'fatal'`, ratified — see
  the header), and move `primary-issue-type-to-selected` in from
  `legacyPrimaryIssueTypeRoutingFix`.
- Delete the now-duplicated bodies of both `legacy*RoutingFix` functions, keeping their
  call sites pointed at the shared runner.
- Add the § 2 unknown-report-type fallback to `TimelineReport.tsx`.

**Exit:** saved reports carrying `primaryReportType=breakdown` or `=table2` render
again; an unrecognized type shows a message instead of a blank page; the storage blob is
rewritten once and not on the next load.

### Phase C — Cards entries (needs parent Phase 1)

- `secondary-report-type-to-cards-mode`, `secondary-child-filter-rows-to-cards`, and
  `secondary-filter-rows` merged into `filterRows` (parent **D4**).

**Exit:** legacy saved reports resolve `cardsMode` / `cardsChildFilterRows` /
`filterRows` correctly. Closes parent **D2**'s residual case — a legacy saved report
switched to Cards now picks up its old mode, because `cardsMode` is present in the
normalized `queryParams`.

---

## Open questions

1. Should `persistMigrations` be skipped in the Connect deep-link context
   (`/connect.html?...`), where the session may be a one-off embed rather than a normal
   app load?
