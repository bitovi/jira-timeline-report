# Cards report — promoting the "secondary" report to a first-class report type

Now that [report-of-reports](../016-report-of-reports/) exists, the "secondary report"
slot — a second report rendered _below_ the Gantt or Scatter primary — no longer
needs to be a slot. A user who wants cards **and** a timeline can compose both in a
document. So the secondary report should become an ordinary primary report type
named **Cards**, and the slot should go away.

> **Verified against `feat/017-remove-legacy-reports` @ `1386d392`** (2026-08-01), on
> which spec/017 has already landed — Grouper and Estimation Table are deleted and
> `table2` → `table` is done. Line numbers below were checked at that commit; re-verify
> with `grep` before trusting one that looks off.

## TL;DR — this is not a rename

Three things make it more than a find-and-replace:

1. **`secondaryReportType` is three things at once.** It is the on/off switch for the
   slot (`none`), _and_ the cards' layout mode (`status` vs `breakdown`), _and_ a
   persisted param baked into saved reports, bookmarks, the Atlassian Connect
   deep-link descriptor, and the logged-out sample links. Promoting the report
   collapses meaning (1) into `primaryReportType=cards` and needs a **new** param for
   meaning (2).
2. **One URL currently encodes two reports.** `?primaryReportType=start-due&secondaryReportType=breakdown`
   is a Gantt _and_ a card board. `primaryReportType` is single-valued, so no
   automatic migration can preserve both — the replacement (a report-of-reports
   document) is not a URL, it is _three_ saved records (two children + a parent with
   `sections`), and it is behind a feature flag that is off by default. See
   [§ Migration policy](#migration-policy).
3. **"Secondary" and "breakdown" are both overloaded**, and one of the collisions is
   load-bearing. `secondaryIssueType` (`route-data.js:790`) is the _hierarchy_ pick for
   `Release-Epic`-style selections and has nothing to do with the secondary report; a
   blind rename breaks issue-type selection. Likewise `primaryReportBreakdown` /
   "Show work breakdown" (`ShowWorkBreakdown.tsx`, flag `workBreakdowns`) is a **Gantt**
   view option, unrelated to the `secondaryReportType=breakdown` card layout or the
   `WorkBreakdown/` report directory. Renaming to "Cards" is worth doing partly
   _because_ it untangles this — but each "breakdown" has to be classified before it
   is touched.

Recommended shape: **add `cards` as a real report type first (additive, zero risk),
then retire the authoring path, then delete the slot in a later release.** Details in
[§ Phases](#phases).

---

## Current state (verified)

### The slot

- **Render**: `TimelineReport.tsx:223-227` renders `<WorkBreakdown>` into
  `#react-secondary-report-container`, gated by `showSecondaryReport(primaryReportType, secondaryReportType)`
  (`TimelineReport.tsx:136`).
- **Gate**: `showSecondaryReport.ts:7` pins
  `PRIMARY_REPORT_TYPES_SUPPORTING_SECONDARY = ['start-due', 'due']`; `:16` also
  requires `secondaryReportType` to be `'status' | 'breakdown'`. Tested in
  `showSecondaryReport.test.ts`.
- **Props**: `secondaryPropsFor(vm, routeData)` (`reportProps.ts:52-59`) — a
  _separate_ bag from `propsFor`, carrying `planningIssuesObs`,
  `secondaryReportTypeObs`, `filterRowsObs`, `childFilterRowsObs`.
- **Component**: `src/react/reports/WorkBreakdown/` (~40 files: `WorkBreakdown.tsx`,
  `types.ts`, `fixtures.ts`, 10 `components/`, 14 `helpers/` + their tests, stories).
  Exported from `registry.ts:40` _outside_ the `embeddableReportComponents` map.
- **Mode**: `WorkBreakdown.tsx:50` maps `secondaryReportType` → `SecondaryReportMode`
  (`'breakdown'` else `'status'`), consumed by `buildBoard` and `WorkBreakdownCard`.
- **The render path is NOT feature-flagged.** `showSecondaryReport` reads only the two
  params, and `TimelineReport.tsx` never imports `useFeatures`. The `secondaryReport`
  flag gates only the _controls_ (`GanttViewSettings.tsx:19`,
  `ScatterPlotViewSettings.tsx:17`, `Filters.tsx:50`). So anyone holding a URL, saved
  report, deep link or sample link renders the board with no flag at all — including
  logged-out visitors, via `SampleDataNotice.tsx:17`. **The set of users who see the
  slot is strictly larger than the set who can author one**, which is what makes
  Phase 4's deletion the risky step rather than Phase 3's.

### Routing / persistence

- `route-data.js:905` `secondaryReportType` (default `'none'`).
- `route-data.js:936` `secondaryFilterRows` — card-level filter rows, applied inside
  `buildBoard`.
- `route-data.js:940` `secondaryChildFilterRows` — child-row filter rows.
- All three are listed in `ChildReportConfig.js:208-222` `SHELL_ONLY_PARAM_KEYS`
  ("children render no secondary report in v1"), and the drift tests at
  `ChildReportConfig.test.js:353-383` **fail the build** if a `route-data` param is in
  none of the buckets. `planningStatuses` is already a `CHILD_PARAM`
  (`ChildReportConfig.js:106`).

### Controls

- `SecondaryReportType.tsx` — the `None / Status / Work Breakdown` select, rendered
  from `GanttViewSettings.tsx:42-51` and `ScatterPlotViewSettings.tsx:35-42`, both
  gated on the `secondaryReport` feature flag, both bundling
  `StatusesShownAsPlanning` alongside it.
- `Filters.tsx:84-121` — two extra `FilterRowsBuilder` sections ("Secondary Report
  {type} Status Filtering" ×2) shown when the flag is on _and_ `secondaryReportType`
  is set and not `none`.
- `configuration/features.ts:10-16` — the `secondaryReport` flag (`:12`), `onByDefault: false`.

### Data pipeline

- `timeline-report-view-model.js:135-146` `planningIssues` — derived from
  `planningStatuses`; the source of the "Planning" fallback card.
- `:171-179` `primaryIssuesOrReleases` **excludes** planning-status issues and applies
  `effectiveFilterRows`. So card-level filtering is _already_ applied once before
  `secondaryFilterRows` is applied again.
- `:168` `isScatterPlot = primaryReportType === 'due'` changes what
  `hideUnknownInitiatives` means (due-only vs start-before-due).

### Chrome that keys off `primaryReportType`

`configuration/reports.ts:11-75` (dropdown + flag) → `SelectReportType/utilities.ts`;
`registry.ts` / `shellRegistry.ts`; `ReportControls.tsx` (per-type branches at `:220-288`); `ViewSettings.tsx:39-58` (map + 4-way
guard); `ReportFooter.tsx:7-10`; `PrintReportButton.tsx:16`
(`PRINTABLE_REPORT_TYPES`); `Filters.tsx:82` (date-range filter).

`registry.test.ts` asserts `reportComponents` keys **exactly equal** the keys in
`configuration/reports.ts`, and that `embeddableReportComponents` equals that set
minus `report-of-reports`. Adding `cards` to the config therefore _forces_ both
registry entries — including report-of-reports embeddability.

### External / contract surfaces

- `scripts/atlassian-connect/index.ts:101` — the published deep-link general page
  passes `secondaryReportType={ac.<key>.secondaryReportType}`.
- `SampleDataNotice.tsx:14-27` — 2 of the 3 logged-out sample links use
  `secondaryReportType`.
- `playwright/unauthenticated/sample-reports-navigation.spec.ts:21,37,61,74` — asserts
  both the URL param and `#react-secondary-report-container`.
- `src/examples/bitovi-training.js` / `public/examples/bitovi-training.js` — comments
  only.

---

## Decisions

**D1, D4 and the naming question were ratified by the product owner on 2026-08-01** and
are no longer open; the rest stand as recommendations (bold) that an implementer may
proceed on. Each is cheap to flip before Phase 1 and expensive after.

| #   | Question                                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | URL key for the new report type           | **`cards`** — **ratified 2026-08-01.** Plain noun, matching the existing `table` entry. Rejected: `status-cards` (collides with the `status` mode) and `work-breakdown` (collides with the Gantt's "Show work breakdown" option, the exact ambiguity this rename removes). Directory becomes `CardsReport/` (D5), mode param `cardsMode` (D2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D2  | Layout-mode param                         | **New `cardsMode` (`status` \| `breakdown`, default `status`). No fallback to `secondaryReportType`.** Reusing `secondaryReportType` would keep the confusing name and its `none` value forever. A fallback would be dead code: it could only fire for a config carrying `primaryReportType=cards` _and_ a legacy `secondaryReportType` _and_ no `cardsMode`, which nothing written before this spec can have — `cards` is a new value, so every legacy config says `start-due`/`due` and takes the legacy-slot path instead. The one link that could hit it is the Phase 3 deprecation link, which we generate and which writes `cardsMode` itself. Residual case: switching an already-open legacy saved report to Cards via the dropdown lands in `status` mode — the mode select is right there, and re-saving persists `cardsMode`.                                                                                                                                                               |
| D3  | Feature flag                              | **New flag `cardsReport`, `onByDefault: false`, and it stays that way.** Cards is a new experimental report replacing an old one; it graduates on its own merits, not on this spec's schedule. Alias it from `secondaryReport` at read time (D6). Graduation is not part of Phases 1–3 — it is the **precondition for Phase 4** (see there). Same for `reportOfReports`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D4  | Keep `secondaryFilterRows`?               | **No — ratified 2026-08-01.** `secondaryFilterRows` only exists because a Gantt and a card board share one page and one `filterRows`; as its own report, Cards' standard Filters control (`effectiveFilterRows` in the vm) already narrows the cards. The independent-filtering case is now report-of-reports, where each child owns its `filterRows`. **Concatenation is lossless _for the cards_:** a card shows today iff it passes `filterRows` **and** `secondaryFilterRows`, and `matchesAllFilterRows` requires every row to match — so concatenating the two lists leaves the card set unchanged. It is _not_ lossless for a legacy config, where the primary is a Gantt that filters on `filterRows` alone — so the concatenation happens on explicit conversion to Cards, never as a param migration. See [§ Saved-report migration](#saved-report-migration). `secondaryChildFilterRows` is _not_ redundant (it filters child rows _inside_ a card) and survives as `cardsChildFilterRows`. |
| D5  | Rename `WorkBreakdown/` → `CardsReport/`? | **Yes, but last** (Phase 5), as an isolated mechanical commit. Doing it in Phase 1 makes the behavioural diff unreviewable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D6  | Old feature-flag opt-in                   | **Migrate it.** `Features.tsx:13-21 removePreviousFeatures` silently drops unknown flag keys, so a bare rename resets everyone who had "Secondary Report" on. Map `secondaryReport → cardsReport` in `getFeatures` (`src/jira/features/fetcher.ts:16`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D7  | Legacy slot                               | **Keep rendering it through Phase 3; delete in Phase 4** (separate release). See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D8  | Saved-report migrations                   | **One migration table, three consumers: the boot URL rewrite, read-time normalization in `fetcher.ts`, and a guarded write-back that runs once per session from `useAllReports`.** Read-time is the correctness layer; the write is what makes scheduled EOL possible. Specified and scheduled separately — [`saved-report-migrations/plan.md`](saved-report-migrations/plan.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

<a id="saved-report-migration"></a>

## Saved-report migration (D8)

**Full plan: [`saved-report-migrations/plan.md`](saved-report-migrations/plan.md).**
Separated so it can be built, reviewed and shipped independently — nothing in it is
specific to Cards, and it retroactively covers spec/017's already-shipped `table2` →
`table` rename if desired (see Open questions).

The short version:

- **The boot-time URL rewrite cannot reach saved reports.** `main-helper.js:32-33`
  rewrites `window.location` only; saved-report params resolve off
  `reportData.queryParams` via `paramValue()` (`state-storage.js:437`). A saved report
  carrying `primaryReportType=breakdown` is therefore never fixed. It does **not** render
  blank: `route-data.js:587-595` clamps any unrecognized report type to `REPORTS[0]`, so
  the user silently gets a Gantt — for `breakdown` that costs only the
  `primaryReportBreakdown` toggle, but a `table2` report comes back as somebody else's
  report entirely. A live bug today, independent of this spec.
- **One ordered migration table, three consumers**: the URL rewrite, read-time
  normalization in `fetcher.ts`, and a guarded write-back that runs once per session from
  `useAllReports.ts`. Read-time is the correctness layer; the write is what lets
  migrations eventually be **deleted**, and is guarded on `changed` + logged-in +
  `storageInitialized()`.
- **Migrations are end-of-lifed on a schedule** (12 months), which is only safe because
  of a permanent "this report was saved in a format we no longer support" message in the
  shell — keyed off the **raw** saved value, since the clamp above means the clamped one
  is always a valid report type. That guard is the highest-value item in the sub-plan and
  should land with the runner.

What it buys this spec, and where the boundary is:

| Transform                                           | Covered                                                  |
| --------------------------------------------------- | -------------------------------------------------------- |
| `secondaryReportType` → `cardsMode`                 | yes — **additively**; the legacy key stays until Phase 4 |
| `secondaryChildFilterRows` → `cardsChildFilterRows` | yes — additively, same reason                            |
| merge `secondaryFilterRows` into `filterRows` (D4)  | **no** — not as a data migration; see below              |
| `primaryReportType=breakdown` → `start-due`         | yes — fixes the pre-existing bug above                   |
| one saved report → Gantt + Cards + parent document  | **no**                                                   |

Rows 1–2 are additive because dropping `secondaryReportType` would stop the legacy slot
rendering (`showSecondaryReport.ts:24` requires it) a release before Phase 4 intends to,
and would silence the Phase 3 warning that explains the change — the warning is gated on
the same call.

Row 3 was previously listed as covered. It cannot be: D4's losslessness argument holds
for a Cards report, but in the legacy shape the primary is the Gantt, which filters on
`filterRows` (`timeline-report-view-model.js:148-155`) while the cards filter on
`secondaryFilterRows` (`reportProps.ts:57`). Merging the lists narrows the **timeline**,
during Phases 1–3 and permanently after Phase 4. The merge therefore belongs to the
explicit conversion action — the Phase 3 "Show this as a Cards report" link and the
optional Phase 3.5 split, which do set the primary to `cards` — not to a param rewrite.
D4's decision (Cards has no `secondaryFilterRows`) is unaffected.

The last row is the other boundary. Splitting one record into three and inventing a parent
document is not a transform — it changes the user's report list under them and can
produce a document type they have not enabled. That stays an explicit action
(Phase 3.5), never an automatic migration. So the migration layer cleanly solves the
mechanical half and leaves the hard half exactly where § Migration policy puts it.

---

<a id="migration-policy"></a>

## Migration policy — the hard part

A legacy config carries **two** reports. The options:

- **(a) Auto-split into a report-of-reports document.** Faithful, and it is the story
  we are selling. But it must create two new saved reports plus a parent with
  `sections`, mutate the shared `saved-reports` storage blob
  (`src/jira/reports/fetcher.ts`), and it produces a document type the user may not
  have enabled (`reportOfReports` is `onByDefault: false`). A destructive one-way
  rewrite of user data, run at load time, for a cosmetic rename. **Not recommended
  as an automatic migration.**
- **(b) Drop the cards, keep the timeline.** One-line change, silent data loss in the
  view.
- **(c) Keep rendering the legacy slot for legacy configs only** — the param still
  works if present, but the UI stops offering a way to create one. Every existing
  saved report, bookmark and deep link keeps looking exactly as it does today, and
  nothing new can be authored into the deprecated shape. **Recommended.**

So: **(c) now, (a) later as an opt-in button, never automatically.** Concretely —

- Phase 1–3 leave `showSecondaryReport` and `secondaryPropsFor` untouched. A legacy
  URL renders unchanged.
- Phase 3 adds the deprecation warning described below.
- Optional **Phase 3.5**: a "Split into a Report of Reports" button, which does (a) on
  explicit click for the currently open saved report. Nice-to-have; not on the critical
  path — but it is what turns the warning's second bullet from instructions into one
  click.
- Phase 4 deletes the slot. At that point legacy configs lose the card board and keep
  the timeline — outcome (b), but a release later and after users have been told.

### The deprecation warning

**Placement.** An `@atlaskit/SectionMessage` (the pattern `SampleDataNotice` and
`ViewReportsWrapper` already use) rendered in `TimelineReport.tsx` immediately _above_
`#react-secondary-report-container`, gated by the **same** `showSecondaryReport(…)`
call that renders the slot. Attaching it to the deprecated thing means it appears
exactly when the deprecated thing does, and Phase 4 deletes both in one edit. Not the
View Settings dropdown — Phase 3 removes the Secondary Report Type select from there,
so the user has no reason left to open it.

**Copy** (`appearance="warning"`):

> **The secondary report is becoming the Cards report.** The board below is now its own
> report type, and this slot will be removed in a future release.
>
> - **[Show this as a Cards report]** — switches this page to `primaryReportType=cards`
>   with the matching `cardsMode`, dropping the timeline above.
> - To keep the timeline **and** the cards on one page, build a **Report of Reports**
>   containing both.
> - Don't see **Cards** or **Report of Reports** in the report dropdown? Turn them on
>   under **Settings → Features**.

**Who sees it: everyone the slot renders for.** Gated on `showSecondaryReport(…)` and
nothing else — no feature check. Both `cardsReport` and `reportOfReports` stay
`onByDefault: false` (D3), and the slot renders for users holding neither flag
(§ Current state) — but that is an argument for reaching them, not for staying quiet:
they are precisely the people who lose a board in Phase 4. The third bullet tells them
how to turn the replacements on, and is a no-op for anyone who already has them.

Two things make a flag-blind warning actionable rather than a tease:

- **The link works with the flag off.** `SelectReportType.tsx:16-19` resolves the
  current report against the full `REPORTS` list rather than the filtered dropdown,
  specifically so a URL can select a flag-hidden report — _"these options can still
  function if the url defaults to that value."_ So `?primaryReportType=cards` renders
  Cards for anyone. The flag only governs whether Cards is **pickable** for new reports.
- **The copy names where to enable them** — Settings → Features (`Features.tsx`), which
  every logged-in user can reach.

So the notice needs **no `useFeatures` call**: `TimelineReport.tsx` gains no
feature-flag dependency and no extra `QueryClientProvider` / `StorageProvider` /
`Suspense` wrapper (the dance `Filters.tsx:41-45` documents). Rejected alternative:
branch the copy on `cardsReport` so as not to say "enable Cards" to someone who has it.
Not worth dragging the provider stack into the shell for a notice Phase 4 deletes.

**One population can't act on it: logged-out sample viewers.** `showingConfiguration =
isLoggedIn` (`TimelineReport.tsx:96`) hides the settings sidebar entirely, so an
anonymous visitor arriving via `SampleDataNotice.tsx:17` would be pointed at a panel
they cannot open. Fix it at the source rather than branching the copy: **the
`SampleDataNotice` link rewrite moves out of Phase 4 and into Phase 3**, so our own
sample links stop using the slot before the warning ships. After that, every config
still hitting it is user-owned and its owner is logged in.

**Not dismissible, and deliberately so.** It only renders for a config actively using
the deprecated slot, and it disappears the moment that config is migrated — so it is
already self-limiting and needs no dismissal state in `AppStorage`. A dismissible
variant would need a new storage key and would let the warning be silenced right up
until Phase 4 deletes the board out from under the user. If it proves too noisy for a
saved report someone opens daily, revisit then.

**Carries `print-hidden`** (`src/css/print.css:58`) so it stays off exported PDFs.

**Saved reports need more than the link.** The "[Show this as a Cards report]" action
changes the page, not the stored record — a user with a legacy _saved_ report must
re-save it as Cards, or build a document. The warning's wording should not imply the
click is permanent. Phase 3.5 is the fix if this proves to be the common case.

---

<a id="phases"></a>

## Phases

### Phase 1 — `cards` as a primary report type (additive)

Nothing existing changes behaviour. New surface only.

1. `configuration/reports.ts` — add `{ key: 'cards', name: 'Cards', featureSubtitle: 'Status and work-breakdown cards, one per issue', featureFlag: 'cardsReport', onByDefault: false }`.
2. `registry.ts` — add `cards: WorkBreakdown` to `embeddableReportComponents`
   (`registry.test.ts` requires it; `shellRegistry` spreads it). Keep the existing
   bare `export { WorkBreakdown }` until Phase 4.
3. `route-data.js` — add `cardsMode` (default `'status'`) and `cardsChildFilterRows`
   (default `[]`), using the same `saveJSONToUrlButAlsoLookAtReport_DataWrapper`
   helpers as their `secondary*` counterparts. Add both to `CHILD_PARAMS` in
   `ChildReportConfig.js` so the drift test passes and children can carry them. Leave
   the three `secondary*` keys in `SHELL_ONLY_PARAM_KEYS`.
4. `reportProps.ts` — `propsFor` gains `planningIssuesObs`, `cardsModeObs`,
   `cardsChildFilterRowsObs`. **Note:** `reportProps.test.ts` pins the key set to the
   list captured at extraction time and its comment explicitly says not to edit it to
   match a failing `propsFor`. Add a **separate, dated `POST_EXTRACTION_ADDITIONS`
   list** and assert `keys === [...AT_EXTRACTION, ...ADDITIONS]`, preserving the
   original list's provenance.
5. `WorkBreakdown.tsx` — accept `cardsModeObs` (`'status' | 'breakdown'`) alongside the
   existing `secondaryReportTypeObs`; both feed the same `mode`. The legacy prop stays
   until Phase 4 so `secondaryPropsFor` keeps working. `filterRowsObs` is **not** wired
   for the primary path (D4) — the vm already filtered.
6. Controls: a `CardsViewSettings` (mode select + `StatusesShownAsPlanning`), wired
   into `ViewSettings.tsx`'s map and its 4-way `primaryReportType !==` guard.
   `Filters.tsx` shows the _child_ filter section when `primaryReportType === 'cards'`.
   `ReportControls.tsx` needs no new branch — the default branch (issue type, compare
   slider, filters, view settings) is right for cards.
7. `PrintReportButton.tsx:16` — add `'cards'` to `PRINTABLE_REPORT_TYPES`. Cards now
   live in `#react-report-container`, so `--print-scale` applies to them for the first
   time; verify a wide board against `src/css/print.css`.
8. `src/jira/features/fetcher.ts` — alias `secondaryReport → cardsReport` (D6).

**Watch for** (behaviour that changes once cards is the primary, not the passenger):

- `ReportArea.tsx:57-62` shows `EmptyResultMessage` when `primaryIssuesCount === 0`.
  A board whose issues are _all_ in planning statuses has zero primaries but a
  non-empty Planning card, so it would render "empty". Decide whether cards should
  count `planningIssues` toward the gate.
- `timeline-report-view-model.js:168` — with `primaryReportType === 'cards'`,
  `hideUnknownInitiatives` falls back to the `startBeforeDue` rule. Cards show no
  timeline, so hiding date-less issues is arguably wrong here.
- `ReportFooter.tsx` has no entry for `cards`; confirm the status key isn't wanted.

**Exit:** "Cards" appears in the report dropdown behind `cardsReport`; selecting it
renders the board standalone with a working mode select and child filters; every
legacy `secondaryReportType` URL renders exactly as before; `tsc` + `vitest` +
playwright green.

### Phase 1.5 — Saved-report migrations (D8)

**Executed from its own plan: [`saved-report-migrations/plan.md`](saved-report-migrations/plan.md).**
Separately buildable and reviewable; only its final phase depends on this one.

**Status (2026-08-02): that plan's Phases A and B are implemented** on
`feat/017-remove-legacy-reports` — the migration table, all three layers and the
unsupported-report-type guard are in place. Only its Phase C (the two additive Cards
entries) is outstanding, and it waits on Phase 1 above.

That plan's Phases A (mechanism) and B (the pre-existing `primaryReportType=breakdown`
bug + the shell's missing unsupported-type message) have **no dependency on Cards** and
can land before, during, or independently of Phase 1 here. Its Phase C — the
`secondaryReportType` → `cardsMode` and `secondaryChildFilterRows` →
`cardsChildFilterRows` entries, both **additive** — needs the keys Phase 1 introduces, and
should land before the Phase 3 warning tells anyone to migrate config we are about to
normalize for them. The legacy keys are deleted from stored data in **Phase 4**, with the
code that reads them; there is no `secondaryFilterRows` → `filterRows` entry (see the
table above).

Note the interaction with **D2**: once Phase C ships, a legacy saved report opened and
switched to Cards _does_ pick up its old mode, because `cardsMode` is present in the
normalized `queryParams`. That closes D2's residual case without any runtime fallback.

**Exit (for this spec's purposes):** legacy saved reports resolve `cardsMode` /
`cardsChildFilterRows` / `filterRows` correctly. See the sub-plan for its own exits.

### Phase 2 — Cards inside a report-of-reports

Mostly forced by Phase 1 (`registry.test.ts` demands the embeddable entry), but verify
the composition end to end.

- Confirm `ChildReportConfig` resolves `cardsMode`, `cardsChildFilterRows`,
  `planningStatuses` and `filterRows` from the child's own `queryParams`, and that a
  child `TimelineReportViewModel` produces `planningIssues`.
- Add a `ChildReport.cardsChild.test.tsx` alongside the existing
  `ChildReport.tableChild.test.tsx`.
- Manually verify the motivating case: one document, a Gantt child and a Cards child
  over the same JQL.

**Exit:** the user's stated workflow works — a document containing a Gantt and a Cards
report, each independently configured.

### Phase 3 — Retire the authoring path

- Remove `<SecondaryReportType>` from `GanttViewSettings` and `ScatterPlotViewSettings`;
  keep `StatusesShownAsPlanning` there (it feeds the vm's planning filter for _all_
  reports, not just cards — and today it is unreachable whenever the flag is off).
- Remove the two secondary sections from `Filters.tsx`.
- Add the deprecation warning above the legacy slot in `TimelineReport.tsx`, gated by
  the existing `showSecondaryReport(…)` call **and** `cardsReport` (§ The deprecation
  warning). Unit-test both axes: shown for `('start-due', 'breakdown')` with the flag
  on; absent for `('cards', …)`, for `('start-due', 'none')`, and for the flag off.
- Retire the `secondaryReport` flag from `configuration/features.ts` (its last
  consumers are gone), keeping the D6 read-time alias so the opt-in carries to
  `cardsReport`. **No flag graduates in this phase** — `cardsReport` and
  `reportOfReports` both stay `onByDefault: false`.
- Delete `SecondaryReportType/`. Update `Features.test.tsx:14`.

**Exit:** no UI path creates a `secondaryReportType`; existing ones still render;
users who have Cards enabled see the warning above them; users who don't see no change
at all.

### Phase 4 — Delete the slot (separate release)

**Preconditions — do not start until all three hold:**

1. `cardsReport` has graduated to `onByDefault: true`. Until then, deleting the slot
   takes a board away from users who cannot pick its replacement from the dropdown.
   (They _can_ still reach it by URL — but "hand-edit your bookmark" is not a migration
   path.)
2. `reportOfReports` has graduated too — it is the only way to keep a timeline and a
   card board on one page, which is this spec's whole premise.
3. The Phase 3 warning has shipped at least one release earlier. It is visible to
   everyone the moment it lands, so this is a time requirement, not a reach one.

Graduating the two flags is out of scope here; each happens when the feature is ready.
**Phase 4 is blocked on them, not the reverse.** If they stall, Phases 1–3 remain
complete and shippable — Cards exists, the slot is unauthorable, everyone using it has
been told, and nothing is broken.

- `TimelineReport.tsx` — drop `showSecondaryReport`, the Phase 3 warning, the
  `WorkBreakdown` import, `secondaryProps`, and `#react-secondary-report-container`.
- Delete `showSecondaryReport.ts` + its test; `secondaryPropsFor` in `reportProps.ts`;
  the bare `export { WorkBreakdown }` in `registry.ts:39-40`; the legacy
  `secondaryReportTypeObs` prop on the component.
- `route-data.js` — remove `secondaryReportType`, `secondaryFilterRows`,
  `secondaryChildFilterRows`; remove them from `SHELL_ONLY_PARAM_KEYS`. The old params
  become inert — a legacy config keeps its timeline and loses the card board, which is
  the outcome § Migration policy signed up for.
- `scripts/atlassian-connect/index.ts:101` — drop `secondaryReportType` from the
  deep-link template, add `cardsMode`. **This regenerates the published
  `atlassian-connect.json`** — coordinate with a descriptor deploy. An admin's existing
  deep-link configuration stops contributing the old param entirely once the new
  descriptor is live, so there is nothing to keep working.
- `SampleDataNotice.tsx` — rewrite the two sample links as `primaryReportType=cards`.
- `playwright/unauthenticated/sample-reports-navigation.spec.ts` — retarget the URL
  and container assertions at `#react-report-container`.
- Comment-only cleanups in `src/examples/` + `public/examples/bitovi-training.js`.

**Exit:** `secondaryReportType` survives only as an entry in the Phase 1.5 migration
table (D2 leaves no runtime fallback to keep); the sample-report journeys pass against
the new URLs.

### Phase 5 — Mechanical rename (optional, isolated commit)

`src/react/reports/WorkBreakdown/` → `CardsReport/`; `WorkBreakdown` →
`CardsReport`; `WorkBreakdownCard` → `Card`(?); `SecondaryReportMode` → `CardsMode`;
storybook titles `Reports/WorkBreakdown/*` → `Reports/Cards/*`. ~40 files, no
behaviour change. Keep `primaryReportBreakdown` / `ShowWorkBreakdown` /
`workBreakdowns` **untouched** — different feature (§ TL;DR #3). Likewise never touch
`secondaryIssueType` or `toSelectedParts`'s `{primary, secondary}`
(`data-utils.js:38`).

---

## Full touch-point checklist

Source of truth for "did we get everything" — `grep -ril secondary src --include=*.ts --include=*.tsx --include=*.js`
plus the non-`src` surfaces below.

| Area                          | Files                                                                                                      | Phase                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Report type config / dropdown | `configuration/reports.ts`, `SelectReportType.test.tsx`                                                    | 1                                           |
| Registries                    | `reports/registry.ts`, `shellRegistry.ts`, `registry.test.ts`                                              | 1                                           |
| Routing                       | `route-data/route-data.js`, `route-data/types.ts`                                                          | 1, 4                                        |
| Saved-report migrations       | new `jira/reports/migrations/`, `jira/reports/fetcher.ts`, `shared/main-helper.js`, `TimelineReport.tsx`   | [sub-plan](saved-report-migrations/plan.md) |
| Child config                  | `ReportOfReports/model/ChildReportConfig.js` + `.test.js`                                                  | 1, 4                                        |
| Props                         | `reports/reportProps.ts` + `.test.ts`                                                                      | 1, 4                                        |
| Report component              | `reports/WorkBreakdown/**` (incl. `types.ts`, stories, tests)                                              | 1, 5                                        |
| Shell                         | `TimelineReport/TimelineReport.tsx`, `showSecondaryReport.ts` + test                                       | 3, 4                                        |
| Deprecation warning           | new component beside `TimelineReport.tsx` + test                                                           | 3 (added), 4 (deleted)                      |
| View settings                 | `GanttViewSettings`, `ScatterPlotViewSettings`, `ViewSettings.tsx`, `SecondaryReportType/`                 | 1, 3                                        |
| Filters                       | `ReportControls/components/Filters/Filters.tsx`, `useSecondaryFilterRows/`, `useSecondaryChildFilterRows/` | 1, 3, 4                                     |
| Print                         | `PrintReportButton.tsx`, `src/css/print.css`                                                               | 1                                           |
| Feature flags                 | `configuration/features.ts`, `jira/features/fetcher.ts`, `Features.test.tsx`                               | 1, 3                                        |
| Sample data                   | `SampleDataNotice.tsx`                                                                                     | 4                                           |
| Connect descriptor            | `scripts/atlassian-connect/index.ts`                                                                       | 4                                           |
| E2E                           | `playwright/unauthenticated/sample-reports-navigation.spec.ts`                                             | 4                                           |
| Docs/examples                 | `src/examples/bitovi-training.js`, `public/examples/bitovi-training.js`                                    | 4                                           |

**Explicitly out of scope — do not rename:** `secondaryIssueType` (`route-data.js:796`,
`useSelectedIssueType.ts:5`, `timeline-report-view-model.js:79`,
`ChildReportConfig.js:438`), `toSelectedParts` `{primary, secondary}`
(`data-utils.js:38`), `primaryReportBreakdown` / `ShowWorkBreakdown` /
`workBreakdowns`, `tailwind.config.js:57` ("secondary button color"),
`CONTRIBUTING.md:124` ("secondary pages").

## Open questions

1. **Remaining D-list sign-off** — D2 (`cardsMode`) and D7 (keep the legacy slot for a
   release). D1, D4 and the report name were ratified 2026-08-01.
1. **What graduates `cardsReport` and `reportOfReports`, and roughly when?** Not this
   spec's call — but Phase 4 is blocked on both, so the answer decides whether the slot
   is deleted next release or lives on indefinitely. Phases 1–3 ship either way.
1. Should the empty-result gate count planning-only boards as non-empty (Phase 1
   "watch for")?
1. Does Phase 3.5 (one-click split into a report-of-reports) have enough demand to
   build, or is the deprecation notice enough?
1. Sequencing note (no longer a question): spec/017 has landed on
   `feat/017-remove-legacy-reports` — Grouper and Estimation Table are deleted and
   `table2` → `table` is done. **Ratified 2026-08-01: the migrations sub-plan adds a
   `table2` → `table` entry**, retroactively un-breaking saved reports that today render
   as a Gantt instead of a Table (the report-type clamp at `route-data.js:587-595` means
   they are silently wrong, not blank). This deliberately reverses that rename's
   documented "no alias" decision (commit `6a7ca435`, _"acceptable per 012 Q2"_).
