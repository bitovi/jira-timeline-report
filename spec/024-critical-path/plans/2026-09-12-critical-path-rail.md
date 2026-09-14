# Critical Path Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the two critical-path tables out of the collapsed card at the bottom of the Auto-Scheduler and into a dockable, resizable right rail that is opened from an always-visible labelled spine, with selection running in both directions between the two tables and the Gantt.

**Architecture:** A new `CriticalPathRail` wraps the existing Gantt grid in a flex row: grid, drag divider, rail, spine. The rail is `position: sticky` so it stays beside the grid while the grid scrolls. Inside it, two independently capped scroll regions hold the routes table (first) and the epics table (second). A single selection value of one of two kinds — `epic` or `route` — drives highlighting in both tables and in the Gantt. No simulation or accumulator code changes; every number this renders is already on `StatsUIData`.

**Tech Stack:** TypeScript (strict), React 18, Vitest + @testing-library/react, Tailwind CSS, Atlaskit.

## Global Constraints

- Prettier: single quotes, 120 print width. Run `npx prettier --write <files>` before every commit.
- TypeScript strict mode with `noImplicitAny` and `strictNullChecks`. `npm run typecheck` must pass.
- Never create new CanJS UI components. All new UI is React.
- Unit tests are colocated with source as `*.test.ts` / `*.test.tsx`.
- Run tests with `npx vitest run <path>`. `npm run test` runs the whole suite.
- **Do not modify anything under `scheduler/`.** No accumulator, trace, longest-path, monte-carlo or stats-analyzer changes are needed. If you find yourself editing those, stop — the plan has gone wrong.
- Custom Tailwind colours in use here: `neutral-20`, `neutral-30`, `neutral-500`. Brand blue is `blue-600`.

## Design source

The design is settled in [`spec/024-critical-path/mockups/placement.html`](../mockups/placement.html), which is
interactive — open it in a browser. Section 5c is the chosen shell, 5d the vertical budget, 5e the tooltip copy.
Section 4 defines the bidirectional selection. Read those five sections before starting; the reasoning behind several
non-obvious choices lives there and is not repeated in full here.

## Background the implementer needs

### What already exists and works

`StatsUIData` (from `scheduler/stats-analyzer.ts`) already carries everything:

```ts
uiData.criticalPath = {
  meanLength: number;             // the "dependency floor"
  iterations: number;
  distinctPathCount: number;
  topPaths: (limit: number) => PathFrequency[];   // a thunk, not an array
};
uiData.simulationIssueResults[i].sequencingDaysAdded;        // "days added"
uiData.simulationIssueResults[i].sequencingCriticalityIndex; // "on path"
```

`PathFrequency` is `{ keys: string[]; count: number }` from `scheduler/critical-path-accumulator.ts`.

`buildCriticalPathEpics(uiData)` in `CriticalPathEpicsReport/build-critical-path-epics.ts` already returns the sorted
rows. Keep it. `highlightKeysFor(paths, issueKey)` in the same file already computes the epic→Gantt highlight set;
keep it and add a sibling for the route direction rather than changing its signature.

### Two properties that constrain the UI

**1. `daysAdded` sums to `meanLength`, but only at the mean.** Each iteration contributes one path whose per-epic days
sum to that path's length, and `daysAdded` divides by _every_ iteration rather than only the ones the epic appeared in.
Summing over all epics and swapping the order of summation gives the identity, and
`critical-path-accumulator.test.ts` pins it to ten decimal places. It holds for no other statistic: at a percentile you
would be summing values drawn from different runs, and at the median most epics contribute exactly 0 because they are
off the path more than half the time.

**2. The plan finish tracks the confidence slider; the floor does not.** `planEstimateText` in `AutoScheduler.tsx`
renders a single value at `average` and `median` but a `planBottomDays–planTopDays` **range** at every percentile.
`meanPathLength()` is unconditionally the mean. So `finish − floor` is only a real quantity when the slider is at
`average`. Task 5 encodes this; do not weaken it.

### Layout facts you will rely on

- The report renders inside `.fullish-vh` (see `TimelineReport.tsx`), which is `overflow-y-auto` with a computed
  height. `updateFullishHeightSection()` publishes its page offset as `--fullish-document-top` on `<html>`, refreshed
  on `load` and `resize`. `src/css/spacing.css` already has `.height-fullish-vh { height: calc(100vh - var(--fullish-document-top)) }`.
  **The rail's height budget is therefore available in CSS with no JS measurement.**
