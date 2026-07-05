# Scatter Timeline Report — React Rewrite Implementation Plan

**Status**: Ready for implementation
**Report Key**: `'due'` (Scatter Plot)
**Feature Flag**: `scatterPlot` (on by default)
**Replaces**: [src/canjs/reports/scatter-timeline.js](src/canjs/reports/scatter-timeline.js)

This plan describes replacing the CanJS `<scatter-timeline>` report with a React
implementation. It follows the behavior, logic, and measurement specs in this folder:

- [behavior.md](spec/003-scatter-timeline-rewrite/behavior.md) — what the report does (visual layout, inputs, edge cases)
- [logic.md](spec/003-scatter-timeline-rewrite/logic.md) — pure functions, measurement hook, component tree, types
- [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md) — why we batch DOM measurement (Option A) and cache (Option C)

---

## 1. Goals & Non-Goals

### Goals

- Reproduce the existing scatter timeline behavior in React, wired to the same `'due'`
  report key and `scatterPlot` feature flag.
- Extract all layout math into **pure, exhaustively unit-tested functions** (date/calendar,
  positioning, rounding, collision/row-packing, status→color, density).
- Isolate the one impurity (DOM text measurement) behind a batched, cached hook.
- Follow the **React modlet pattern** (self-contained folders with `index.ts`, component,
  tests, stories) per the
  [create-react-modlet skill](https://github.com/bitovi/ai-enablement-prompts/blob/main/plugins/react/skills/create-react-modlet/SKILL.md).
- Add **Storybook** to the project and create stories that visualize boundary conditions so
  the report can be reviewed without a live Jira connection.

### Non-Goals

- No new interaction features beyond parity (hover tooltip is optional/stretch per behavior.md §Interactions).
- No changes to the Jira data pipeline (`normalized` → `derived` → `rolledup`).
- The `miroData()` debug/export code is **not** ported (unused — behavior.md §Interactions).
- No visual comparison / "compare to" overlay (not present in current report).

---

## 2. Conventions Confirmed in This Repo

These were verified against the codebase and constrain the plan:

| Concern               | Convention                                                                               | Source                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| React report location | `src/react/reports/<ReportName>/`                                                        | [src/react/reports/](src/react/reports)                                  |
| CanJS→React props     | Observables passed as `*Obs` props, read with `useCanObservable`                         | [FlowMetrics.tsx](src/react/reports/FlowMetrics/FlowMetrics.tsx#L14-L31) |
| Report registration   | Add to `urlParamValuesToReactComponents` map                                             | [timeline-report.js](src/timeline-report.js#L37-L44)                     |
| Mount wrapper         | `QueryClientProvider` + `JiraProvider` (generic; **Scatter does not use them** — see §4) | [timeline-report.js](src/timeline-report.js#L253-L272)                   |
| Styling               | Atlaskit + Tailwind + `classnames` (**no** `@/` alias, **no** shadcn)                    | package.json                                                             |
| Tests                 | Vitest + jsdom, colocated `*.test.ts(x)`, `globals: true`                                | [vite.config.ts](vite.config.ts#L19-L24)                                 |
| Status colors         | `color-text-and-bg-{status}` CSS classes                                                 | [src/css/colors.css](src/css/colors.css)                                 |

> **Modlet skill adaptation**: The skill references `@/lib/utils` `cn()` and shadcn. This
> repo has neither. Use the existing `classnames` package (import as `cn` locally if
> desired) and Atlaskit/Tailwind. Story `title` uses `Reports/ScatterTimeline/...`.

---

## 3. Target Modlet Structure

New modlet under `src/react/reports/ScatterTimeline/`. Pure logic lives in `helpers/` and
`hooks/` sub-modlets; presentational pieces live in `components/`.

```
src/react/reports/ScatterTimeline/
├── index.ts                          # re-export ScatterTimeline
├── ScatterTimeline.tsx               # container: observables → pure fns → render
├── ScatterTimeline.test.tsx          # component test (mocks measurement hook)
├── ScatterTimeline.stories.tsx       # boundary-condition stories (see §7)
├── types.ts                          # PlottedIssue, Row (scatter-specific types)
├── fixtures.ts                       # shared mock issues/releases for tests + stories
├── helpers/                          # scatter-specific layout math (see §5.2)
│   ├── computeDateRange/             # {index,impl,test}.ts (empty/all-missing fallback)
│   ├── computeGridColumnCSS/         # {index,impl,test}.ts
│   ├── calculateTodayMargin/
│   ├── calculatePositionPercentages/ # emits overflowsLeft flag
│   ├── intersect/
│   ├── packIssuesIntoRows/
│   ├── sortIssuesByLeftPosition/
│   ├── getStatusColorClass/
│   ├── shouldUseDensityOptimizations/
│   └── filterIssuesWithDates/
├── hooks/
│   └── useMeasuredTextWidths/        # {index,impl,test}.ts + measureTextWidths
└── components/
    ├── QuarterAndMonthHeaders/       # {index,tsx,test,stories}
    ├── TodayLine/
    ├── GridLines/
    └── IssueMarker/
```

General date/calendar math does **not** live in the modlet — it goes in
[src/utils/date/](src/utils/date) alongside the existing utilities, with colocated tests
(see §5.1). Only scatter-specific layout logic lives in the modlet's `helpers/` (§5.2).

Each leaf folder is a modlet: `index.ts` re-exports only; implementation + test colocated;
visual components also get `.stories.tsx`.

### 3.1 Where each pure function lives and is tested

| Function                        | Location          | Tested in                  | Rationale                                                                         |
| ------------------------------- | ----------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `computeQuartersAndMonths`      | `src/utils/date/` | `src/utils/date/*.test.ts` | General calendar math; extends existing `getQuartersAndMonths`                    |
| `roundAndShiftDueDate`          | `src/utils/date/` | `src/utils/date/*.test.ts` | Composes existing `round.js` + `oneDayLater`; reusable date math                  |
| `computeDateRange`              | modlet `helpers/` | colocated `*.test.ts`      | Report-input range + empty/all-missing fallback (composes `mergeStartAndDueData`) |
| `computeGridColumnCSS`          | modlet `helpers/` | colocated `*.test.ts`      | Emits scatter grid CSS (`"31fr …"`) — presentation-specific                       |
| `calculateTodayMargin`          | modlet `helpers/` | colocated `*.test.ts`      | Encodes the 2-day visual offset — layout-specific                                 |
| `calculatePositionPercentages`  | modlet `helpers/` | colocated `*.test.ts`      | Timeline positioning                                                              |
| `intersect`                     | modlet `helpers/` | colocated `*.test.ts`      | Row-packing primitive                                                             |
| `packIssuesIntoRows`            | modlet `helpers/` | colocated `*.test.ts`      | Row-packing algorithm                                                             |
| `sortIssuesByLeftPosition`      | modlet `helpers/` | colocated `*.test.ts`      | Packing prep                                                                      |
| `getStatusColorClass`           | modlet `helpers/` | colocated `*.test.ts`      | Status→CSS mapping                                                                |
| `shouldUseDensityOptimizations` | modlet `helpers/` | colocated `*.test.ts`      | Layout density decision                                                           |
| `filterIssuesWithDates`         | modlet `helpers/` | colocated `*.test.ts`      | Report-input filtering                                                            |

> **Existing untested `.js` utilities**: [src/utils/date/](src/utils/date) currently has
> **no tests**. Do **not** modify existing `.js` functions in place (other reports — e.g.
> Gantt — depend on `getQuartersAndMonths`, `getDaysInMonth`, `round.js`). Instead add new
> typed functions **next to** them and add parity tests. Adding the two date helpers above
> establishes the first test coverage for that folder.
>
> Other reusable utilities to compose rather than re-derive:
> `getDaysInMonth`, `oneDayLater` ([src/utils/date/](src/utils/date)), the low-level
> `roundDate` table ([src/utils/date/round.js](src/utils/date/round.js#L141)), and
> `mergeStartAndDueData` ([src/jira/rollup/dates/dates.ts](src/jira/rollup/dates/dates.ts)).
> Prefer wrapping/reusing them over re-deriving; the pure wrappers exist to give a
> stable, typed, testable seam. **Do not** use `roundDateByRoundToParam`
> ([src/canjs/routing/utils/round.ts](src/canjs/routing/utils/round.ts)) in the pure layer —
> it reads the global `routeData.roundTo` and is not keyed by a `roundTo` string (see
> §Questions #1).

---

## 4. Storybook Setup (New Capability)

Storybook is **not currently installed**. Add it so reviewers can see the report and
boundary conditions without a live Jira connection.

### Tasks

1. Initialize Storybook for React + Vite:
   ```sh
   npx storybook@latest init --builder vite --type react
   ```
   This adds `@storybook/react-vite` and related devDependencies and creates `.storybook/`.
2. Configure `.storybook/main.ts`:
   - `stories: ['../src/**/*.stories.@(ts|tsx)']`
   - Ensure the Vite config resolves the same way as the app (React plugin).
3. Configure `.storybook/preview.ts` to load global CSS so status colors and Tailwind
   utilities render:
   - Import the compiled Tailwind output (`dist/production.css`) or the source
     [src/css/status-reports.css](src/css/status-reports.css) and
     [src/css/colors.css](src/css/colors.css) so `color-text-and-bg-*` classes apply.
4. Add npm scripts:
   ```json
   "storybook": "storybook dev -p 6006",
   "build-storybook": "storybook build"
   ```
5. **No provider decorators are needed.** The Scatter Timeline is a pure data-in report:
   it reads pre-computed observables (`primaryIssuesOrReleases`, `routeData`) via
   `useCanObservable` and runs pure layout math — it performs **no** Jira fetches or
   mutations, so it needs neither `QueryClientProvider` nor `JiraProvider`. (The generic
   mount in [timeline-report.js](src/timeline-report.js#L253-L272) wraps all reports in
   those providers only for reports that do fetch/mutate — e.g. GroupingReport's
   `useJiraIssueFields`, AutoScheduler's `useJira`/`useMutation`. Scatter is wrapped
   incidentally but never uses them.) Stories pass data directly as props.
6. Add a decorator/wrapper that provides a fixed-width container (e.g. 1230px) so
   width-dependent layout is deterministic in stories, and stub `useMeasuredTextWidths`
   with known widths for reproducible snapshots.

### Verification

- `npm run storybook` starts on 6006 and renders the stories in §7.
- `npm run build-storybook` succeeds (usable as a CI artifact for visual review).

---

## 5. Pure Functions to Implement (with tests)

Full signatures, logic, and test cases are in [logic.md §2](spec/003-scatter-timeline-rewrite/logic.md).
Functions are split by where they live (see §3.1).

### 5.1 General date helpers — in `src/utils/date/`, tested there

Add as new typed functions next to the existing utilities; do not modify existing `.js` in
place. These get colocated `*.test.ts` files in `src/utils/date/` (first tests for that folder).

| Function                               | Replaces                                  | Composes / extends                                           | Key tests                                      |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| `computeQuartersAndMonths(start, end)` | quartersAndMonths getter                  | `getQuartersAndMonths`, `getDaysInMonth` (via `getFullYear`) | single month, multi-quarter, leap/non-leap Feb |
| `roundAndShiftDueDate(due, roundTo)`   | oneDayLater + roundDateByRoundToParam.end | `roundDate` table (`round.js`), `oneDayLater`                | day (+1d identity), week, unknown-key fallback |

### 5.2 Scatter-specific helpers — in modlet `helpers/`, colocated tests

| Function                                   | Replaces                               | Key tests                                                                   |
| ------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| `computeDateRange(issues)`                 | range math in quartersAndMonths getter | with issues (min−30d / max+30d), empty → now±30d (no Invalid Date)          |
| `computeGridColumnCSS(months)`             | gridColumnsCSS getter                  | `"31fr 28fr 31fr"`                                                          |
| `calculateTodayMargin(today, first, last)` | todayMarginLeft getter                 | midpoint ≈50%, today before/after range                                     |
| `calculatePositionPercentages(config)`     | position math                          | start, midpoint, end of timeline; `overflowsLeft` when leftPercentStart < 0 |
| `intersect(r1, r2)`                        | intersect()                            | overlap, touching boundary, contained                                       |
| `packIssuesIntoRows(issues)`               | addToRow()                             | single row, collision → 2 rows, nested → 3 rows                             |
| `sortIssuesByLeftPosition(issues)`         | sort by leftPercentStart               | sorted, non-mutating                                                        |
| `getStatusColorClass(status)`              | dynamic class build                    | known, unknown fallback, last-period variants                               |
| `shouldUseDensityOptimizations(count)`     | lotsOfIssues getter                    | ≤20 false, >20 true                                                         |
| `filterIssuesWithDates(issues)`            | due-date filter                        | drops null/missing due                                                      |

**Definition of done for §5**: every function has a colocated test covering the cases above;
`npm run test` green; `npm run typecheck` clean.

---

## 6. Measurement Hook

Implement `hooks/useMeasuredTextWidths/` per [logic.md §3](spec/003-scatter-timeline-rewrite/logic.md)
and [measurement-batching.md](spec/003-scatter-timeline-rewrite/measurement-batching.md):

- `measureTextWidths(config)` — isolated impurity. Uses **Option A**: build all elements
  and append to one off-screen container (writes), attach once, then read every
  `getBoundingClientRect().width + 3` (reads), then remove. Single reflow. **Do not
  estimate** widths; **do not** use Canvas `measureText`.
- `useMeasuredTextWidths(config)` — runs `measureTextWidths` in `useLayoutEffect`, caches
  by a stable key of `(isLotsOfIssues, texts.join('\u0000'))` (**Option C**), exposes
  `{ widthsByText, isMeasured }`.
- Until `isMeasured`, the container renders nothing/skeleton and `rows` is `[]` — mirrors
  the CanJS "visibleWidth not ready" behavior (behavior.md §Edge Cases #7).

**Testing note**: in jsdom `getBoundingClientRect().width` is `0`. Test the hook's caching
and gating logic; in component tests, `vi.mock` the hook to inject a known `widthsByText`
map so positioning/packing is deterministic.

---

## 7. Boundary-Condition Stories

Create stories that exercise the edge cases from behavior.md §Edge Cases. Use a shared
`fixtures.ts` and a fixed-width decorator; stub `useMeasuredTextWidths` with deterministic
widths.

Container / full-report stories (`ScatterTimeline.stories.tsx`):

1. **Empty** — `primaryIssuesOrReleases: []` → grid with headers + today line only (#1).
2. **Single issue** — one issue with a due date near the middle of the range.
3. **Issues without due dates** — mix; those without `due` are omitted (#2).
4. **Dense collisions** — many issues clustered on the same due date → multiple packed rows (#4).
5. **Lots of issues (>20)** — density optimizations on: `text-xs`, radius 6, `h-7` (#6).
6. **Out-of-range dates** — due before `firstDay` and after `lastDay` (off-screen behavior) (#3).
7. **Early-due long label** — due date at/near `firstDay` with a long summary → label flips
   to the **right** of the marker instead of clipping off the left edge (`overflowsLeft`; #3).
8. **Leap-year span** — range crossing Feb of a leap year (column widths 29fr).
9. **All statuses** — one issue per status to verify every `color-text-and-bg-*` class.
10. **Today outside range** — today before / after the timeline (line clamped off-grid).

Leaf-component stories:

- `QuarterAndMonthHeaders` — single quarter, multi-quarter, leap-year month widths.
- `IssueMarker` — each status color, long-vs-short label truncation, small vs large radius,
  and `labelSide: 'left'` (default) vs `'right'` (off-left-edge flip).
- `TodayLine` — inside range, before range, after range.
- `GridLines` — few vs many months.

---

## 8. Integration & Cutover

1. Add the modlet to the report map in [timeline-report.js](src/timeline-report.js#L37-L44):
   ```js
   import { ScatterTimeline } from './react/reports/ScatterTimeline';
   const urlParamValuesToReactComponents = {
     // …existing…
     due: ScatterTimeline,
   };
   ```
2. Remove the CanJS `{{# eq(this.routeData.primaryReportType, "due") }}` `<scatter-timeline>`
   branch from the view template ([timeline-report.js](src/timeline-report.js#L74-L78)) so the
   generic `react-report-container` path renders it instead.
3. Ensure the container prop names match the base props built in `renderReactReport`
   ([timeline-report.js](src/timeline-report.js#L241-L246)): the container consumes
   `primaryIssuesOrReleasesObs` (and `allIssuesOrReleasesObs` for parity, currently unused).
   Add the one additional observable prop the container needs (`roundTo`) via
   `value.bind(this.routeData, …)` in the base props, matching the existing pattern for
   other reports. (Density is `length > 20` only — no `primaryReportBreakdown` prop; see
   Questions §4.)
4. Keep the `scatterPlot` feature flag and `'due'` key unchanged in
   [reports.ts](src/configuration/reports.ts#L18-L24) — no user-facing rename.
5. Delete [src/canjs/reports/scatter-timeline.js](src/canjs/reports/scatter-timeline.js) and
   its `<scatter-timeline>` custom-element registration only **after** parity is verified.

**Cutover safety**: because the key and flag are unchanged, the report can be toggled via
`window.featureFlags.scatterPlot` during rollout. Keep the CanJS file until the React
version passes review, then remove in the same PR (or a fast follow) to avoid dead code.

---

## 9. Phased Task Breakdown

Track with the todo list during implementation.

> **Subagent usage**: Parallelize independent, well-specified work with subagents where it
> helps, and keep the main thread as the integrator.
>
> - **`Explore` subagent (read-only)** — before Phase 2, to confirm the exact behavior of
>   the legacy `scatter-timeline.js` getters and the existing `src/utils/date` utilities
>   (`getQuartersAndMonths`, `round.js`) so the new functions match. Also safe to run in
>   parallel to answer "where is X used" questions.
> - **Implementation subagents** — the Phase 2 pure helpers (§5.2) are independent and each
>   fully specified in [logic.md §2](spec/003-scatter-timeline-rewrite/logic.md); they can be
>   farmed out in parallel (one function + its test per task). Same for the Phase 4 leaf
>   components, which have no cross-dependencies.
> - **Do not** use subagents for cross-cutting integration steps (Phase 5 container wiring,
>   Phase 6 cutover) — these require whole-picture context and should stay on the main thread.
> - Give each subagent a precise task, the relevant spec section, the modlet location, and
>   the exact tests/DoD it must satisfy; have it return the files created and test results.

**Phase 1 — Scaffolding & Storybook**

- Add Storybook (§4), scripts, preview CSS, and the fixed-width container decorator (no provider decorators needed — see §4).
- Create the `ScatterTimeline/` modlet skeleton, `types.ts`, `fixtures.ts`.

**Phase 2 — Pure logic**

- Implement all helper modlets (§5) with exhaustive unit tests.

**Phase 3 — Measurement**

- Implement `measureTextWidths` + `useMeasuredTextWidths` (§6) with tests.

**Phase 4 — Presentational components**

- `QuarterAndMonthHeaders`, `TodayLine`, `GridLines`, `IssueMarker` with tests + stories.

**Phase 5 — Container**

- `ScatterTimeline.tsx` composing hooks + pure fns + components; component test with mocked
  measurement hook; all boundary stories (§7).

**Phase 6 — Integration & cutover**

- Wire into `urlParamValuesToReactComponents`, remove CanJS branch, add needed observable
  props, verify parity, delete legacy CanJS file (§8).

**Phase 7 — Verification**

- `npm run test`, `npm run typecheck`, `npm run storybook` review of boundary stories.
- Optional: an E2E smoke test that selects the Scatter Plot report and asserts the grid +
  today line render (Playwright, authenticated).

---

## 10. Testing Strategy (Test Pyramid)

Per [logic.md §1](spec/003-scatter-timeline-rewrite/logic.md):

- **Unit (≈80%)** — pure helpers; deterministic, no DOM/globals.
- **Component (≈15%)** — render with mocked `useMeasuredTextWidths` and `fixtures.ts`;
  assert row count, marker positions/classes, header labels, today-line presence.
- **E2E (≈5%)** — optional Playwright smoke covering report selection and render.
- **Storybook** — visual verification of boundary conditions (not a substitute for the above).

Follow the repo component-test wrapper pattern (Suspense + providers + fresh
`QueryClient` with `retry: false`) from the copilot instructions where providers are needed.

---

## 11. Risks & Mitigations

| Risk                                              | Mitigation                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| jsdom returns width `0`, breaking layout in tests | Mock `useMeasuredTextWidths`; test measurement gating separately                         |
| Storybook CSS not loading status colors           | Import `colors.css`/compiled Tailwind in `.storybook/preview.ts`                         |
| Container width `0` on first paint                | Gate on `isMeasured` + default width (1230px) fallback like CanJS                        |
| Date-boundary rounding drift vs legacy            | Reuse existing `src/utils/date` utilities; add parity tests                              |
| Prop wiring mismatch on mount                     | Match `*Obs` base-prop names in `renderReactReport`; verify with a story + manual toggle |
| Dead CanJS code left behind                       | Remove `scatter-timeline.js` in the cutover PR after parity sign-off                     |

---

## 12. Definition of Done

- All pure helpers, the measurement hook, presentational components, and the container are
  implemented as modlets with colocated tests.
- `npm run test` and `npm run typecheck` pass.
- Storybook builds and all boundary-condition stories (§7) render correctly.
- The `'due'` report renders via React through the feature flag; legacy
  `scatter-timeline.js` is removed.
- Visual parity with the previous report confirmed via Storybook and manual toggle.

---

## Questions

**Status: RESOLVED.** All decisions below have been accepted and folded into behavior.md and
logic.md (and this plan). They are retained here as a decision log — the rationale for each
choice, with pointers to where the decision now lives in the specs.

1. **`roundAndShiftDueDate` — which rounding util does the pure function compose?**
   `roundDateByRoundToParam` lives in [src/canjs/routing/utils/round.ts](src/canjs/routing/utils/round.ts),
   not `src/utils/date/round.js`, and it is an object of `{ start, end }` methods that read
   the **global** `routeData.roundTo` internally — it is **not** keyed by a `roundTo`
   string. So `roundDateByRoundToParam[roundToParam]?.end` (logic.md §2.2) is always
   `undefined`.

   **Suggested answer:** Yes — make the pure function take `roundTo` as an explicit
   parameter and compose the low-level `roundDate` table from
   [src/utils/date/round.js](src/utils/date/round.js#L141):

   ```ts
   export const roundAndShiftDueDate = (dueDate: Date, roundTo: string): Date => {
     const rounder = roundDate[roundTo]?.end ?? roundDate.day.end; // day.end = identity
     return oneDayLater(rounder(dueDate));
   };
   ```

   Reuse the existing `oneDayLater` from
   [src/utils/date/date-helpers.js](src/utils/date/date-helpers.js) for the +1-day shift
   (don't re-derive `+24h` in ms — that drifts across DST). Keeping `roundTo` as a param
   preserves purity; the container reads `routeData.roundTo` and passes it in. Update the
   file-location references in logic.md/behavior.md/plan.md (three spots) to point at
   `round.ts`.

2. **Which field gates "has a due date"?** behavior.md §Step 1 filters on
   `issue.rollupDates.due`, but logic.md `filterIssuesWithDates` filters on
   `issue.rollupStatuses.rollup.due`. The legacy code filters on `rollupDates.due` yet
   positions using `rollupStatuses.rollup.due`.

   **Suggested answer:** Filter **and** position on the same field:
   `issue.rollupStatuses.rollup.due`. That's the value the legacy code actually uses for
   positioning, so gating on it guarantees every plotted issue has a non-null positioning
   date (avoids an Invalid-Date marker). Update `filterIssuesWithDates` and behavior.md §Step
   1 to both reference `rollupStatuses.rollup.due`. (The two fields are normally in sync;
   using one field removes the ambiguity.)

3. **Empty / all-missing data range.** logic.md's container computes the range with
   `Math.min(...issues.map(...))` / `Math.max(...)`, which yields `Infinity` (→ Invalid
   Date) when there are no issues — contradicting Edge Case #1 (render a default now ±30d
   range).

   **Suggested answer:** Reuse the legacy approach. Extract the range computation into a
   pure helper (e.g. `computeDateRange(issues)`) that mirrors the current getter:
   `mergeStartAndDueData(...)` then `firstEndDate = (start || now) - 30d` and
   `end = due || now + 30d`. This keeps the empty and all-missing cases producing a valid
   now ±30d window. Drop the raw `Math.min/Math.max` from the logic.md container sketch and
   unit-test the empty case explicitly.

4. **`primaryReportBreakdown` is dead code in the legacy density check.** The legacy
   component's `lotsOfIssues` getter is `length > 20 && !this.breakdown`, but `this.breakdown`
   is never defined on `<scatter-timeline>` (no attribute is passed, and unlike
   [gantt-grid.js](src/canjs/reports/gantt-grid.js#L161-L162) there is no `get breakdown()`
   getter). So `!this.breakdown` is always `true` and density today is effectively just
   `length > 20`.

   **Decision (a): port current runtime behavior exactly.** Density optimizations turn on
   when `length > 20`, period. `shouldUseDensityOptimizations` takes only `issueCount` and
   drops the `breakdown` parameter entirely. Do **not** add a `primaryReportBreakdown` prop
   to the scatter container. This is the smallest, lowest-risk change and reproduces exactly
   what users see today. (If we later want the breakdown-aware behavior that gantt has, wire
   it as a separate, intentional follow-up.)

5. **Prop names / shape.** `renderReactReport` passes `primaryIssuesOrReleasesObs` and
   `allIssuesOrReleasesObs` (see [timeline-report.js](src/timeline-report.js#L202-L204)),
   but logic.md's `ScatterTimelineProps` uses `primaryIssuesOrReleases` and a single
   `routeData` observable.

   **Suggested answer:** Follow the established repo pattern — individual `*Obs`-suffixed
   props, each read with its own `useCanObservable`, matching
   [FlowMetrics.tsx](src/react/reports/FlowMetrics/FlowMetrics.tsx#L14-L31). Add
   `roundToObs: value.bind(this.routeData, 'roundTo')` to `baseProps` in `renderReactReport`
   (no `primaryReportBreakdownObs` — see §4). Do **not** introduce a single bundled
   `routeData` observable (no other report does this). Update the `ScatterTimelineProps`
   interface in logic.md to the `*Obs` shape.

6. **Leap-year parity vs. bug-for-bug.** The legacy grid widths use
   `getDaysInMonth(date.getYear(), …)` — `getYear()` is year−1900 and is wrong for century
   years (e.g. 2000). The rewrite should use `getFullYear()`.

   **Suggested answer:** Fix it — use `getFullYear()` (or reuse `month.daysInMonth` straight
   from `computeQuartersAndMonths`, which already has the correct value, so
   `computeGridColumnCSS` never recomputes days). Target parity tests at the **corrected**
   behavior and add a note that the century-year `getYear()` bug is intentionally fixed.

---

### Off-left-edge overflow (label clipped past the left boundary)

**Observation:** Issue summaries can render off the **left** edge of the chart. This is a
real layout bug in the current report, not just a rare edge case, so we should fix it during
the rewrite.

**Root cause:** Each element is anchored by its **right** edge at the due date
(`element.style.right = endPercentFromRight%`) and the label text grows **leftward** from
the status marker ([scatter-timeline.js](src/canjs/reports/scatter-timeline.js#L177-L181)).
For an issue whose due date is at/near `firstDay` (left side of the grid) with a long
summary, `leftPercentStart = rightPercentEnd - widthInPercent` goes **negative**, so the
label is clipped off the left edge. behavior.md Edge Case #3 documents this as "rendered
off-screen … no clipping logic," i.e. current behavior is knowingly broken here.

**Suggested fix (flip anchor when it would overflow left):** Keep the marker fixed at the
due date (correctness of the date position is non-negotiable), but when the label would
overflow the left boundary, render the label to the **right** of the marker instead of the
left. Concretely, in the pure positioning layer add an `overflowsLeft` flag and let the
component choose the anchor:

```ts
// pure: computed alongside the other percentages
const overflowsLeft = leftPercentStart < 0;
// component: anchor by right edge normally; anchor by left edge (at the marker) when overflowing
const anchor = overflowsLeft
  ? { left: `${rightPercentEnd}%` } // label flows rightward from the due-date marker
  : { right: `${endPercentFromRight}%` }; // current behavior
```

This keeps the status marker on the correct date in both cases and only changes which side
the text flows. It requires the `IssueMarker` component to support a `labelSide: 'left' |
'right'` (mirror the padding/marker placement). Because the positioning stays pure, this is
covered by unit tests (assert `overflowsLeft` true/false at boundaries) plus a Storybook
boundary story.

**Add to §7 boundary stories:** an "early-due long-label" story (due date at `firstDay`
with a long summary) asserting the label flips right and stays within the grid. This also
tightens Edge Case #3, which should be updated from "rendered off-screen" to "label flips to
the right of the marker to stay in view."

**Decision: RESOLVED — adopt the flip-anchor fix** (over the simpler clamp-and-truncate
fallback) for better UX (no lost text). Now reflected in logic.md §2.3 (`overflowsLeft`
flag) and the container, behavior.md Edge Case #3, the §7 "early-due long label" story, and
the `IssueMarker` `labelSide` prop.
