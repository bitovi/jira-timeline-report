# Scatter Plot — Start / End Date Range Filter

**Status**: Draft / design exploration
**Report**: Scatter Plot (`'due'` report key) — [src/react/reports/ScatterTimeline/ScatterTimeline.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx)
**Companion mockup**: [date-range.html](./date-range.html)

---

## 1. Goal

Let users constrain the Scatter Plot to a **start / end date window** — e.g. "only show me
what is due between Jan 1 and Mar 31". Today the timeline auto-fits its x-axis to whatever
content exists and shows every issue that has a due date; there is no way to focus on a
specific window.

There are **two genuinely different things** a "date range" control could do, and we should
decide which we want (they are not mutually exclusive — see [Questions #1](#questions)):

- **Filter issues** — remove issues whose date falls outside `[from, to]` so only in-window
  issues are plotted (and counted).
- **Clamp the axis window** — keep every issue but pin the visible x-axis to `[from, to]`
  instead of auto-fitting, so the user "zooms" the calendar. Issues outside the window are
  simply off-screen (or clamped to the edges).

This plan is written primarily around **filtering issues**, with clamp-the-axis called out as
a variant, because "filter" is what the request asked for and it composes cleanly with the
existing filter menu.

> **Decided ([Questions #1](#questions)):** ship **filter** semantics first. Clamp/zoom-the-axis
> is deferred to a follow-up toggle if users want to keep off-window issues visible for context.

---

## 2. How it works today

### 2.1 The axis range is auto-computed

- [computeDateRange()](../../src/react/reports/ScatterTimeline/helpers/dateRange.ts) derives
  `[rangeStart, rangeEnd]` from the min/max rolled-up **due** dates of the issues, padded by
  30 days on each side. It falls back to `now ± 30d` when the list is empty or every issue is
  undated.
- The component then runs a two-pass layout that **trims leading/trailing empty quarters** to
  the content's real extent
  ([ScatterTimeline.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx#L120) →
  `computeOccupiedDateExtent`). So the axis is entirely content-driven; the user has no say.

### 2.2 Every issue with a due date is plotted

- [partitionIssuesByDate()](../../src/react/reports/ScatterTimeline/helpers/collision.ts)
  splits issues into `dated` (has a rolled-up `due`) and `undated`. Only `dated` issues are
  positioned; `undated` issues are handled by the separate "issues without dates" work (see
  [no-dates-representation.md](./no-dates-representation.md)).
- Each dated issue is positioned purely by its rolled-up `due` date
  ([plotting.ts](../../src/react/reports/ScatterTimeline/helpers/plotting.ts)). The issue's
  rolled-up `start` is **not** used for x-positioning today.

### 2.3 Existing filter + control patterns to mirror

- **Filters menu** — [Filters.tsx](../../src/react/ReportControls/components/Filters/Filters.tsx)
  is an Atlaskit `DropdownMenu` (trigger `"Filters"`) containing `StatusFilter` and
  `IssueTypeFilters`, each laid out with
  [FilterGrid](../../src/react/ReportControls/components/Filters/shared/components/FilterGrid/FilterGrid.tsx)
  (a `grid-cols-[200px_1fr]` two-column grid: label on the left, control on the right).
- **View Settings menu** — [ViewSettings.tsx](../../src/react/ReportControls/components/ViewSettings/ViewSettings.tsx)
  hosts scatter-specific display controls (sort by, round dates to…) via
  [ScatterPlotViewSettings.tsx](../../src/react/ReportControls/components/ViewSettings/components/ScatterPlotViewSettings/ScatterPlotViewSettings.tsx).
- **Route data** — filter/setting values are URL-synced route params defined in
  [route-data.js](../../src/canjs/routing/route-data/route-data.js#L202) via
  `saveJSONToUrlButAlsoLookAtReport_DataWrapper('key', default, Type, { parse, stringify })`.
  Dates already have precedent: `compareTo` stores either seconds or an ISO `YYYY-MM-DD`
  string ([route-data.js#L216](../../src/canjs/routing/route-data/route-data.js#L216)), and
  `timeInStatusDateRange` stores a day count. React reads route params via the
  `useCanObservable` / route-data bridge.

---

## 3. Placement — where the control lives

The request is to put it in the **Filters menu**; that is the recommended home. Alternatives
are mocked in [date-range.html](./date-range.html) so we can compare. Summary:

| Option                            | Where                                    | Pros                                                               | Cons                                                            |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| **A. Filters menu (recommended)** | New "Date range" row in `Filters.tsx`    | Matches the request; groups with other issue filters; discoverable | One more thing in an already-tall menu                          |
| B. View Settings menu             | New section in `ScatterPlotViewSettings` | Fits if we frame it as "axis window" (clamp), not a filter         | Scatter-only; users look in Filters for filtering               |
| C. Inline controls bar            | Next to the Compare slider               | Always visible, zero clicks                                        | Steals horizontal space; scatter-only widget in a shared bar    |
| D. Brush / drag-select on axis    | Directly on the quarter/month header     | Fast, spatial, "zoom to here"                                      | Most build effort; needs a visible "reset" affordance           |
| E. Quick presets                  | Buttons inside A/B (This quarter, etc.)  | One-click common windows                                           | Presets alone aren't enough; pair with explicit from/to pickers |

**Recommendation:** ship **A** (two Atlaskit `DatePicker`s — "From" / "To" — in the Filters
menu) plus **E** (a small row of preset buttons) inside the same section. Treat **D** as a
follow-up enhancement once the data plumbing exists.

> **Confirmed ([Questions #4](#questions)):** Option A (Filters menu) + Option E (presets) now;
> Option D (axis brush) deferred to Step 7.

---

## 4. Design (Option A — Filters menu)

### 4.1 UI

- Add a **"Date range"** section to
  [Filters.tsx](../../src/react/ReportControls/components/Filters/Filters.tsx), rendered as a
  `FilterGrid` row consistent with `StatusFilter` / `IssueTypeFilters`:
  - Left cell: label `"Due date range"`.
  - Right cell: two `@atlaskit/datetime-picker` `DatePicker`s ("From" / "To") side by side,
    plus a **Clear** button and an optional row of preset chips
    (e.g. _This quarter_, _Next quarter_, _Next 2 quarters_).
- Empty `from`/`to` mean "unbounded on that side", so the control degrades gracefully to the
  current behavior when both are empty.
- Show a small count hint ("Showing 42 of 118") so the effect is legible — reuse the count
  the no-dates key work already computes if available.
- **Key update ([Questions #3](#questions)):** when a bounded range is active, add a second
  key item — **"N outside date range"** — alongside the existing "N without dates" item, so
  users can tell filtered-out issues apart from genuinely undated ones. Hide this key item
  entirely when no range is set (see [follow-up Questions #7–8](#questions)).

### 4.2 State (route data)

- Add two URL-synced route params, mirroring the `compareTo` ISO-date pattern:
  - `scatterDateRangeStart` — ISO `YYYY-MM-DD` or empty.
  - `scatterDateRangeEnd` — ISO `YYYY-MM-DD` or empty.
- Defined in [route-data.js](../../src/canjs/routing/route-data/route-data.js) with
  `parse`/`stringify` that validate ISO dates and fall back to empty.
- Expose them to React as observables (same bridge `roundTo` / `groupBy` use) and thread them
  into `ScatterTimeline` as new optional props (`dateRangeStartObs`, `dateRangeEndObs`) so the
  report stays a pure function of its inputs and the Storybook stories can drive them.

### 4.3 Filtering logic (pure helper)

- Add a pure helper `filterIssuesByDateRange(issues, { from, to, mode })` in
  [helpers/dateRange.ts](../../src/react/reports/ScatterTimeline/helpers/dateRange.ts) (or a
  new `helpers/dateFilter.ts`) with unit tests, consistent with the 003 rewrite's
  "pure logic in tested helpers" convention.
- **Matching rule ([Questions #2](#questions)):** filter on the rolled-up **due** date only
  (`from <= due <= to`), since due is what positions the marker. An "overlaps window" variant
  (`start <= to && due >= from`) is not planned unless requested later.
- Apply the filter to the `dated` issues **before** row-packing in
  [ScatterTimeline.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx), so
  auto-trim/quarter computation naturally react to the reduced set.
- Undated issues are unaffected by a due-date range filter — the range filters _dated_ issues
  only, so the existing "N without dates" key count never changes because of it
  ([Questions #3](#questions)). Separately, _dated_ issues excluded by the range are surfaced
  via the new "N outside date range" key item described in [4.1](#41-ui).

### 4.4 Axis interaction

- With **filtering** semantics, we do nothing special to the axis — `computeDateRange` +
  auto-trim already fit to the surviving issues, so the calendar naturally zooms to the window.
- If we later add **clamp** semantics (Option B variant), we'd instead pass `from`/`to`
  straight into `computeQuartersAndMonths` and skip auto-trim while a range is set.

---

## 5. Incremental steps

Each step is independently verifiable. Prefer landing 1–4 (pure/plumbing) before UI so we can
prove behavior in Storybook before touching the shared controls bar.

### Step 1 — Pure filter helper + tests

- Add `filterIssuesByDateRange(issues, { from, to })` to the ScatterTimeline helpers.
- **Done when:** new unit tests pass — empty `from`/`to` returns the list unchanged; a bounded
  window includes boundary dates and excludes outside dates; undated issues are excluded from
  a bounded window but retained when the range is empty. `npm run test` green.

### Step 2 — Thread date-range props through the report (no UI yet)

- Add optional `dateRangeStartObs` / `dateRangeEndObs` props to `ScatterTimeline`; apply the
  helper to `dated` issues before layout. Defaults (undefined/empty) reproduce today's output.
- **Done when:** existing ScatterTimeline tests still pass unchanged; a new test rendering the
  report with a bounded range shows only in-window markers. `npm run typecheck` clean.

### Step 3 — Storybook stories for the range

- Add stories driving the new observables (e.g. _Date range — bounded_, _Date range — open
  ended_, _Date range — empty (default)_).
- **Done when:** stories render in Storybook and visibly plot only the in-window issues;
  screenshot review confirms the axis auto-fits to the surviving set. (Run `npm run build:css`
  first if styles look stale — see repo styling notes.)

### Step 4 — Route params + React↔CanJS wiring

- Add `scatterDateRangeStart` / `scatterDateRangeEnd` route params with ISO parse/stringify;
  expose observables and pass them into the report from
  [timeline-report.js](../../src/timeline-report.js).
- **Done when:** manually setting the params in the URL (`?scatterDateRangeStart=2026-01-01&scatterDateRangeEnd=2026-03-31`)
  filters the live report and survives reload; clearing them restores the full plot.

### Step 5 — Filters-menu UI (Option A)

- Add the "Due date range" `FilterGrid` row to `Filters.tsx` with two `DatePicker`s, a Clear
  button, and preset chips; wire them to the route params.
- **Done when:** picking From/To in the menu updates the report and the URL; Clear resets both;
  presets set the expected dates. Component test mounts the section in the provider stack
  (`FlagsProvider` / `StorageProvider` / `QueryClientProvider`) and asserts changes call the
  setters. `npm run test` green.

### Step 6 — Count hint + key item + empty-state polish

- Show "Showing X of Y" near the control; add the new "N outside date range" key item
  (alongside "N without dates") whenever a bounded range is active, and hide it when the range
  is cleared; show a friendly empty state when the window excludes everything.
- **Done when:** the hint reflects the filtered/total counts; the new key item appears only
  while a range is set and shows the correct excluded count; an over-narrow window shows the
  empty state rather than a blank chart. E2E smoke (Playwright) optional but preferred.

### Step 7 (stretch) — Axis brush / drag-select (Option D)

- Allow dragging across the quarter/month header to set From/To, writing the same route params;
  add a visible "reset range" affordance.
- **Done when:** a drag sets the range and re-plots; reset clears it. Gated behind the same
  route params so it composes with the menu control.

---

## 6. Risks / considerations

- **Interaction with auto-trim:** filtering feeds the existing trim logic, so the axis will
  "snap" tighter as the window narrows. Confirm that feels right vs. clamping to the literal
  From/To (Questions #1).
- **Timezone correctness:** reuse the `compareTo` ISO/local-date helpers
  (`isoToLocalDate`) so boundary comparisons don't drift a day across timezones.
- **Shared controls bar:** the Filters menu is shared across report types. Scope the new
  section to the scatter (`'due'`) report so it doesn't leak into Gantt/others (mirror how
  `ViewSettings` branches on `primaryReportType`). Confirmed scatter-only for now
  ([Questions #5](#questions)); the Gantt is a planned future consumer of the same route-param
  pattern, not scheduled yet.
- **Undated issues:** a due-date range filter and the "issues without dates" key must have a
  clearly defined relationship (Questions #3) — resolved by adding a distinct "N outside date
  range" key item rather than conflating the two counts.

---

## Questions

1. **Filter vs. clamp the axis** — Should the range **remove** out-of-window issues (filter),
   or keep them and just **pin the visible axis** to the window (clamp/zoom)?
   _Proposed:_ Ship **filter** first (matches the request and composes with the Filters menu);
   revisit clamp as a follow-up toggle ("Fit axis to range") if users want to keep context.

   **Answered:** Yes, do the proposed (filter first; clamp deferred).

2. **Matching rule** — Filter on the rolled-up **due** date only, or on the **start–due
   window overlap**?
   _Proposed:_ Default to **due date** (`from <= due <= to`) because due is what positions the
   marker; add an "overlaps window" option later only if requested.

   **Answered:** Yes, filter by due date only.

3. **Undated issues** — When a bounded range is active, should undated issues be hidden,
   still counted in the "issues without dates" key, or shown as a separate "outside range"
   bucket?
   _Proposed:_ Keep undated issues in the existing no-dates key regardless of the range (the
   range filters _dated_ issues only); note the key's count is unaffected by the range.

   **Answered:** Yes, keep the no-dates key unaffected by the range. Additionally requested: add
   a parallel key item — **"N outside date range"** — mirroring "N without dates", shown only
   while a range is active (see [4.1](#41-ui), [4.3](#43-filtering-logic-pure-helper), and
   Step 6). Follow-up questions about this new item are added below (#7–8).

4. **Placement** — Confirm the Filters menu (Option A) as the home, with preset chips (Option
   E), and defer the on-axis brush (Option D)?
   _Proposed:_ Yes — Filters menu + presets now, brush later.

   **Answered:** Yes, Option A.

5. **Scope** — Should the date range be **scatter-only**, or a general filter usable by the
   Gantt too (which already has a time axis)?
   _Proposed:_ Scatter-only for now (new params namespaced `scatter*`); generalize later if
   the Gantt wants the same window.

   **Answered:** Scatter-only for now; the Gantt is planned for later reuse of the same pattern.

6. **Presets** — Which quick presets are most useful? (This quarter / Next quarter / Next 2
   quarters / This half / Year to date / Custom.)
   _Proposed:_ _This quarter_, _Next quarter_, _Next 2 quarters_, and _Clear_ — keep it short.

   **Answered:** Those are good — ship as proposed.

### New questions (from #3 follow-up)

7. **"N outside date range" interactivity** — Should this key item behave like "N without
   dates" if that key becomes clickable (per
   [no-dates-representation.md](./no-dates-representation.md)) — e.g. open a modal listing the
   excluded issues — or should it start as a static, non-interactive count?
   _Proposed:_ Start static (count only) in this plan's scope; add the modal/list interaction
   as a follow-up once the no-dates key's own interactive behavior lands, so both keys stay
   consistent.

It should open a modal.

8. **Visibility rule** — Confirm the item is hidden entirely when no range is set (rather than
   always shown with a count of 0), and only appears once at least one of From/To is populated?
   _Proposed:_ Yes — hide when the range is fully empty; show once either From or To is set,
   even if the other side is open-ended.

I agree with the proposed.