- The Gantt is a CSS grid with `gridTemplateColumns: [what] auto repeat(N, 1fr)` and every bar positioned in `%`, so
  narrowing its container rescales the timeline with no JS.
- `AutoScheduler.tsx` already mounts a `ResizeObserver` on the SVG container plus a `window.resize` listener, both
  calling `updateBlockers`. **Dependency curves redraw on resize for free.** You do not need to add anything for the
  drag to repaint them — but see Task 7 for the throttling this makes necessary.

### A CSS trap that will bite you

`overflow: hidden` on a flex item resets its automatic minimum size from min-content to **zero**. A scrollable card
inside a flex column with `overflow: hidden` and no explicit `min-height` will silently _clip_ its content instead of
overflowing to its parent — with no scrollbar anywhere to signal it. This was hit while building the mockup. Both
table cards need explicit `min-height`.

## File Structure

| File                                                         | Responsibility                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `CriticalPathRail/criticalPathSelection.ts` (create)         | Selection type and the pure predicates that answer "is this row lit?".          |
| `CriticalPathRail/criticalPathSelection.test.ts` (create)    | Both directions, clearing, routes not in the top five.                          |
| `CriticalPathRail/dependency-floor.ts` (create)              | Floor + queueing gap, gated on the slider being at `average`.                   |
| `CriticalPathRail/dependency-floor.test.ts` (create)         | Gap suppressed at every percentile and at median.                               |
| `CriticalPathRail/useRailWidth.ts` (create)                  | Drag-to-resize, click-to-collapse distance test, width persistence.             |
| `CriticalPathRail/useRailWidth.test.ts` (create)             | Clamping, drag vs click, restore from storage.                                  |
| `CriticalPathRail/CriticalPathRail.tsx` (create)             | The shell: sticky rail, spine, divider + grip, header, slot for the two tables. |
| `CriticalPathRail/CriticalPathRail.test.tsx` (create)        | Open/close, spine label by state, both close affordances.                       |
| `CriticalPathRail/CriticalPathRoutesTable.tsx` (create)      | Routes card: headers, five rows, expandable residual, lit/dim.                  |
| `CriticalPathRail/CriticalPathRoutesTable.test.tsx` (create) | Row counts, expansion, dimming, click emits the route id.                       |
| `CriticalPathRail/CriticalPathEpicsTable.tsx` (create)       | Epics card: headers, ten rows, expandable residual, lit/dim.                    |
| `CriticalPathRail/CriticalPathEpicsTable.test.tsx` (create)  | Row counts, residual aggregate, no total footer, dimming.                       |
| `CriticalPathRail/index.ts` (create)                         | Barrel export.                                                                  |
| `CriticalPathRail/*.stories.tsx` (create)                    | Storybook coverage for the shell and both tables.                               |
| `AutoScheduler.tsx` (modify)                                 | Wrap the grid in the rail layout; drop all three old report mounts.             |
| `CriticalPathEpicsReport/` (delete)                          | Superseded by the rail.                                                         |
| `CriticalPathsReport/` (delete)                              | "Critical Paths (new)". See Task 8.                                             |
| `CriticalPath.tsx` (delete)                                  | The legacy card. See Task 8.                                                    |

## Out of scope — do not do these

- **The confidence control redesign.** `spec/024-critical-path/mockups/confidence-control.html` is a separate piece of
  work. The spine deliberately needs no room in the controls row, so this plan does not depend on it. Leave the slider
  alone.
- **Anything under `scheduler/`.** Note that deleting `CriticalPathsReport` does **not** mean deleting
  `criticality-accumulator.ts` or `critical-path-trace.ts` — removing the only consumer of a scheduler module is a
  separate decision with its own performance argument. Leave the computation alone; delete only the UI.
- **Report of Reports.** The rail is Auto-Scheduler-only. The longer-term direction is that the Auto-Scheduler will
  not appear in a Report of Reports at all — instead "Most common critical paths" and "Epics on the critical path"
  become report types a user picks directly. That is why Tasks 5 and 6 build the two tables as standalone components
  taking plain props, with no dependency on the rail shell. Do not couple them to it.

---

### Task 1: Selection model

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/criticalPathSelection.ts`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/criticalPathSelection.test.ts`

**Interfaces:**

- Consumes: `PathFrequency` from `../scheduler/critical-path-accumulator`.
- Produces:

