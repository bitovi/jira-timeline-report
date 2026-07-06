# Scatter Plot — Representing Issues Without Dates

**Status**: Draft / design exploration
**Report**: Scatter Plot (`'due'` report key) — [src/react/reports/ScatterTimeline/ScatterTimeline.tsx](src/react/reports/ScatterTimeline/ScatterTimeline.tsx)
**Related control**: "Hide {Initiatives/Releases} without dates" toggle (`hideUnknownInitiatives`)
**Companion mockup**: [no-dates-representation.html](spec/004-scatter-improvements/no-dates-representation.html)

---

## 1. Problem

The Scatter Plot positions every issue horizontally by its **rolled‑up due date**. Issues
that have no due date have no x‑position, so today they are silently dropped and never
appear — regardless of the "Hide … without dates" toggle.

We want to:

1. Understand why the toggle appears to "do nothing" on the Scatter Plot.
2. Decide **how** to visually represent issues without dates when the user has chosen to
   show them.
3. Wire the toggle so it actually controls that representation.

---

## 2. How it works today

### 2.1 The toggle

- Route‑data key `hideUnknownInitiatives` (default `false`) is defined in
  [src/canjs/routing/route-data/route-data.js](src/canjs/routing/route-data/route-data.js#L737).
- The UI control lives in
  [src/react/ReportControls/components/Filters/components/IssueTypeFilters/IssueTypeFilters.tsx](src/react/ReportControls/components/Filters/components/IssueTypeFilters/IssueTypeFilters.tsx#L52)
  labeled **"Hide {Releases | <IssueType>s} without dates"**.

### 2.2 Where the filtering happens

There are **two** independent filters, and that is the root of the confusion:

1. **Upstream (governed by the toggle)** — in
   [src/timeline-report.js](src/timeline-report.js#L448), the `primaryIssuesOrReleases`
   getter removes issues when `hideUnknownInitiatives` is on and the issue is not
   `startBeforeDue` (its rollup `start` is not before its rollup `due`):

   ```js
   if (hideUnknownInitiatives && !startBeforeDue(issueOrRelease)) {
     return false;
   }
   ```

2. **Inside the Scatter Plot (always on)** — the report unconditionally drops any issue
   without a due date via `filterIssuesWithDates` in
   [src/react/reports/ScatterTimeline/helpers/collision.ts](src/react/reports/ScatterTimeline/helpers/collision.ts#L50):

   ```ts
   export const filterIssuesWithDates = (issues) => issues.filter((issue) => issue.rollupStatuses?.rollup?.due != null);
   ```

   Used at [ScatterTimeline.tsx](src/react/reports/ScatterTimeline/ScatterTimeline.tsx#L66).

### 2.3 Why the toggle "does nothing" on the Scatter Plot

- **Toggle ON (hide):** upstream removes no‑date issues → they don't reach the report.
- **Toggle OFF (show):** upstream keeps them → they **do** reach the report, but
  `filterIssuesWithDates` then drops them anyway.

So no‑date issues are **never rendered** on the Scatter Plot, whether the toggle is on or
off. Turning the toggle off (the user asking to _see_ them) has no visible effect. The
representation is simply missing.

### 2.4 There is already a visual vocabulary for this

The report footer legend already documents an "Unknown dates" marker using the empty‑set
(`⊘`) icon — see
[src/react/ReportFooter/components/StatusKey/StatusKey.tsx](src/react/ReportFooter/components/StatusKey/StatusKey.tsx#L11)
and [public/images/empty-set.svg](public/images/empty-set.svg). This legend entry implies a
representation was intended but never implemented in the Scatter Plot. We should reuse this
`⊘` empty‑set glyph so the new representation matches the existing legend.

---

## 3. Design goals

- Issues without a due date are **acknowledged** in the report rather than silently dropped.
- The count is surfaced in a compact **footer key** styled to match the Scatter Plot (not a
  tray that distorts the timeline), reusing the existing `⊘` empty‑set glyph.
- Undated issues never occupy a misleading horizontal position on the calendar.
- Users can drill in: clicking the key opens a **modal list** of the undated issues, each
  linking out to Jira for more detail.
- Pure logic (counting/partitioning) stays in tested helpers (consistent with the 003 rewrite).

---

## 4. Chosen design — scatter‑specific footer key + count button + modal list

Rather than placing undated issues on/near the grid, we surface them through a **key rendered
beneath the Scatter Plot**, mirroring the pattern the Gantt report uses (a footer summary that
opens a detail modal — see
[PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L277)
for the modal pattern). This keeps the timeline itself clean and honest (no fake positions).

> **Note:** the Scatter Plot has **no footer/legend today**. The shared
> [ReportFooter.tsx](src/react/ReportFooter/ReportFooter.tsx) only maps `'start-due'` →
> `StatusKey` and `'auto-scheduler'` → `AutoSchedulerFooter`; the Scatter Plot's report type
> is `'due'`, which isn't in that map, so nothing renders. Per Q4, this new key is a
> **scatter‑specific key component** (its own modlet, analogous to `StatusKey`) that lives
> with the report — not the shared `StatusKey`.

This is illustrated in [no-dates-representation.html](spec/004-scatter-improvements/no-dates-representation.html).

### 4.1 The footer key

- A small, scatter‑specific key rendered beneath the Scatter Plot, reusing the `⊘` empty‑set
  glyph from the existing legend ([StatusKey.tsx](src/react/ReportFooter/components/StatusKey/StatusKey.tsx#L11)).
- It reads **"⊘ N without dates"** (Q5) and is a **button** (Atlaskit `Button`,
  `appearance="subtle"` / link style). Wording is the short form — e.g. "4 without dates".
- Only shown when `N > 0`. When there are zero undated issues, nothing renders.

### 4.2 The modal

- Clicking the button opens an Atlaskit `Modal` (`@atlaskit/modal-dialog`, already a
  dependency and used by the Gantt report and others).
- Title: **"Issues without dates"**.
- Body: a **simple list**, one row per issue: the issue's status color swatch/`⊘` glyph, its
  key, and its summary. Each row links to the issue in Jira via the issue's `url`
  (`<a href={issue.url} target="_blank">`), matching how other reports link out (e.g.
  [PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L289)).
- Footer: a close action.

---

## 5. Incremental implementation plan

Each step is independently verifiable via a Storybook story and/or unit test. No timing.

### Step 1 — Split dated vs. undated issues (pure helper)

- Add `partitionIssuesByDate(issues)` to
  [src/react/reports/ScatterTimeline/helpers/collision.ts](src/react/reports/ScatterTimeline/helpers/collision.ts)
  returning `{ dated, undated }` using the same `rollupStatuses.rollup.due != null` predicate
  that `filterIssuesWithDates` uses today (keep `filterIssuesWithDates` as a thin wrapper for
  back‑compat, or refactor its one call site to use the partition).
- **Verify:** unit test in `collision.test.ts` — mixed input yields correct partition; empty
  input yields `{ dated: [], undated: [] }`; existing `filterIssuesWithDates` tests still pass.

### Step 2 — Expose `url` (and status) on the scatter issue type

- The modal rows link to Jira, so the scatter `IssueOrRelease` type
  ([types.ts](src/react/reports/ScatterTimeline/types.ts)) needs the issue `url`. Add an
  optional `url?: string` to the type (the rolled‑up issues already carry a top‑level `url`;
  see [historical-adjusted-estimated-time.js](src/jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time.js#L135)).
  Update [fixtures.ts](src/react/reports/ScatterTimeline/fixtures.ts) `makeIssue` to accept an
  optional `url`.
- **Verify:** typecheck passes; fixtures can set a `url`.

### Step 3 — Build the modal component

- Add a `NoDatesModal` under
  [src/react/reports/ScatterTimeline/components/](src/react/reports/ScatterTimeline/components/),
  following the modlet pattern (folder + `index.ts` + story). Props: `issues: IssueOrRelease[]`,
  `isOpen`, `onClose`. Renders the Atlaskit `Modal` with the simple list described in §4.2,
  using `getStatusColorClass` from [helpers/status.ts](src/react/reports/ScatterTimeline/helpers/status.ts)
  for each row's swatch and the `⊘` glyph.
- **Verify:** a Storybook story renders the open modal with several undated issues across
  statuses; rows show key + summary and link to `url`.

### Step 4 — Build the scatter‑specific footer key (button)

- Add a `NoDatesKey` component (same folder) that shows **"⊘ N without dates"** as a subtle
  button and owns the open/close state for `NoDatesModal`. Returns `null` when `N === 0`.
  This is a report‑local key (Q4), not the shared `StatusKey`.
- **Verify:** a Storybook story shows the key with a count; clicking opens the modal; a
  zero‑count story renders nothing.

### Step 5 — Wire the key into the report

- In [ScatterTimeline.tsx](src/react/reports/ScatterTimeline/ScatterTimeline.tsx), use
  `partitionIssuesByDate`; plot `dated` exactly as today (unchanged) and render
  `<NoDatesKey issues={undated} />` beneath the grid.
- **Verify:** adjust the `IssuesWithoutDueDates` story (reuse `mixedMissingDueIssues` from
  [fixtures.ts](src/react/reports/ScatterTimeline/fixtures.ts)) — dated markers plot as before,
  and the footer now shows "1 without dates" that opens the modal.

### Step 6 — Toggle semantics (**decided: 6b — the Scatter Plot only needs a due date**)

The Scatter Plot defines "no dates" as **missing a due date** (its own Rule B), not the legacy
`startBeforeDue` rule (Rule A, which requires both a start and a due). An issue with a due date
but no start date is plottable here and must **not** be treated as "no dates."

Implication — the upstream getter fights this: `primaryIssuesOrReleases` in
[timeline-report.js](src/timeline-report.js#L448) already strips issues that aren't
`startBeforeDue` when the toggle is on, and that filtered list is what feeds
`primaryIssuesOrReleasesObs`. So a due‑only issue would be removed upstream before the scatter
ever sees it — the scatter can't honor its own definition using the already‑filtered data.

To implement 6b, the scatter must apply the toggle itself against a due‑only definition rather
than inheriting the upstream `startBeforeDue` filter. Two viable wirings:

- **6b‑i (make the upstream filter report‑type aware):** in the `primaryIssuesOrReleases`
  getter, when the primary report is the Scatter Plot (`'due'`), gate the `hideUnknownInitiatives`
  branch on "missing due date" instead of `!startBeforeDue`. The scatter then keeps consuming
  `primaryIssuesOrReleasesObs` unchanged, and the toggle hides only truly undated (no‑due) issues.
- **6b‑ii (filter inside the scatter):** feed the scatter the pre‑toggle issues plus the
  `hideUnknownInitiatives` value as a prop, and let the scatter drop no‑due issues when the
  toggle is on. Larger change to the data wiring; prefer 6b‑i unless there's a reason to keep
  all filtering inside the report.
- **Behavior in both:** toggle **on** → no‑due issues hidden, `N` = 0, key hides; toggle
  **off** → no‑due issues counted/listed by the key, while due‑only issues still plot normally.
- **Verify:** toggling the control adds/removes the footer key in a dev run; a due‑only issue
  (due set, start null) still plots as a dot regardless of the toggle.

---

## 6. Open considerations

- **Definition mismatch (resolved — see Step 6):** the legacy toggle removes issues that are
  not `startBeforeDue` (needs both start and due, start < due), while the Scatter Plot only
  needs `due` to place a point. **Decision: the Scatter Plot uses its own due‑only definition
  (6b).** A due‑only issue plots normally and is never counted as "no dates."
- **Rounding/positioning** is unchanged; undated issues bypass positioning entirely.
- **Singular/plural:** the key text uses the short form — "1 without dates" / "N without
  dates" (Q5).

---

## Questions

1. **Modal list contents:** for each undated issue, is **status swatch + key + summary**
   (each row linking to Jira) enough, or do you want more columns (e.g., issue type icon,
   assignee, status label)?

**status swatch + key + summary**
Those are enough.

2. **Toggle semantics (Step 6):** should the key simply reuse the existing upstream filtering
   (6a — simplest), or use its own "missing due date" definition via an explicit prop (6b)?

**6b — this report only needs a due date.** The Scatter Plot defines "no dates" as missing a
due date; a due‑only issue (no start) still plots and is not counted as "no dates." See
Step 6 for the two wiring options (6b‑i preferred: make the upstream filter report‑type aware).

3. **Ordering in the modal list:** any preferred sort (e.g., by status, then alphabetical by
   key/summary), or keep incoming order?

Keep incoming.

4. **Placement of the key:** directly under the Scatter Plot grid (component‑local), or in the
   shared report footer alongside the existing status legend
   ([ReportFooter.tsx](src/react/ReportFooter/ReportFooter.tsx))?

I think it will be a special version of the key for this report.

5. **Button styling:** subtle link‑style button showing the `⊘` glyph + count — matches your
   intent? Any preferred wording ("N issues without dates" vs. "N without dates")?

I think "N without dates" is enough.
