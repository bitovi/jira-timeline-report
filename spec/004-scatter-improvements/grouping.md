# Scatter Timeline — Grouping

**Status**: Decisions incorporated (no open questions)
**Report**: Scatter Plot (report key `'due'`) — [src/react/reports/ScatterTimeline/](../../src/react/reports/ScatterTimeline)
**Goal**: Let users split the scatter timeline into labeled bands grouped by **parent**, **team**, **project**, and a few other dimensions — mirroring the "group by" capability the Gantt chart already exposes.

---

## 1. Goal

Today the scatter timeline plots every primary issue/release on a single shared quarter/month
axis, packing labels into stacked rows purely to avoid overlap
([ScatterTimeline.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx)). There is
no way to see, at a glance, which issues belong to which parent/team/project.

We want an optional **Group by** control (like the Gantt's) that partitions the plotted issues
into horizontal **bands**. Each band:

- shares the same x-axis (quarters/months + today line + grid lines),
- has its own label (e.g. the parent summary, team name, project key),
- packs its own issues into rows independently,
- optionally has an alternating background so bands are visually distinct.

When "None" is selected, the report renders exactly as it does today.

---

## 2. What already exists (research findings)

### 2.1 Gantt chart grouping

The Gantt (`gantt-grid.js`) supports grouping via its `gridRowData` getter, driven by
`routeData.groupBy`:

- [gantt-grid.js#L348-L394](../../src/canjs/reports/gantt-grid.js#L348) — `gridRowData`
  branches on `this.routeData.groupBy`:
  - `'parent'` → `getSortedParents(primaryIssuesOrReleases, derivedIssues)`
    ([gantt-grid.js#L769](../../src/canjs/reports/gantt-grid.js#L769)) builds a parent → children
    map, emits a `{ type: 'parent', issue: parent }` header row followed by that parent's child
    rows.
  - `'team'` → `Object.groupBy(primaryIssuesOrReleases, (issue) => issue.team.name)`, emits a
    `{ type: 'parent', issue: team }` header row per team followed by its issues.
  - default (`''`) → flat list, no grouping.
- Grouping is disabled when `primaryIssueType === 'Release'`.
- Group header rows get a striped background via `groupElement()`
  ([gantt-grid.js#L395](../../src/canjs/reports/gantt-grid.js#L395)).

**Important correction to the request:** the Gantt currently supports **parent** and **team**
only — **not project**. The React `GroupBy` control only offers `None / Parent / Team`
([GroupBy.tsx](../../src/react/ReportControls/components/ViewSettings/shared/components/GroupBy/GroupBy.tsx#L8)),
and `gridRowData` has no `'project'` branch. So "project" grouping is **new work** for both
reports (see Questions #1).

The `groupBy` value is already a first-class URL/route param
([route-data.js#L768](../../src/canjs/routing/route-data/route-data.js#L768),
[types.ts#L19](../../src/canjs/routing/route-data/types.ts#L19)) with a listener that clears it
when the primary type switches to `Release`.

### 2.2 Grouper report (`GroupingReport`)

The Grouper report has a much richer, reusable grouping abstraction we can borrow from:
[src/react/reports/GroupingReport/ui/grouper.tsx](../../src/react/reports/GroupingReport/ui/grouper.tsx).

The `Grouper` interface is:

```ts
interface Grouper<Issue, GroupValueType, Key extends string> {
  name: string; // unique id
  label: string; // UI label
  groupByKey: { key: Key; value: (item: Issue) => GroupValueType | GroupValueType[] };
  sort?: (a, b) => number; // order the groups
  fillGaps?: (keys) => keys; // e.g. fill missing months
  titles: (values) => Array<string | ReactNode>; // render group headers
}
```

Groupers already implemented there:

| Grouper                   | Groups by                                             | Source                                                                            |
| ------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `parentGrouper`           | `issue.fields.Parent.key` (title = parent summary)    | [grouper.tsx#L42](../../src/react/reports/GroupingReport/ui/grouper.tsx#L42)      |
| `greatGrandParentGrouper` | grandparent's parent                                  | [grouper.tsx#L60](../../src/react/reports/GroupingReport/ui/grouper.tsx#L60)      |
| `projectKeyGrouper`       | `item.projectKey`                                     | [grouper.tsx#L141](../../src/react/reports/GroupingReport/ui/grouper.tsx#L141)    |
| `issueKeyGrouper`         | the issue itself                                      | [grouper.tsx#L172](../../src/react/reports/GroupingReport/ui/grouper.tsx#L172)    |
| `makeLinkGrouper(type)`   | issue link of a given type (e.g. "implements")        | [grouper.tsx#L71](../../src/react/reports/GroupingReport/ui/grouper.tsx#L71)      |
| date groupers             | due-in-month, due-in-quarter, intersect-month/quarter | [ui/date-groupers.ts](../../src/react/reports/GroupingReport/ui/date-groupers.ts) |

Notably there is **no team grouper** in the Grouper report yet — team grouping only exists in the
Gantt. So neither report has all three of parent/team/project today.

### 2.3 Current Scatter data shape

The scatter report intentionally reads a **minimal slice** of the issue
([types.ts](../../src/react/reports/ScatterTimeline/types.ts#L10-L32)):

```ts
interface IssueOrRelease {
  key;
  summary;
  names?;
  rollupDates;
  rollupStatuses;
  status?;
}
```

It does **not** currently carry `team`, `parentKey`, `projectKey`, or the parent's summary. The
underlying `primaryIssuesOrReleases` objects (rolled-up derived issues) **do** have these
(`NormalizedIssue` has `team`, `parentKey`, `projectKey`
— [types.ts#L108-L129](../../src/jira/shared/types.ts#L108)). So enabling grouping requires
**extending the local `IssueOrRelease` type** to read those fields.

Scatter view settings currently show only sort / round-to / secondary report — no group-by
control ([ScatterPlotViewSettings.tsx](../../src/react/ReportControls/components/ViewSettings/components/ScatterPlotViewSettings/ScatterPlotViewSettings.tsx)).

---

## 3. Grouping dimensions (v1 — decided)

v1 ships exactly **three** dimensions plus "None":

1. **Parent** — group by parent key, label with parent summary. (Reuse `parentGrouper` logic.)
2. **Team** — group by `issue.team.name`. (Reuse Gantt's approach; add a `teamGrouper`.)
3. **Project** — group by `issue.projectKey`. (Reuse `projectKeyGrouper` logic.)

**Project grouping is added to _both_ the Gantt and the Scatter** (Question 1 → **A**). Adding it to
the Gantt is straightforward: the Gantt's `gridRowData` already has a `'team'` branch that
`Object.groupBy`s by `issue.team.name`
([gantt-grid.js#L370-L392](../../src/canjs/reports/gantt-grid.js#L370)); a `'project'` branch is the
same shape, grouping by `issue.projectKey`. The React `GroupBy` control gains a matching **Project**
option.

**Deferred (not in v1)** — these remain out of scope for now and can be added later:

- **Release / Fix Version** — group by `issue.releases`. Deferred because it's **multi-value**
  (`NormalizedIssue.releases` is an array — [types.ts#L128](../../src/jira/shared/types.ts#L128)),
  so an issue can belong to multiple release bands. We'll design that (and the shared Gantt impact)
  when we pick it up.
- **Status** — group by rolled-up `rollupStatuses.rollup.status`.
- **Label** — group by Jira label (also multi-value, like Release).
- **Date groupers** (due-in-month / due-in-quarter) — already encoded by the scatter x-axis.

> **On ancestor grouping — parent only.** The Grouper report exposes `parentGrouper` (one level up)
> and `greatGrandParentGrouper` (three levels up) but **no grandparent**. That gap is an artifact of
> the specific hierarchy that report was built for, not a general design. For the scatter plot the
> useful concept is simply **"group by the parent of whatever you're reporting on"**, so v1 ships
> **Parent** as the only ancestor tier (Question 2). If deeper ancestor grouping is ever needed, add
> it as a generic "N levels up" ancestor selector rather than named
> parent/grandparent/great-grandparent tiers.

---

## 4. Design decisions (decided)

- **Reuse the `Grouper` abstraction** from `GroupingReport` rather than inventing a new one. Lift the
  shared groupers (parent, project) into a **shared location both reports import** (Question 3), and
  **add a new `teamGrouper`** there.
- **Layout — left gutter (Question 4 → B):** render each group as a band whose rows are packed with
  the existing `packIssuesIntoRows`, with a **fixed left gutter column** showing the group label
  beside each band (not a full-width header row above it). Alternating band backgrounds are
  acceptable but secondary; the gutter label is the primary affordance.
- **State — shared `groupBy` param (Question 5 → keep together):** reuse the existing `groupBy` route
  param so the Gantt and Scatter stay in sync — switching between reports preserves the grouping and
  the selection survives in the URL. Scatter needs `groupByObs` added to `baseProps`
  ([timeline-report.js#L198](../../src/timeline-report.js#L198)) and a `Group by` control added to
  `ScatterPlotViewSettings`.
- **Band ordering (Question 6):** when grouping by **Parent**, order bands by **rank** when a rank is
  available, otherwise **alphabetically**. (This matches the Gantt's `getSortedParents`, which sorts
  by `rank` only when `parents[0].rank` exists — [gantt-grid.js#L806](../../src/canjs/reports/gantt-grid.js#L806).)
  Team and Project bands sort alphabetically. In every case the **"No Parent" / "No Team" /
  "No Project" bucket sorts last.**
- **Single-value only (Question 7):** all v1 dimensions (parent/team/project) are single-value, so
  each issue belongs to exactly one band. No duplication-across-bands handling is needed in v1
  (Release, the multi-value dimension, is deferred).
- **Releases**: match the Gantt and disable grouping when the primary type is `Release`
  (grouping a list of releases by their own parent/team doesn't apply cleanly).

---

## 5. Incremental implementation steps

Each step is independently verifiable — mostly via Storybook stories and colocated Vitest tests,
so no live Jira connection is needed.

### Step 1 — Extend the scatter data slice + a pure `groupIssues` helper

- Extend `IssueOrRelease` ([types.ts](../../src/react/reports/ScatterTimeline/types.ts)) to
  optionally include the fields grouping needs: `team?.name`, `parentKey`, `parentSummary`,
  `projectKey`, and the parent's `rank` (used for band ordering). Status/labels/release are **not**
  needed in v1.
- Add a new pure helper `helpers/groupIssues/` following the existing modlet pattern
  (`index.ts`, `impl.ts`, `test.ts`). It takes `(issues, groupBy)` and returns an **ordered array
  of groups**: `{ key, title, issues }[]`. `groupBy === ''` returns a single implicit group
  (or a sentinel meaning "no grouping").
- Encapsulate each dimension as a small config (id, label, `getGroupValue`, `getTitle`, `sort`) —
  ideally the `Grouper` shape from the Grouper report.

**How we know it works:** unit tests in `groupIssues/test.ts` cover: no-grouping passthrough;
parent grouping with a "No Parent" bucket; team grouping; project grouping; band ordering (parent
by `rank` when present, otherwise alphabetical; team/project alphabetical); and that the
"No Parent" / "No Team" / "No Project" bucket always sorts **last**.

### Step 2 — Render grouped bands (presentational only, fed by fixtures)

- Update `ScatterTimeline.tsx` to compute `groups = groupIssues(filteredIssues, groupBy)` and, for
  each group, run the existing measure → position → `packIssuesIntoRows` pipeline **per group**.
- Introduce a `GroupBand` component (`components/GroupBand/`) that renders one group's rows with a
  **fixed left gutter column** holding the group label beside the band (Question 4 → B), all
  sharing the same `gridColumnsCSS` x-axis. An alternating band background is optional/secondary.
  The shared headers (`QuarterAndMonthHeaders`, `TodayLine`, `GridLines`) stay at the top spanning
  all bands.
- When `groupBy === ''`, render exactly the current single-band output (no visual change).

**How we know it works:** add Storybook stories to
[ScatterTimeline.stories.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.stories.tsx):
`GroupedByParent`, `GroupedByTeam`, `GroupedByProject`, plus `NoGrouping` (unchanged). Extend
`fixtures.ts` with issues that carry `team`, `parentKey`/`parentSummary`/`rank`, and `projectKey`.
Visually confirm each band's gutter label is shown, packs independently, and aligns to the same
axis. Add a component test that renders with a parent-grouping fixture and asserts the band labels
appear and each band contains the expected issue keys.

### Step 3 — Wire the `Group by` control into the View settings dropdown + route state

- Add `groupByObs: value.bind(this.routeData, 'groupBy')` to `baseProps` in
  [timeline-report.js](../../src/timeline-report.js#L198) and a matching `groupByObs` prop on
  `ScatterTimelineProps`; read it with `useCanObservable`.
- Add a **Group by** `SettingsSection` inside the existing **View settings** dropdown for the
  scatter report — i.e. in `ScatterPlotViewSettings` (rendered by `ViewSettings`), alongside the
  existing "sort by" / "round dates to" sections, exactly mirroring how the Gantt exposes group-by
  in [GanttViewSettings.tsx](../../src/react/ReportControls/components/ViewSettings/components/GanttViewSettings/GanttViewSettings.tsx#L27).
  Reuse the shared `GroupBy` control, extended to include Project (+ any approved extras).
  Hide/disable it when the primary type is `Release`, matching the Gantt.

**How we know it works:** in the running app (`npm run dev`), opening the scatter report's
**View settings** dropdown shows a **Group by** section; changing it re-bands the chart; the
selection is reflected in the URL and shared with the Gantt; switching primary type to `Release`
disables grouping. `npm run typecheck` passes.

### Step 4 — Extend the shared `GroupBy` options + add Project to the Gantt

- Update the `GroupBy` options list
  ([GroupBy.tsx#L8](../../src/react/ReportControls/components/ViewSettings/shared/components/GroupBy/GroupBy.tsx#L8))
  to add **Project** (`None / Parent / Team / Project`).
- Add a `'project'` branch to the Gantt's `gridRowData`
  ([gantt-grid.js#L370](../../src/canjs/reports/gantt-grid.js#L370)), mirroring the existing
  `'team'` branch but grouping by `issue.projectKey`, so the shared `Project` option works in both
  reports (Question 1 → A).

**How we know it works:** parent/team/project each render correct bands in Storybook + the live
app; the Gantt still works for parent/team **and now project** (regression check). Unit tests
cover the new `teamGrouper` / `projectKeyGrouper` usage.

### Step 5 — Polish & edge cases

- Empty groups, a single group, very large groups (density optimizations still apply per band),
  and issues missing the grouping field (labeled "No Parent" / "No Team" / "No Project").
- Band ordering is decided (Question 6): parent by `rank` when available, otherwise alphabetical;
  team/project alphabetical; "None" buckets always last (matching the Grouper report, which sorts
  `no-parent` last — [grouper.tsx#L54](../../src/react/reports/GroupingReport/ui/grouper.tsx#L54)).

**How we know it works:** dedicated Storybook stories for each edge case plus unit tests for
ordering and "None" bucket placement.

---

## 6. Files likely to change / be added

| Area                                         | File                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data slice                                   | [ScatterTimeline/types.ts](../../src/react/reports/ScatterTimeline/types.ts)                                                                                                                                                                                      |
| Grouping logic (new modlet)                  | `ScatterTimeline/helpers/groupIssues/{index,impl,test}.ts`                                                                                                                                                                                                        |
| Band rendering (new component)               | `ScatterTimeline/components/GroupBand/`                                                                                                                                                                                                                           |
| Container                                    | [ScatterTimeline/ScatterTimeline.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.tsx)                                                                                                                                                                |
| Stories / fixtures                           | [ScatterTimeline.stories.tsx](../../src/react/reports/ScatterTimeline/ScatterTimeline.stories.tsx), [fixtures.ts](../../src/react/reports/ScatterTimeline/fixtures.ts)                                                                                            |
| Props wiring                                 | [timeline-report.js](../../src/timeline-report.js#L198)                                                                                                                                                                                                           |
| View settings control                        | [ScatterPlotViewSettings.tsx](../../src/react/ReportControls/components/ViewSettings/components/ScatterPlotViewSettings/ScatterPlotViewSettings.tsx), [GroupBy.tsx](../../src/react/ReportControls/components/ViewSettings/shared/components/GroupBy/GroupBy.tsx) |
| Gantt project grouping                       | [gantt-grid.js](../../src/canjs/reports/gantt-grid.js#L370)                                                                                                                                                                                                       |
| Shared groupers (lifted + new `teamGrouper`) | [GroupingReport/ui/grouper.tsx](../../src/react/reports/GroupingReport/ui/grouper.tsx)                                                                                                                                                                            |

---

## Resolved decisions

1. **Project grouping in both reports (A).** Adding a `'project'` branch to the Gantt's
   `gridRowData` is straightforward (mirrors the existing `'team'` branch), so Project is added to
   **both** the Gantt and the Scatter.
2. **v1 dimensions = Parent, Team, Project.** Release, Status, and Label are deferred. Parent is the
   only ancestor tier (no grandparent/great-grandparent).
3. **Shared groupers live in a shared location** both reports import; a new `teamGrouper` is added
   there.
4. **Left-gutter layout (B):** a fixed left gutter column shows each band's label. Alternating band
   backgrounds are optional/secondary.
5. **Shared `groupBy` route param:** Gantt and Scatter stay in sync; grouping persists across report
   switches and in the URL.
6. **Band ordering:** Parent by `rank` when available, otherwise alphabetical; Team/Project
   alphabetical. "No Parent / No Team / No Project" buckets always sort last.
7. **Single-value only in v1:** all v1 dimensions are single-value, so every issue belongs to
   exactly one band. Release (multi-value) is deferred and will be designed when picked up.

## Questions

_None open — all prior questions resolved._