```ts
export type CriticalPathSelection = { kind: 'epic'; key: string } | { kind: 'route'; id: string } | null;

/** Stable identity for a route. Must match how the accumulator keys its path map. */
export function routeId(keys: string[]): string;

export function isRouteLit(selection: CriticalPathSelection, route: PathFrequency): boolean;
export function isEpicLit(selection: CriticalPathSelection, epicKey: string, routes: PathFrequency[]): boolean;

/** The Gantt highlight set for a selection, or null to clear it. */
export function highlightKeysForSelection(
  selection: CriticalPathSelection,
  routes: PathFrequency[],
): Set<string> | null;
```

`routeId` joins on `'\u0000'`, matching `CriticalPathAccumulator.addIteration`. Do not use `JSON.stringify` — a
separator that cannot appear in a Jira key is the point.

**Semantics, and the reason for each:**

- `selection === null` → nothing is lit and nothing is dimmed. A table with no selection renders every row at full
  strength. Do not invert this into "everything lit".
- `kind: 'epic'` → a route is lit if its `keys` include the epic. The epic's own row is lit; other epic rows are
  **not** dimmed, because the epics table is a ranking and dimming it would destroy the comparison you selected in
  order to make.
- `kind: 'route'` → the route's own row is lit; **epic rows are dimmed unless on that route**, which is what makes
  "which link in this chain do I attack" readable.

That asymmetry is deliberate and is the single most likely thing for a reviewer to flag as a bug. Comment it.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { highlightKeysForSelection, isEpicLit, isRouteLit, routeId } from './criticalPathSelection';

const routes = [
  { keys: ['STORE-17', 'STORE-18', 'ORDER-23'], count: 65 },
  { keys: ['STORE-17', 'MARKETING-5'], count: 16 },
  { keys: ['MARKETING-6'], count: 3 },
];

describe('criticalPathSelection', () => {
  it('lights nothing when there is no selection', () => {
    expect(isRouteLit(null, routes[0])).toBe(false);
    expect(isEpicLit(null, 'STORE-17', routes)).toBe(false);
    expect(highlightKeysForSelection(null, routes)).toBeNull();
  });

  it('lights every route containing the selected epic', () => {
    const selection = { kind: 'epic', key: 'STORE-17' } as const;
    expect(isRouteLit(selection, routes[0])).toBe(true);
    expect(isRouteLit(selection, routes[1])).toBe(true);
    expect(isRouteLit(selection, routes[2])).toBe(false);
  });

  it('lights every epic on the selected route', () => {
    const selection = { kind: 'route', id: routeId(routes[0].keys) } as const;
    expect(isEpicLit(selection, 'ORDER-23', routes)).toBe(true);
    expect(isEpicLit(selection, 'MARKETING-5', routes)).toBe(false);
  });

  it('highlights the whole chain for a route selection', () => {
    const selection = { kind: 'route', id: routeId(routes[1].keys) } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(new Set(['STORE-17', 'MARKETING-5']));
  });

  it('highlights the union of every route through a selected epic', () => {
    const selection = { kind: 'epic', key: 'STORE-17' } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(
      new Set(['STORE-17', 'STORE-18', 'ORDER-23', 'MARKETING-5']),
    );
  });

  it('falls back to the epic alone when it is on no route', () => {
    const selection = { kind: 'epic', key: 'NEVER-ON-A-PATH' } as const;
    expect(highlightKeysForSelection(selection, routes)).toEqual(new Set(['NEVER-ON-A-PATH']));
  });
});
```

The last case matters: an epic with `onPathIndex === 0` is still clickable, and highlighting nothing would blank the
Gantt. `highlightKeysFor` in `build-critical-path-epics.ts` already has this behaviour — match it.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/react/reports/AutoScheduler/CriticalPathRail/criticalPathSelection.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `criticalPathSelection.ts`**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: `npx prettier --write` the two files, then `npm run typecheck`**
- [ ] **Step 6: Commit** — `feat(auto-scheduler): add bidirectional critical-path selection model`

---

### Task 2: Dependency floor and the queueing gap

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/dependency-floor.ts`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/dependency-floor.test.ts`

**Interfaces:**

- Produces:

```ts
export interface FloorSummary {
  /** Mean longest dependency chain, in working days. */
  floorDays: number;
  /** Plan finish minus floor, or null when the two are not comparable. */
  queueingDays: number | null;
}

