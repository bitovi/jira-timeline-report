# Cards report — promoting the "secondary" report to a first-class report type

Now that [report-of-reports](../016-report-of-reports/) exists, the "secondary report"
slot — a second report rendered _below_ the Gantt or Scatter primary — no longer
needs to be a slot. A user who wants cards **and** a timeline can compose both in a
document. So the secondary report should become an ordinary primary report type
named **Cards**, and the slot should go away.

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
   load-bearing. `secondaryIssueType` (`route-data.js:796`) is the _hierarchy_ pick for
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
- **Props**: `secondaryPropsFor(vm, routeData)` (`reportProps.ts:56-63`) — a
  _separate_ bag from `propsFor`, carrying `planningIssuesObs`,
  `secondaryReportTypeObs`, `filterRowsObs`, `childFilterRowsObs`.
- **Component**: `src/react/reports/WorkBreakdown/` (~40 files: `WorkBreakdown.tsx`,
  `types.ts`, `fixtures.ts`, 10 `components/`, 14 `helpers/` + their tests, stories).
  Exported from `registry.ts:44` _outside_ the `embeddableReportComponents` map.
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

- `route-data.js:911` `secondaryReportType` (default `'none'`).
- `route-data.js:942` `secondaryFilterRows` — card-level filter rows, applied inside
  `buildBoard`.
- `route-data.js:946` `secondaryChildFilterRows` — child-row filter rows.
- All three are listed in `ChildReportConfig.js:212-226` `SHELL_ONLY_PARAM_KEYS`
  ("children render no secondary report in v1"), and the drift tests at
  `ChildReportConfig.test.js:354-384` **fail the build** if a `route-data` param is in
  none of the buckets. `planningStatuses` is already a `CHILD_PARAM`
  (`ChildReportConfig.js:106`).

### Controls

- `SecondaryReportType.tsx` — the `None / Status / Work Breakdown` select, rendered
  from `GanttViewSettings.tsx:42-51` and `ScatterPlotViewSettings.tsx:35-42`, both
  gated on the `secondaryReport` feature flag, both bundling
  `StatusesShownAsPlanning` alongside it.
