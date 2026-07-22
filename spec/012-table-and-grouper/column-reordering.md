# spec/012 Table — drag-and-drop column reordering

Child plan of [`plan.md`](./plan.md). Adds user-controlled column ordering to the
Table report by dragging column headers left/right. Order is already persisted;
this plan wires up the interaction that mutates it.

## Goal

Let a user grab a column header and drop it into a new position. The new order
survives reload and is URL-shareable (it's already part of the persisted
`tableColumns` schema). Keyboard-accessible reordering is included.

## Why this is small

Column order is **already the source of truth we need**. The persisted schema is
an *ordered* array of `TableColumnEntry` (`model/persistence.ts:19-26`), and the
report renders headers/cells by mapping over that order (`columns` →
`displayColumns` in `TableReport.tsx:551-597`). Write-back already exists:
`writeColumns(nextIds, overrides)` calls
`columnsObs.value = buildColumnEntries(...)` (`TableReport.tsx:542-544`).

So reordering = "compute a reordered `columnIds` array and call `writeColumns`."
No new persistence, no new data flow. The work is (a) a pure reorder helper +
test, and (b) the drag interaction on the header cells.

## Constraints to respect

1. **Precompiled Tailwind.** The app/Storybook load prebuilt `dist/production.css`
   (MEMORY: `tailwind-precompiled-css`). Any *new* utility class won't apply at
   runtime. Follow the existing pattern in `TableReport.tsx`: express drag styles
   via the scoped `<style>` block (`TABLE_STYLES`) or inline `React.CSSProperties`,
   not fresh Tailwind utilities.
2. **Design system = Atlaskit** (MEMORY: `design-system-atlaskit`). Prefer
   `@atlaskit/pragmatic-drag-and-drop` if it's already a dependency (it's
   Atlassian's own DnD primitive and integrates with the look). Otherwise fall
   back to native HTML5 drag events — no heavy new dependency (`react-dnd` etc.)
   without asking. **Decision point — confirm the dependency before building.**
3. **Grouped mode reorders columns already.** When 1D-grouped, `displayColumns`
   pulls the grouped field to the front (`TableReport.tsx:594-597`). Dragging must
   operate on the *persisted* `columnIds`, not the transient `displayColumns`
   order, so the group-front behavior is preserved and drops map to the right
   underlying entry.
4. **First column is frozen.** Column 0 is the sticky/frozen label column
   (`frozenLabelStyle`, `stickyCornerStyle`). Reordering into/out of position 0 is
   allowed but the freeze always applies to whatever ends up first — no special
   pinning logic needed, just make sure the sticky styles key off render index
   (they already do).
5. **Cross-tab (2D) view has no draggable field columns** — its columns are
   value-derived, not the shown-column list. DnD applies only to the flat /
   hierarchy / 1D-grouped `<table>` header (`TableReport.tsx:744-793`), not
   `CrossTabTable`.

## Implementation

### 1. Pure reorder helper (test-first)

Add to `model/applyView.ts` (alongside `removeColumn`):

```ts
/** Move the column `sourceId` to just before `targetId` (or to the end if target is null). */
export function reorderColumn(columnIds: string[], sourceId: string, targetId: string | null): string[]
```

- Removes `sourceId`, then inserts it at the index of `targetId` (or appends when
  `targetId == null` / not found).
- No-op when `sourceId === targetId`.
- Preserves all other ids in place.

Test in `model/applyView.test.ts` (or a focused `reorderColumn.test.ts`): move
left, move right, move to end, no-op on self, unknown ids. This is the piece most
worth locking down — the DnD wiring is thin around it.

### 2. Drag interaction on header cells

In `TableReport.tsx`, the `<thead>` `displayColumns.map(...)` (`:746-792`):

- Make each `<th>` a drag source and drop target keyed by `column.id`.
- On drop, translate the dropped-onto `displayColumns` position back to the
  persisted `columnIds` order, then:
  ```ts
  writeColumns(reorderColumn(columnIds, draggedId, targetId));
  ```
- **Preserve existing header behavior**: the sort button, `ColumnHeaderMenu`, and
  filter affordances must still work. Use a dedicated drag handle (a small
  `⋮⋮`/grip glyph) rather than making the whole sort button draggable, so a click
  still sorts.
- **Grip is hover-only — the report must look clean for screenshots.** The grip is
  hidden at rest and only revealed on header hover (and on keyboard focus, so it
  stays accessible), matching the header's existing hover-reveal pattern (the
  `.group` / `group-hover` treatment already on the header row). At rest the header
  row must render *identically to today* — no reserved gap, no faint glyph. Because
  new Tailwind utilities won't apply (precompiled CSS), implement the reveal in
  `TABLE_STYLES`, e.g.:
  ```css
  [data-testid="table-report"] thead th [data-testid="table-header-drag-handle"] { opacity: 0; }
  [data-testid="table-report"] thead th:hover [data-testid="table-header-drag-handle"],
  [data-testid="table-report"] thead th [data-testid="table-header-drag-handle"]:focus-visible { opacity: 1; }
  ```
  Position the grip absolutely (or otherwise out of flow) so it doesn't shift the
  label when it appears — the resting layout stays pixel-stable for screenshots.
  During an active drag the grip may stay visible on the dragged column regardless
  of hover.
- Visual affordance: a drop-indicator line between columns and a dragging opacity.
  Add these as rules in `TABLE_STYLES` (e.g.
  `[data-testid="table-report"] th[data-drag-over="true"] { box-shadow: inset 2px 0 0 #0c66e4; }`)
  since new Tailwind utilities won't apply.
- Add `data-testid`s: `table-header-drag-handle`, and a `data-column-id` on each
  `<th>` so tests/Playwright can target drops.

### 3. Keyboard accessibility

Reordering must not be mouse-only. Add to `ColumnHeaderMenu` two items —
"Move left" / "Move right" — that call `writeColumns(reorderColumn(...))` by
computing the neighbor id. Disable "Move left" on the first shown column and
"Move right" on the last. This gives a fully keyboard-operable path and doubles as
the simplest thing to unit-test at the component level.

## Testing

- **Unit**: `reorderColumn` cases (§1).
- **Component** (`TableReport.test.tsx`): render with ≥3 columns, invoke the
  "Move left/right" menu items, assert the persisted `columnsObs.value` order
  changes and header render order follows. (Menu path avoids simulating HTML5
  drag, which jsdom handles poorly.)
- **E2E** (Playwright, optional, gated on real data): drag a header via
  `browser_drag` and assert order + persistence across reload. Note existing DnD
  E2E lives under the `013-mocking-data` replay pipeline — reuse a mocked dataset
  rather than live Jira.

## Out of scope

- Column *resizing* (`width` already exists on `TableColumnEntry` but is a
  separate feature).
- Reordering rows, groups, or cross-tab axes.
- Reordering the Add-column menu / catalog.

## Suggested order

1. `reorderColumn` + tests (§1).
2. Keyboard "Move left/right" menu items + component test (§3) — smallest
   end-to-end slice that proves the wiring.
3. Pointer DnD on headers (§2) once the dependency choice is confirmed.
4. Optional E2E (§Testing) once a mocked dataset is available.