export function summariseFloor(args: {
  meanPathLength: number;
  uncertaintyWeight: UncertaintyWeight; // `number | 'average'`, from hooks/useUncertaintyWeight
  planBottomDays: number;
  planTopDays: number;
}): FloorSummary;
```

Import the type: `import type { UncertaintyWeight } from '../hooks/useUncertaintyWeight'`. `AutoScheduler` already
holds this value via `useUncertaintyWeight()`, and `planBottomDays` / `planTopDays` are already computed there from
`uiData.endDaySimulationResult` — pass all three down rather than recomputing.

**The rule:** `queueingDays` is non-null **only** when `uncertaintyWeight === 'average'`. At `median` and at every
percentile it is `null` and the UI omits the clause entirely. See "Two properties that constrain the UI" above — this
is not a rounding nicety, a percentile minus a mean is not a quantity.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { summariseFloor } from './dependency-floor';

const base = { meanPathLength: 53.8, planBottomDays: 91, planTopDays: 91 };

describe('summariseFloor', () => {
  it('reports the gap at the average', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 'average' })).toEqual({
      floorDays: 53.8,
      queueingDays: 37.2,
    });
  });

  it('suppresses the gap at the median, because that mixes a median with a mean', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 50 }).queueingDays).toBeNull();
  });

  it('suppresses the gap at every percentile, where the plan finish is a range', () => {
    for (const weight of [60, 70, 80, 90]) {
      expect(summariseFloor({ ...base, uncertaintyWeight: weight, planTopDays: 112 }).queueingDays).toBeNull();
    }
  });

  it('still reports the floor when the gap is suppressed', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 80 }).floorDays).toBe(53.8);
  });

  it('never reports a negative gap', () => {
    expect(
      summariseFloor({ meanPathLength: 95, planBottomDays: 91, planTopDays: 91, uncertaintyWeight: 'average' })
        .queueingDays,
    ).toBe(0);
  });
});
```

The last case is defensive: the floor is a genuine lower bound on the mean finish, so a negative gap means something
upstream is wrong. Clamp to 0 rather than rendering a negative number at a user.

- [ ] **Step 2: Run the tests and confirm they fail**
- [ ] **Step 3: Implement `dependency-floor.ts`**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Prettier, typecheck**
- [ ] **Step 6: Commit** — `feat(auto-scheduler): compute the dependency floor and queueing gap`

---

### Task 3: The resize hook

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/useRailWidth.ts`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/useRailWidth.test.ts`

**Interfaces:**

- Produces:

```ts
export const RAIL_MIN_WIDTH = 260;
export const RAIL_MAX_WIDTH = 560;
export const RAIL_DEFAULT_WIDTH = 340;

export function useRailWidth(options: { onCollapse: () => void }): {
  width: number;
  isDragging: boolean;
  dividerProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  };
};
```

**Behaviour:**

- `pointerdown` captures the pointer and records the start x and the current width.
- `pointermove` sets `width = clamp(startWidth - (clientX - startX), MIN, MAX)`. The rail is on the **right**, so
  dragging left makes it **wider** — note the sign.
- `pointerup` releases capture. **If the pointer never travelled more than 3px, call `onCollapse()`** — that is what
  makes the divider double as the collapse control, and it is why the grip in Task 4 is not decorative.
- **No persistence.** Width and open/closed are in-memory React state only — no `localStorage`, no saved-report field,
  no URL param. A refresh resets both, and that is the intended behaviour. Do not add persistence "for convenience";
  it was considered and rejected.

- [ ] **Step 1: Write the failing tests**

Use `renderHook` from `@testing-library/react`. Build pointer events with plain objects carrying
`clientX`, `pointerId`, and stubs for `setPointerCapture` / `releasePointerCapture` / `preventDefault`, since jsdom
does not implement pointer capture.

Cover: width grows when dragging left; clamps at both bounds; a <3px press calls `onCollapse` and does not change
width; a >3px drag does **not** call `onCollapse`; width starts at `RAIL_DEFAULT_WIDTH`.

- [ ] **Step 2: Run the tests and confirm they fail**
- [ ] **Step 3: Implement `useRailWidth.ts`**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Prettier, typecheck**
- [ ] **Step 6: Commit** — `feat(auto-scheduler): add rail resize hook with click-to-collapse`

---

### Task 4: The rail shell

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRail.tsx`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRail.test.tsx`

