# Implementation Plan — Work Breakdown & Status (React rewrite)

## Goal

Replace the legacy CanJS secondary report
([`src/canjs/reports/status-report.js`](../../src/canjs/reports/status-report.js)) with a
modern **React** report that renders the two existing secondary views —

- **Status** — one column per card: a rollup-status swatch to the left of each child name + a
  "Target Delivery" date in the header.
- **Work breakdown** — the **status matrix** from
  [`option-a-status-matrix.html`](./option-a-status-matrix.html): rows are child issues,
  columns are the four work types (`design` `d` / `dev` `D` / `qa` `Q` / `uat` `U`), and each
  cell is a rounded status swatch.

The rewrite follows the **modlet** pattern
([create-react-modlet skill](https://github.com/bitovi/ai-enablement-prompts/blob/main/plugins/react/skills/create-react-modlet/SKILL.md))
already used by the Scatter Timeline report
([`src/react/reports/ScatterTimeline/`](../../src/react/reports/ScatterTimeline/)): all layout
and status math lives in **pure, unit-tested helper functions** under `helpers/`, the component
is a thin renderer, and every visual piece has a **Storybook story**.

## Guiding principles (mirrors ScatterTimeline)

1. **Isolate logic into pure helpers.** Anything that transforms issue data into what-to-draw
   (rollup status per child, work-type presence, matrix cell state, date-slip direction,
   density tier, child ordering) is a pure function in `helpers/` with a colocated
   `*.test.ts`. The component reads observables and delegates to helpers.
2. **Local, minimal input type.** Like scatter's [`types.ts`](../../src/react/reports/ScatterTimeline/types.ts),
   model only the slice of the rolled-up issue the report actually reads
   (`rollupStatuses.rollup`, `rollupStatuses[workType]`, `reportingHierarchy.childKeys`,
   `summary`, `key`). This keeps helpers decoupled from the full pipeline and trivially testable
   with inline fixtures.
3. **CanJS observables in, `useCanObservable` to read.** Follow the exact prop pattern of
   [`ScatterTimeline.tsx`](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx).
4. **Modlet structure with mandatory tests + stories.** Each folder = one export, `index.ts`
   re-exports only, `*.test.tsx`/`*.test.ts` required, `*.stories.tsx` required for visual
   pieces.
5. **Reuse app theme colors, not hardcoded hex.** The mock inlines hex + CSS vars; the real
   component must use the app's `color-text-and-bg-{status}` classes (backed by
   [`src/css/primitives.css`](../../src/css/primitives.css)) so theme overrides keep working.

## What exists today (so we don't rebuild it)

- **Data is already computed.** The rollup pipeline produces everything we render.
  `rollupStatuses.rollup.{status,due,start,lastPeriod}` and
  `rollupStatuses.{design,dev,qa,uat}.{status,due,issueKeys,lastPeriod}` are ready on each
  issue (see [`src/jira/rolledup/work-status/work-status.ts`](../../src/jira/rolledup/work-status/work-status.ts)
  and [`src/jira/rolledup/work-type/work-type.ts`](../../src/jira/rolledup/work-type/work-type.ts)).
  **No pipeline changes are needed.**
- **The toggle UI already exists.**
  [`SecondaryReportType`](../../src/react/ReportControls/components/ViewSettings/shared/components/SecondaryReportType/SecondaryReportType.tsx)
  writes `routeData.secondaryReportType` = `none` | `status` | `breakdown`. We reuse it as-is.
- **Statuses & colors are defined.** From [`src/jira/theme/fetcher.ts`](../../src/jira/theme/fetcher.ts)
  - [`src/css/primitives.css`](../../src/css/primitives.css):
    `complete` #22a06b · `blocked` #e2483d · `warning` #ff8e09 · `new` #8f7ee7 · `behind` #f5cd47 ·
    `ahead` #2898bd · `ontrack` #388bff · `notstarted` #8590a2 · `unknown` #dab092. Each has a
    matching text color and a `color-text-and-bg-{status}` class.
- **The legacy component is the behavioral spec.** Match `breakdownIcons()`, the
  `{design:'d', qa:'Q', uat:'U', dev:'D'}` symbol map, `hasWorkTypes` (only show work types with
  `issueKeys.length`), `wasReleaseDate()` (previous date shown when the due date slipped),
  planning-issues fallback, and the density tiers (`light`/`medium`/`high`/`absurd`).

## Target modlet structure

```
src/react/reports/WorkBreakdown/
├── index.ts                       # re-export WorkBreakdown + props type
├── WorkBreakdown.tsx              # thin renderer: reads observables, maps board -> cards
├── WorkBreakdown.test.tsx         # render tests (status mode, breakdown mode, empty, planning)
├── WorkBreakdown.stories.tsx      # top-level stories (both modes, densities, edge cases)
├── types.ts                       # local IssueOrRelease slice + Board/Card/Cell view types
├── fixtures.ts                    # fixture builders (mirrors option-a board data)
├── helpers/
│   ├── index.ts                   # barrel
│   ├── buildBoard.ts / .test.ts        # issues -> Board (cards, header dates, matrix rows)
│   ├── childRollup.ts / .test.ts       # child's states -> single rollup status (priority order)
│   ├── workTypePresence.ts / .test.ts  # which work types have work (hasWorkTypes)
│   ├── cellState.ts / .test.ts         # per work type: colored | nodate | na
│   ├── dateSlip.ts / .test.ts          # current vs lastPeriod -> {slipped|improved|none} + label
│   ├── statusClass.ts / .test.ts       # status -> `color-text-and-bg-{status}` + label
│   ├── density.ts / .test.ts           # child/card counts -> density tier
│   └── ordering.ts / .test.ts          # optional: order children (attention-first)
└── components/
    ├── WorkBreakdownCard/        # shared card shell: wrapper + colored header bubble + tooltip;
    │                             #   picks a body by mode (does NOT know how a body is drawn)
    ├── StatusColumnBody/         # status-mode insides: Target Delivery header + swatch-left rows
    ├── StatusMatrixBody/         # breakdown-mode insides: WorkTypeHeader + rows x work-type grid
    ├── WorkTypeHeader/           # DDQU header cells w/ letters + rollup date + slip date
    ├── StatusSwatch/             # rounded status square (colored / nodate ∅ / na outline)
    ├── TargetDeliveryDate/       # date + slip (red) / ahead (teal) styling, shared by both bodies
    └── PlanningCard/             # "Planning" fallback card
```

The `mode` / `secondaryReportType` prop only selects **which body** a `WorkBreakdownCard`
renders. The card shell, `WorkTypeHeader`, `StatusSwatch`, and `TargetDeliveryDate` primitives
are shared by both bodies, and each body (`StatusColumnBody`, `StatusMatrixBody`) is its own
modlet with its own tests + stories — so the two modes stay isolated and independently testable.

Each `components/*` and `helpers/*` folder is its own modlet (`index.ts` + impl + test; stories
for visual ones).

## Pure helpers (the testable core)

| Helper                                        | Input                                                     | Output                                                                      | Notes                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `childRollup(states)`                         | array of `status \| 'nodate' \| null` (one per work type) | single status, or `'na'` (all null) / `'nodate'` (all present are dateless) | Priority: `blocked > behind > warning > ahead > ontrack > complete > notstarted`. Ported from the mock.                    |
| `workTypePresence(issues)`                    | primary issues                                            | `{ [workType]: hasWork }` + ordered `hasWorkList`                           | Mirrors legacy `hasWorkTypes`; a type shows only if some issue has `rollupStatuses[type].issueKeys.length`.                |
| `cellState(childStatusForType)`               | one work-type status for a child (or absent)              | `'na' \| 'nodate' \| status`                                                | Drives swatch: `na` = no work of type, `nodate` = work but no dates, else colored.                                         |
| `dateSlip(rollup)`                            | `{ due, lastPeriod, status }`                             | `{ kind: 'none'\|'slipped'\|'improved', label? }`                           | `improved` when status is `ahead` (teal); `slipped` when current due later than last period (red). Ports `wasReleaseDate`. |
| `statusClass(status)` / `statusLabel(status)` | status string                                             | `color-text-and-bg-{status}` class / human label                            | Single source for status → class/label; used everywhere.                                                                   |
| `density(cardCount, childCount)`              | counts                                                    | `'light'\|'medium'\|'high'\|'absurd'`                                       | Ports legacy `columnDensity` + `fontSize` thresholds.                                                                      |
| `buildBoard(primaryIssues, allIssues, mode)`  | observables' values                                       | `Board` view-model (array of `Card`s)                                       | Orchestrator that composes the helpers above into a render-ready structure; the component just maps it to JSX.             |

**Why this split:** `buildBoard` + the small helpers let us test every behavior (status
priority, no-work vs no-date cells, slip direction, density) with inline objects and zero DOM —
exactly how [`helpers/status.test.ts`](../../src/react/reports/ScatterTimeline/helpers/status.test.ts)
and friends test the scatter report.

## Wiring into the app

The legacy `<status-report>` is mounted directly in the CanJS template
([`src/timeline-report.js`](../../src/timeline-report.js) ~line 111). React primary reports use a
different path (`attachReactReport`/`renderReactReport`). Plan:

1. Add a small React mount for the secondary report next to the existing
   `#react-report-container` (a `#react-secondary-report-container` div with
   `on:inserted`/`on:removed`), rendering `<WorkBreakdown>` when
   `secondaryReportType` is `status` or `breakdown`.
2. Pass observables using the existing `value.from` / `value.bind` pattern already used for
   scatter:
   - `primaryIssuesOrReleasesObs: value.from(this, 'primaryIssuesOrReleases')`
   - `allIssuesOrReleasesObs: value.from(this, 'rolledupAndRolledBackIssuesAndReleases')`
   - `planningIssuesObs: value.from(this, 'planningIssues')`
   - `secondaryReportTypeObs: value.bind(this.routeData, 'secondaryReportType')` (drives
     status-vs-breakdown inside the component).
3. Remove the `<status-report>` stache block and the `import './canjs/reports/status-report.js'`
   **only after** the React version is verified at parity (keep both behind the same route flag
   during development so we can diff side by side).

## Incremental steps (each independently verifiable)

### Step 1 — Scaffold the modlet + types + fixtures

- Create `WorkBreakdown/` with `index.ts`, `types.ts` (local issue slice + `Board`/`Card`/`Cell`
  view types), `fixtures.ts` (builders reproducing the mock's three-card board, incl. `nodate`,
  `na`, and a slipped + an `ahead` case).
- **Done when:** `npm run typecheck` passes and fixtures import cleanly in a scratch test.

### Step 2 — Pure helpers + tests (no UI yet)

- Implement `childRollup`, `workTypePresence`, `cellState`, `dateSlip`, `statusClass`,
  `density`, then `buildBoard`. Colocate `*.test.ts` for each with inline cases:
  - `childRollup`: priority ordering; all-null → `na`; all-nodate → `nodate`.
  - `cellState`: absent → `na`, dateless → `nodate`, else colored.
  - `dateSlip`: `ahead` → `improved`; later-than-last-period → `slipped`; otherwise `none`.
  - `workTypePresence`: hides a type with zero `issueKeys`.
  - `density`: boundary counts (4/5, 10/11, 20/21).
  - `buildBoard`: a full fixture → expected card/matrix structure for both modes.
- **Done when:** `npm run test src/react/reports/WorkBreakdown/helpers` is green and
  `npm run typecheck` passes.

### Step 3 — Leaf primitives + mode bodies + stories

- Build the shared leaves first: `StatusSwatch` (colored / `nodate` ∅ / `na` outline),
  `TargetDeliveryDate` (date + slip/ahead styling), `WorkTypeHeader` (DDQU letters + rollup date
  - slip date).
- Then the two mode bodies: `StatusColumnBody` (status-mode: Target Delivery header + swatch-left
  rows) and `StatusMatrixBody` (breakdown-mode: `WorkTypeHeader` + rows×work-type grid), plus
  `PlanningCard`. Bodies compose the leaves; they don't re-implement swatch/date logic.
- Each gets a `*.stories.tsx` covering its states.
- Use the app status classes (`color-text-and-bg-{status}`) and Tailwind for layout (as we
  settled on in the mock), **not** inline hex.
- **Done when:** each component's stories render in Storybook (`npm run storybook`) and unit
  tests pass.

### Step 4 — Assemble `WorkBreakdownCard` + `WorkBreakdown.tsx` + top-level stories

- `WorkBreakdownCard` renders the shared shell (wrapper + colored header bubble + tooltip) and
  selects `StatusColumnBody` vs `StatusMatrixBody` by `mode`.
- `WorkBreakdown` reads observables via `useCanObservable`, calls `buildBoard`, maps the board to
  `WorkBreakdownCard`s, renders the `PlanningCard` fallback, and handles the empty ("Unable to
  find any issues") case.
- `WorkBreakdown.stories.tsx`: `StatusMode`, `WorkBreakdownMode`, `DenseBoard`, `WithPlanning`,
  `Empty`, `SlippedAndAheadDates` — using the static `obs()` stub from the scatter stories.
- `WorkBreakdown.test.tsx`: renders each mode from fixtures; asserts swatch classes, header
  dates, child names, planning fallback, empty state.
- **Done when:** stories render and tests pass.

### Step 5 — Mount in the app behind the existing toggle

- Add the `#react-secondary-report-container` mount + observable wiring in
  `timeline-report.js`; render `<WorkBreakdown>` for `status`/`breakdown`.
- **Done when:** selecting **Status** / **Work Breakdown** in the sidebar renders the React
  report against live data, matching the legacy output.

### Step 6 — Parity check, then remove legacy

- Side-by-side against `<status-report>` on real data (status counts, dates, slip parentheticals,
  planning card, densities). Fix diffs in helpers.
- Delete `status-report.js` + its import + the old stache block.
- **Done when:** `npm run typecheck`, `npm run test`, and `npm run build` all pass and the
  legacy component is gone.

## How we know each step works

- **Helpers:** Vitest unit tests with inline fixtures (the primary safety net).
- **Components:** Vitest render tests + Storybook stories for visual confirmation of every
  state (colored/nodate/na swatches, slip vs improved dates, both modes, densities).
- **Integration:** manual side-by-side vs the legacy report on live data before deletion.
- **Global gates:** `npm run typecheck`, `npm run test`, `npm run build` green at Steps 2, 4,
  and 6.

## Testing & stories checklist (per modlet)

- [ ] `index.ts` re-exports only.
- [ ] `*.test.ts(x)` exists and passes for every helper and component.
- [ ] `*.stories.tsx` exists for every visual component and the top-level report.
- [ ] Stories cover: both modes, all three cell states, slipped + ahead dates, dense board,
      planning fallback, empty state.
- [ ] `npm run typecheck` and `npm run test` pass.

## Out of scope

- No changes to the rollup/derive pipeline (data already exists).
- No new status types or theme changes.
- Options B (progress rollup) and C (grouped/legend) from
  [`improvements.md`](./improvements.md) are **not** part of this plan — this plan implements the
  Status view + Option A matrix only. (Attention-first child ordering from Option C is included
  as an _optional_ `ordering.ts` helper but off by default to preserve source order.)

## Questions

1. **Legacy removal timing** — Should we delete `status-report.js` in this effort (Step 6), or
   keep it as a fallback behind a feature flag for one release?
   _Proposed:_ Delete it in Step 6 once parity is verified. It's a self-contained secondary
   report with an existing React toggle, and keeping two implementations invites drift. If you
   want a safety net, we gate the React mount behind a `window.featureFlags` dev flag instead of
   keeping the CanJS component.

   We should get rid of the old implementation.

2. **Density model** — The mock exposes a **Big / Tight** toggle; the legacy app auto-scales via
   `columnDensity` (based on issue count). Which do we ship?
   _Proposed:_ Keep the legacy **auto** density (derive tier from card/child counts) for parity
   and zero new UI/route state. Expose `density` as a prop so a manual toggle can be added later
   without touching the layout code.

   Agreed.

3. **Child ordering** — Legacy renders children in source order. The matrix is easier to scan
   attention-first (Blocked → Behind → … → Complete).
   _Proposed:_ Preserve **source order** by default (parity), implement `ordering.ts` as an
   opt-in pure helper, and revisit once the report is live. Avoids a behavior change sneaking in
   with the rewrite.

   We should use source order for sure.

4. **"New" status** — The theme defines `new` (#8f7ee7, "issue didn't exist last period"), which
   the current mock/legend omits.
   _Proposed:_ Support `new` in `statusClass`/`statusLabel` and the legend from the start (it's a
   real pipeline status), even though the sample fixtures rarely hit it. Cheap and avoids a
   missing-color gap on real data.

   Agreed.

5. **Status-mode child swatch source** — In status mode the mock derives each child's single
   swatch via `childRollup` over its work-type cells. The legacy status mode instead colors the
   child by `rollupStatuses.rollup.status` directly.
   _Proposed:_ Use the legacy **`rollupStatuses.rollup.status`** for the status-mode child swatch
   (true parity + one authoritative rollup), and reserve `childRollup` for cases where per-
   work-type cells exist but no rollup is available. Please confirm you want rollup-status parity
   rather than the mock's computed rollup.

   **Option A** — In status mode, color each child's swatch by its authoritative
   `rollupStatuses.rollup.status` (matches the legacy app). `childRollup` is used only in
   work-breakdown mode / as a fallback when no rollup status is available.

6. **Component location / name** — `src/react/reports/WorkBreakdown/` with export `WorkBreakdown`
   (single component handling both `status` and `breakdown` via a prop), matching how the legacy
   `status-report` handled both.
   _Proposed:_ Yes — one `WorkBreakdown` modlet with a `mode`/`secondaryReportType` input, rather
   than two sibling reports, since they share the card, header, and swatch primitives.

   Shouldn't the insides of the cards be separate