- `Filters.tsx:84-123` — two extra `FilterRowsBuilder` sections ("Secondary Report
  {type} Status Filtering" ×2) shown when the flag is on _and_ `secondaryReportType`
  is set and not `none`.
- `configuration/features.ts:10-16` — the `secondaryReport` flag, `onByDefault: false`.

### Data pipeline

- `timeline-report-view-model.js:135-146` `planningIssues` — derived from
  `planningStatuses`; the source of the "Planning" fallback card.
- `:171-179` `primaryIssuesOrReleases` **excludes** planning-status issues and applies
  `effectiveFilterRows`. So card-level filtering is _already_ applied once before
  `secondaryFilterRows` is applied again.
- `:168` `isScatterPlot = primaryReportType === 'due'` changes what
  `hideUnknownInitiatives` means (due-only vs start-before-due).

### Chrome that keys off `primaryReportType`

`configuration/reports.ts:11-89` (dropdown + flag) → `SelectReportType/utilities.ts`;
`registry.ts` / `shellRegistry.ts`; `ReportControls.tsx` (per-type branches, plus the
`!== 'table'` ViewSettings guard at `:319`); `ViewSettings.tsx:43-60` (map + 4-way
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

Recommended answers in **bold**; each is cheap to flip before Phase 1 and expensive
after.

| #   | Question                                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | URL key for the new report type           | **`cards`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D2  | Layout-mode param                         | **New `cardsMode` (`status` \| `breakdown`, default `status`). No fallback to `secondaryReportType`.** Reusing `secondaryReportType` would keep the confusing name and its `none` value forever. A fallback would be dead code: it could only fire for a config carrying `primaryReportType=cards` _and_ a legacy `secondaryReportType` _and_ no `cardsMode`, which nothing written before this spec can have — `cards` is a new value, so every legacy config says `start-due`/`due` and takes the legacy-slot path instead. The one link that could hit it is the Phase 3 deprecation link, which we generate and which writes `cardsMode` itself. Residual case: switching an already-open legacy saved report to Cards via the dropdown lands in `status` mode — the mode select is right there, and re-saving persists `cardsMode`. |
| D3  | Feature flag                              | **New flag `cardsReport`, `onByDefault: false`, and it stays that way.** Cards is a new experimental report replacing an old one; it graduates on its own merits, not on this spec's schedule. Alias it from `secondaryReport` at read time (D6). Graduation is not part of Phases 1–3 — it is the **precondition for Phase 4** (see there). Same for `reportOfReports`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D4  | Keep `secondaryFilterRows`?               | **No.** As a primary, the standard Filters control already filters the cards (`effectiveFilterRows` in the vm). Keep only the child-level rows, renamed `cardsChildFilterRows`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D5  | Rename `WorkBreakdown/` → `CardsReport/`? | **Yes, but last** (Phase 5), as an isolated mechanical commit. Doing it in Phase 1 makes the behavioural diff unreviewable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D6  | Old feature-flag opt-in                   | **Migrate it.** `Features.tsx:13-21 removePreviousFeatures` silently drops unknown flag keys, so a bare rename resets everyone who had "Secondary Report" on. Map `secondaryReport → cardsReport` in `getFeatures` (`src/jira/features/fetcher.ts:15`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D7  | Legacy slot                               | **Keep rendering it through Phase 3; delete in Phase 4** (separate release). See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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

**Who sees it: flag-holders only.** Both `cardsReport` and `reportOfReports` stay
`onByDefault: false` (D3) — they are experimental replacements, not graduated features.
But the slot itself renders for _everyone_ (§ Current state), so gating the warning on
`showSecondaryReport` alone would show migration instructions to people whose dropdown
contains neither Cards nor Report of Reports. So gate it on **both** the slot predicate
and `useFeatures().cardsReport`: the warning appears exactly to users who can act on
it. Everyone else keeps rendering the board, unwarned and unchanged, until the flags
graduate.

This means `TimelineReport.tsx` gains its first `useFeatures` dependency. That hook
needs `QueryClientProvider` / `StorageProvider` / `Suspense` ancestors (see the wrapper
comment in `Filters.tsx:40-45`), so the notice must bring its own providers exactly as
`Filters` and `ViewSettings` do — do not lift them into the shell for this.

The corollary is that **Phase 4 cannot ship until the flags graduate** — otherwise the
slot vanishes for a population that was never warned and has no replacement in their
dropdown. That is the real constraint, and it belongs on the deletion, not on the
warning.

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

- `TimelineReport.tsx` — drop `showSecondaryReport`, the `WorkBreakdown` import,
  `secondaryProps`, and `#react-secondary-report-container`.
- Delete `showSecondaryReport.ts` + its test; `secondaryPropsFor` in `reportProps.ts`;
  the bare `export { WorkBreakdown }` in `registry.ts:43-44`; the legacy
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

**Exit:** no `secondaryReportType` anywhere outside a back-compat fallback; the
sample-report journeys pass against the new URLs.

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

| Area                          | Files                                                                                                      | Phase                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| Report type config / dropdown | `configuration/reports.ts`, `SelectReportType.test.tsx`                                                    | 1                      |
| Registries                    | `reports/registry.ts`, `shellRegistry.ts`, `registry.test.ts`                                              | 1                      |
| Routing                       | `route-data/route-data.js`, `route-data/types.ts`                                                          | 1, 4                   |
| Child config                  | `ReportOfReports/model/ChildReportConfig.js` + `.test.js`                                                  | 1, 4                   |
| Props                         | `reports/reportProps.ts` + `.test.ts`                                                                      | 1, 4                   |
| Report component              | `reports/WorkBreakdown/**` (incl. `types.ts`, stories, tests)                                              | 1, 5                   |
| Shell                         | `TimelineReport/TimelineReport.tsx`, `showSecondaryReport.ts` + test                                       | 3, 4                   |
| Deprecation warning           | new component beside `TimelineReport.tsx` + test                                                           | 3 (added), 4 (deleted) |
| View settings                 | `GanttViewSettings`, `ScatterPlotViewSettings`, `ViewSettings.tsx`, `SecondaryReportType/`                 | 1, 3                   |
| Filters                       | `ReportControls/components/Filters/Filters.tsx`, `useSecondaryFilterRows/`, `useSecondaryChildFilterRows/` | 1, 3, 4                |
| Print                         | `PrintReportButton.tsx`, `src/css/print.css`                                                               | 1                      |
| Feature flags                 | `configuration/features.ts`, `jira/features/fetcher.ts`, `Features.test.tsx`                               | 1, 3                   |
| Sample data                   | `SampleDataNotice.tsx`                                                                                     | 4                      |
| Connect descriptor            | `scripts/atlassian-connect/index.ts`                                                                       | 4                      |
| E2E                           | `playwright/unauthenticated/sample-reports-navigation.spec.ts`                                             | 4                      |
| Docs/examples                 | `src/examples/bitovi-training.js`, `public/examples/bitovi-training.js`                                    | 4                      |

**Explicitly out of scope — do not rename:** `secondaryIssueType` (`route-data.js:796`,
`useSelectedIssueType.ts:5`, `timeline-report-view-model.js:79`,
`ChildReportConfig.js:438`), `toSelectedParts` `{primary, secondary}`
(`data-utils.js:38`), `primaryReportBreakdown` / `ShowWorkBreakdown` /
`workBreakdowns`, `tailwind.config.js:57` ("secondary button color"),
`CONTRIBUTING.md:124` ("secondary pages").

## Open questions

1. **D-list sign-off**, especially D2 (`cardsMode`), D4 (drop `secondaryFilterRows`),
   and D7 (keep the legacy slot for a release).
1. **Is Report of Reports ready to be on by default?** The deprecation warning depends
   on it (§ The deprecation warning, "Blocker"), and so does this spec's premise. If it
   is not ready, the whole staged plan needs rethinking — deprecating the slot before
   its replacement is generally available leaves users with no way to keep a timeline
   and a card board on one page.
1. Should the empty-result gate count planning-only boards as non-empty (Phase 1
   "watch for")?
1. Is "Cards" the right user-facing name, or "Status Cards" / "Work Breakdown Cards"?
   The dropdown already has a "Table", so a plain noun fits — but the two modes are
   _Status_ and _Work Breakdown_, and "Cards" names the shape rather than the content.
1. Does Phase 3.5 (one-click split into a report-of-reports) have enough demand to
   build, or is the deprecation notice enough?
1. Sequencing against [spec/017](../017-remove-legacy-reports/plan.md), which also
   edits `configuration/reports.ts`, `registry.ts` and `ReportControls.tsx`. The
   overlaps are small but real — land 017 first, or expect conflicts.