**Interfaces:**

- Consumes: `useRailWidth` (Task 3), `summariseFloor` (Task 2).
- Produces:

```ts
export interface CriticalPathRailProps {
  floor: FloorSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode; // the two tables, routes first
}
```

**Structure** — this is the 5c shell from the mockup:

```
<div className="flex items-stretch">
  <div className="flex-1 min-w-0">{grid}</div>        ← supplied by the caller, not this component
  {open && <div role="separator" …drag handle with grip… />}
  {open && <aside className="sticky top-0 …" style={{ width }}>…header + children…</aside>}
  {!open && <button className="…spine…">◧ Critical path · floor 53.8 d</button>}
</div>
```

**Non-obvious requirements, each with its reason:**

- The spine renders **only while closed**. Keeping it open costs 26px of Gantt for a control whose job is to close
  something you can already see. Measured in the mockup: 493px of grid with the spine gone versus 467px with it.
- **The rail starts closed, every time.** No persistence — see Task 3. Closed is safe precisely because the spine
  keeps the label and the floor figure on screen.
- The spine is a real `<button>` with `aria-expanded`. The rotation is `writing-mode: vertical-rl`, purely visual, so
  screen readers still get a normal label. **Do not** implement it as rotated text in a `div`.
- The rail is `position: sticky; top: 0` with `max-height: calc(100vh - var(--fullish-document-top))`. Not cosmetic:
  the grid scrolls inside `.fullish-vh`, so a statically positioned rail scrolls away and forty epics down the Gantt
  the tables are off screen — which removes the entire reason for putting them beside the grid.
- The divider carries a visible grip (a small chevron, absolutely positioned so it overflows the 5px divider and
  costs no layout width). Click-to-collapse is undiscoverable without it.
- The header shows `Critical path` and, beneath it, `Dependency floor <n> d` plus `· queueing <n> d` **only when
  `floor.queueingDays !== null`**.
- A `×` in the header also closes. Two affordances is correct here — the `×` is what most people look for, the grip
  is what someone already resizing will use without moving their hand.

**Tooltip.** Attach Atlaskit `Tooltip` to the `Dependency floor` label. Copy, verbatim from mockup section 5e:

> **Dependency floor · N working days**
> The average length of the longest chain of `Blocks` links, if no epic ever waited for a free track.
> Team velocity still applies — each epic takes as long as its team's throughput allows. Only queueing behind other
> work in this plan is removed.
> Always an average. It does not follow the confidence slider.

- [ ] **Step 1: Write the failing tests**

Cover: closed by default renders the spine and not the tables; clicking the spine calls `onOpenChange(true)`; when
open the spine is absent and the children render; the `×` calls `onOpenChange(false)`; the header omits the queueing
clause when `queueingDays` is `null` and includes it when it is a number; the spine button exposes `aria-expanded`.

- [ ] **Step 2: Run the tests and confirm they fail**
- [ ] **Step 3: Implement `CriticalPathRail.tsx`**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Add `CriticalPathRail.stories.tsx`** — stories for: closed, open, open with the queueing clause
      suppressed (`queueingDays: null`), and open at a 300px height budget. These are the states that are painful to
      reach in the real app, which is the point.
- [ ] **Step 6: Prettier, typecheck**
- [ ] **Step 7: Commit** — `feat(auto-scheduler): add collapsible resizable critical-path rail shell`

---

### Task 5: Routes table

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRoutesTable.tsx`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRoutesTable.test.tsx`

**Interfaces:**

```ts
export const ROUTE_ROWS_SHOWN = 5;

export interface CriticalPathRoutesTableProps {
  routes: PathFrequency[]; // already sorted, from topPaths(Infinity)
  iterations: number;
  labelFor: (keys: string[]) => string;
  selection: CriticalPathSelection;
  onSelectRoute: (id: string) => void;
}
```

**Requirements:**

- Title `Most common critical paths`, caption `How often each chain was the longest one · N routes`.
- Column headers `SHARE` and `CHAIN`. Both columns get a header — an earlier revision had one header over two
  columns and it read as a mislabel.
- Five rows, then a residual row `▸ N other routes` carrying the **combined share**. Clicking it expands the rest in
  place and flips the marker to `▾`; clicking again collapses.
- Percentages are the share of **all iterations**, not of the rows shown. A route winning 41 of 10,000 runs must not
  read as a majority because it happens to top a short list.
- Rows are buttons; clicking emits `onSelectRoute(routeId(route.keys))`. Clicking the lit row again clears —
  the parent owns that, so just emit.
- Lit/dim per `isRouteLit`. **Dim, never filter.** Filtering throws away the comparison the user selected in order to
  make; the two lit routes summing to 81% against the epic's own 83% is only visible if the others stay on screen.
- The scroll area needs `max-height`, `overflow-y: auto`, `overscroll-behavior: contain`, and an explicit
  `min-height` on the card. See the CSS trap above.

- [ ] **Step 1: Write the failing tests**

Cover: exactly five rows plus a residual when there are nine routes; no residual when there are five or fewer;
residual expands and collapses; percentages are computed against `iterations`; a route selection lights one row and
dims the others; an epic selection lights every route containing it; clicking emits the joined id.

- [ ] **Step 2: Run the tests and confirm they fail**
- [ ] **Step 3: Implement the component**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Add `CriticalPathRoutesTable.stories.tsx`** — no selection, residual collapsed; residual expanded; an
      epic selection lighting two of nine routes; a route selection.
- [ ] **Step 6: Prettier, typecheck**
- [ ] **Step 7: Commit** — `feat(auto-scheduler): add critical-path routes table`

---

### Task 6: Epics table

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathEpicsTable.tsx`
- Test: `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathEpicsTable.test.tsx`

**Interfaces:**

```ts
export const EPIC_ROWS_SHOWN = 10;

export interface CriticalPathEpicsTableProps {
  rows: CriticalPathEpicRow[]; // from the existing buildCriticalPathEpics
  routes: PathFrequency[];
  selection: CriticalPathSelection;
  onSelectEpic: (key: string) => void;
}
```

**Requirements:**

- Title `Epics on the critical path`, caption `Days each epic adds to the dependency floor`. The caption must **not**
  repeat the number — the header already states it, and an earlier revision had 53.8 appearing three times in one
  panel.
- Column headers `EPIC`, `DAYS ADDED`, `ON PATH`.
- Ten rows, then a residual `▸ N other epics` carrying the **summed `daysAdded`** of the tail, expandable in place.
- **No "Critical path length" total footer.** It duplicates the header figure and gives the same quantity a second
  name. The residual row replaces it and is strictly more informative, because it also says the list is truncated.
  A reader adding the visible rows plus the residual will land within 0.1 of the header figure; that is one-decimal
  display rounding, not an error.
- Rows are buttons emitting `onSelectEpic(row.key)`.
- Lit/dim per `isEpicLit` — **epic rows are dimmed only for a route selection**, never for an epic selection. See
  Task 1.
- Same scroll-area requirements as Task 5.

- [ ] **Step 1: Write the failing tests**

Cover: ten rows plus a residual for sixteen epics; residual aggregates `daysAdded` and expands; **no element with
text `Critical path length`**; an epic selection lights that row and dims nothing; a route selection dims epics not on
the route; clicking emits the key.

- [ ] **Step 2: Run the tests and confirm they fail**
- [ ] **Step 3: Implement the component**
- [ ] **Step 4: Run the tests and confirm they pass**
- [ ] **Step 5: Add `CriticalPathEpicsTable.stories.tsx`** — no selection; residual expanded; a route selection dimming
      most rows; a plan where every epic has `daysAdded: 0`.
- [ ] **Step 6: Prettier, typecheck**
- [ ] **Step 7: Commit** — `feat(auto-scheduler): add critical-path epics table`

---

### Task 7: Assemble and mount

**Files:**

- Create: `src/react/reports/AutoScheduler/CriticalPathRail/index.ts`
- Modify: `src/react/reports/AutoScheduler/AutoScheduler.tsx`
- Test: extend `src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRail.test.tsx`

**What to do:**

1. Wrap the existing Simulation Grid `<div className="grid bg-white …">` in the rail layout. The grid goes in the
   flex-1 column; the rail is its sibling. Do not restructure the grid itself.
2. Own `selection: CriticalPathSelection` in `AutoScheduler` and pass it down. Clicking an already-selected row
   clears to `null`.
3. On every selection change, call `setWorkItemsToHighlight(highlightKeysForSelection(selection, routes))`.
4. **Order inside the rail is routes first, epics second.** The panel is labelled "Critical path", so the first thing
   under that label must be critical paths. Tested in the mockup: the order changes no heights, so this is purely
   about the label matching its contents.
5. **The rail becomes the sole writer of `workItemsToHighlight`.** Today three components write it —
   `CriticalPath`, `CriticalPathsReport`, `CriticalPathEpicsReport` — and all three are deleted by Task 8. That
   removes the reason for the `highlightWeWrote` ref dance in `CriticalPathEpicsReport`: with one writer, the
   selection is the single source of truth and the highlight set is derived from it. **Do not port the ref.** If you
   find yourself needing it, a fourth writer has appeared and something is wrong.
6. Remove the `<CriticalPathEpicsReport …/>` mount and delete the directory.

**Throttle the blocker redraw.** `makeInsertBlockers` rebuilds every SVG path and runs
`document.querySelectorAll('.work-item')` on each call. The existing `ResizeObserver` will now fire on every
`pointermove` of a drag. Coalesce with `requestAnimationFrame` before shipping — on a 200-epic plan the unthrottled
version will stutter badly. Measure on a large plan; if rAF is not enough, redraw on `pointerup` only and show a plain
divider line during the drag.

**The Gantt filters; the tables dim. This is decided — do not "fix" the inconsistency.**
`gridifyStatsUIData` in `AutoScheduler.tsx` already filters the grid to `workItemsToHighlight`, dropping
non-matching rows and any team band left empty. **Keep that exactly as it is** — no changes to
`gridifyStatsUIData` or `IssueSimulationRow` are needed or wanted.

The two surfaces have different jobs, which is why they behave differently:

- The **Gantt** is a focus surface. The point of the click is to isolate the blocking chain against the timeline, and
  on a 200-epic plan 196 faded rows are worse than none. `CriticalPathEpicsReport` already made this call for its own
  routes list, with the comment _"a dimmed row is still noise"_.
- The **tables** are comparison surfaces. Dimming keeps the ranking you selected in order to read — the two lit routes
  summing to 81% against the epic's own 83% is only visible if the others stay on screen.

Note for epic selections: `highlightKeysForSelection` returns the **union** of every route through that epic, so the
Gantt can still show a fairly wide set. That matches the existing `highlightKeysFor` behaviour and is intended.

- [ ] **Step 1: Write the failing integration test** — render `AutoScheduler` with a stub `StatsUIData`, open the
      rail, click an epic row, assert the routes containing it are lit and `setWorkItemsToHighlight` received the union
      of their keys. Then click a route row and assert the epics table dims the rows not on it.
- [ ] **Step 2: Run it and confirm it fails**
- [ ] **Step 3: Implement the layout and wiring**
- [ ] **Step 4: Run it and confirm it passes**
- [ ] **Step 5: Delete `CriticalPathEpicsReport/` and its imports**
- [ ] **Step 6: Run the full Auto-Scheduler suite** — `npx vitest run src/react/reports/AutoScheduler`
- [ ] **Step 7: Prettier, typecheck**
- [ ] **Step 8: Commit** — `feat(auto-scheduler): mount the critical-path rail beside the Gantt`

---

### Task 8: Retire the two superseded critical-path reports

**Files:**

- Delete: `src/react/reports/AutoScheduler/CriticalPathsReport/` (4 files)
- Delete: `src/react/reports/AutoScheduler/CriticalPath.tsx`
- Modify: `src/react/reports/AutoScheduler/AutoScheduler.tsx`

Both are superseded by the rail. Shipping three critical-path surfaces — using two different definitions of "critical
path" — is worse than shipping one.

**`CriticalPathsReport` ("Critical Paths (new)")** was paused in commit `926daf19` with the note _"paused while its
ranking model is reworked"_, that rework never happened, and it was re-enabled in an **isolated commit specifically so
it could be dropped without touching anything else** (`status.md` open question 1). It also has an unfixed defect: its
per-row percentage describes only the chain's root epic, and `biggestByQueuedDelay` is computed over the whole chain
while `totalQueuedDays` excludes the root — so single-epic rows show "10 d total" beside "70 days queued".

**Keep the scheduler modules.** `criticality-accumulator.ts` and `critical-path-trace.ts` lose their only UI consumer
here, but deleting a computation is a separate decision with its own performance argument. Delete the UI only.

- [ ] **Step 1:** Delete `CriticalPath.tsx` and its mount in `AutoScheduler.tsx`.
- [ ] **Step 2:** Run `npx vitest run src/react/reports/AutoScheduler` — confirm nothing else referenced it.
- [ ] **Step 3:** Commit — `refactor(auto-scheduler): remove the legacy Critical Paths card`
- [ ] **Step 4:** Delete `CriticalPathsReport/` and its mount.
- [ ] **Step 5:** Run the suite again, then `npm run typecheck`.
- [ ] **Step 6:** Grep for `criticalityIndex`, `meanWorkDays`, `meanQueuedDays` to confirm the only remaining
      references are in `scheduler/` and its tests. Leave those.
- [ ] **Step 7:** Commit — `refactor(auto-scheduler): remove the superseded Critical Paths (new) report`

---

### Task 9: Accessibility, scroll behaviour, and manual verification

**Files:**

- Modify: the rail and both tables.

- [ ] **Step 1:** Divider gets `role="separator"`, `aria-orientation="vertical"`,
      `aria-valuenow/min/max`, `tabIndex={0}`, and Left/Right arrow keys that resize in 16px steps. A pointer-only
      resize is not shippable.
- [ ] **Step 2:** On selection change, `scrollIntoView({ block: 'nearest' })` the responding table's first lit row.
      On a short viewport the other table can be below the fold, so the bidirectional interaction would otherwise
      fire off screen.
- [ ] **Step 3:** Verify `overscroll-behavior: contain` on both scroll areas — a flick inside the epics list must not
      run away with the page.
- [ ] **Step 4: Manual check against real Jira.** `npm run dev`, load a plan of 100+ epics. Confirm: the rail sticks
      while the grid scrolls; dragging is smooth and the dependency curves keep up; neither table collapses at a
      1200×700 window; both residuals expand; selection works both ways; the Gantt highlight matches.
- [ ] **Step 5: Make the rail print below the grid.** Add a `@media print` rule that un-sticks the rail, drops it out
      of the flex row and lets it flow underneath at full width. The Gantt already fights for horizontal room on
      paper, so it keeps the full page width and the tables follow it. `src/css/print.css` already neutralises
      `overflow`/`height` on `.fullish-vh`, so the rail's `max-height` must be neutralised there too or it will clip
      mid-table. Print a 100-epic plan and check the tables are complete and unclipped.
- [ ] **Step 6:** Check fullscreen mode. `src/css/fullscreen.css` zeroes `.fullish-vh`'s horizontal padding, and
      `FullscreenToggle.tsx` dispatches a synthetic `window.resize` specifically because `--fullish-document-top` is
      only recalculated on `load`/`resize`. The rail's `max-height` should therefore follow the toggle for free —
      **verify that it does**, entering and leaving fullscreen with the rail open.
- [ ] **Step 7: Commit** — `feat(auto-scheduler): keyboard resize and scroll behaviour for the critical-path rail`

---

## Decisions already made — do not re-litigate

Each of these was considered and settled. If one looks wrong, raise it rather than quietly doing something else.

- **The Gantt filters, the tables dim.** Different jobs: the grid isolates the chain, the tables preserve the
  comparison. `gridifyStatsUIData` needs no change. See Task 7.

- **The rail defaults closed, and nothing is persisted.** No `localStorage`, no saved-report field, no URL param.
  Width and open/closed are in-memory state; a refresh resets them, and that is intended. Closed is safe because the
  spine keeps the label and the floor figure on screen.
- **Routes first, epics second.** The panel is labelled "Critical path"; the first thing under that label must be
  critical paths. Order changes no heights, so this is purely about the label matching its contents.
- **The spine hides while the rail is open.** It is 26px spent on closing something already visible.
- **Dim, never filter, in both tables.** The Gantt is the exception, above.
- **No "Critical path length" total footer.** The residual row replaces it.
- **The queueing gap is shown only at `average`.**
- **Both older critical-path reports are deleted** (Task 8), leaving one surface rather than three.
- **Numbers render live while the simulation converges**, with no placeholder or "settling" treatment — consistent
  with the rest of the report, which already updates behind a progress bar.
- **No narrow-viewport breakpoint.** If the rail crowds the Gantt, the user closes it. Do not add a breakpoint, and
  do not auto-close.
- **The rail is Auto-Scheduler-only.** Longer term the Auto-Scheduler will not appear in a Report of Reports at all;
  "Most common critical paths" and "Epics on the critical path" become report types picked directly. That is why the
  two tables are standalone components with no dependency on the rail shell — keep them that way.
