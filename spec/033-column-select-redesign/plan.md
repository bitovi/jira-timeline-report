# 033 — Expandable grouped field picker

Redesign the shared searchable field/column picker into a two-layout (expanded / compact) grouped grid,
and put it back into the Add Report modal's Field control. Presentation only — no catalog changes, no
column reordering, no new modal.

> **Numbering.** This folder was `031` while the work sat on a branch cut from `feature/forge`. Rebasing
> that branch onto `main` put it beside [031 — autoscheduler capacity](../031-autoscheduler-capacity/README.md)
> and [032 — team save drops `getUrl`](../032-team-save-drops-geturl/README.md), which had taken both
> numbers in the meantime, so it moved to `033`.
>
> `spec/030-inline-custom-field-report/plan.md` § _Explicitly deferred to a future `spec/034-*/plan.md`_
> holds the "as-of a past date" / rollback-slider work ("name TBD") and the three open questions for it.
> That forward reference has been repointed to `034`; nothing here is dangling.

## Context

The Add Report modal's **Field** control is a plain grouped `@atlaskit/select`
(`ValueReportForm.tsx:179-205`). Against a real Jira instance its `Fields` group carries 180+ entries in
one ~300px column, so finding a field means scrolling a one-per-row list. That is the reason for this
redesign.

There is already a shared control for exactly this job: `SearchablePicker`
(`src/react/components/SearchablePicker/SearchablePicker.tsx`), an `@atlaskit/popup` + `@atlaskit/textfield`
searchable grouped single-select list, used today by Table's `+ Add column` (`AddColumnButton.tsx:34`).
Its own header comment says it exists so "Report of Reports' field picker can be the same control rather
than a second one that drifts".

**The modal does not use it, and that was deliberate.** `ValueReportForm.tsx:50-56` records two reasons
it was ripped out: `@atlaskit/popup` rendered _under_ the modal, and a Tailwind-styled trigger beside an
Atlaskit select "does not read as its sibling".

Both were true. Investigating them turned up a **third reason nobody wrote down, which is the one that
actually matters** — see § 8. The naive fix (portal the popup and raise its `z-index`, the way the two
selects in that row already do) would have layered correctly and then failed anyway, because the modal's
focus lock pulls focus out of a portalled panel the moment its search field takes it. That is invisible
until you put a focusable input inside the popover, which is precisely what this redesign does.

**Outcome of this plan:** one component, two layouts, wired into both call sites — Table's `+ Add column`
gets the redesign for free, and the second grouped-picker control that `SearchablePicker`'s doc comment
was written to prevent never gets created.

**Explicitly not in scope:** column reordering and removal stay in `ColumnHeaderMenu.tsx`; no "Manage
columns" modal; no multi-select mode; no change to which groups or fields either catalog offers.

## Decisions (locked with Arthur)

| Question           | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visual system      | **Repo conventions, not the source design's Bitovi hex/Phosphor spec.** Keep the design's _layout_ (3-column bands, sticky headers, footer toggle, widths, max-height); render it with `@atlaskit/icon` glyphs and existing Tailwind tokens. Nothing added to `package.json`.                                                                                                                                                                          |
| Where it lands     | **Extend `SearchablePicker` in place and wire both call sites.** No new component.                                                                                                                                                                                                                                                                                                                                                                     |
| Multi-select mode  | **Omitted.** The source design asked for `mode: 'single' \| 'multi'` "so the table's Add column toolbar can use the same component" — but that toolbar is already single-select-and-close (`AddColumnButton.tsx`, `excludeIds` + one `onSelect`). No caller would consume it.                                                                                                                                                                          |
| Footer label       | **"Expand" / "Collapse"**, not the mockups' "Browse all". Accessible names "Expand field list" / "Collapse field list".                                                                                                                                                                                                                                                                                                                                |
| Sort within groups | **Alphabetical by default, with a per-group opt-out.** A 3-column grid is only scannable if sorted, but `fieldCatalog.ts:57-68` curates `Common`'s order on purpose ("the curated list is curated in its useful order"). The opt-out honours both.                                                                                                                                                                                                     |
| Group taxonomy     | **Unchanged.** The IDENTITY / REPORT FIELDS headers in the mockups are placeholder data. The modal keeps `Derived / Common / Fields` (`fieldCatalog.ts:18,27`); the table keeps `Common / Identity / Report Fields / Fields / Computed` (`AddColumnButton.tsx:25`). `fieldCatalog.ts:1-12` explains why the table's groups must stay out of the modal — they read a rolled-up `TableIssue` and would resolve to nothing against a raw search response. |

### Colours, since the source design's palette is not this repo's

The design's teal/grey values are not Tailwind tokens here, and one is actively ruled out: `#00848B` is
called out in `spec/029-report-of-reports-redesign/plan.md:142,443` as **failing the contrast floor**,
so it must not be used for text or carets (rule 7: text must be `#687879` or darker). Use instead:

| Role                | Token                                                       |
| ------------------- | ----------------------------------------------------------- |
| Group header        | `text-neutral-801` (#44546F)                                |
| Row text            | `text-neutral-800` (#172B4D)                                |
| Row hover           | `hover:bg-neutral-201` (#091E420F)                          |
| Keyboard-active row | `bg-blue-101` (#E9F2FF) — the pattern at `ReportRow.tsx:69` |
| Hairlines           | `border-neutral-301` (#091E4224)                            |

The **trigger** is the exception and does not use these — see § 9.

## Key files

| File                                                                       | Role                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/react/components/SearchablePicker/SearchablePicker.tsx`               | The component being extended.                                                                                                                                                                                                                                                                        |
| `src/react/components/SearchablePicker/SearchablePicker.test.tsx`          | Must stay green; gains the new cases.                                                                                                                                                                                                                                                                |
| `src/react/reports/ReportOfReports/components/ValueReportForm.tsx`         | `FieldSelect` (`:179-205`) becomes the picker. Owns the layering + trigger work.                                                                                                                                                                                                                     |
| `src/react/reports/ReportOfReports/components/ValueReportForm.stories.tsx` | **Its `InAModal` story is not a modal** — fix first, see § 13.                                                                                                                                                                                                                                       |
| `src/react/reports/TableReport/components/AddColumnButton.tsx`             | Existing caller. Inherits the redesign; adds two props.                                                                                                                                                                                                                                              |
| `src/react/reports/TableReport/components/TableReportControls.test.tsx`    | **`:92-94` is the most fragile existing assertion in this change.** Read before touching the panel's DOM.                                                                                                                                                                                            |
| `src/react/hooks/useLocalStorage/useLocalStorage.ts`                       | Layout persistence. **Gotcha:** its default `deserialize` is `JSON.parse`, called on `getItem(key) ?? ''`, so a missing key throws — pass a guarding `deserialize`, as `useRecentReports.ts:17-30` does.                                                                                             |
| `src/react/components/ReportListing/useReportSearch.ts`                    | The keyboard-nav _pattern_ to follow (handler on the search input, `activeIndex` over the filtered array, reset on query change). Reports-specific, so it cannot be imported — copy the shape, not the code. Its sibling `report-search.ts` is the precedent for splitting pure logic out of a hook. |

---

## 1. The prop signature

Additive — every existing prop keeps its meaning, so `AddColumnButton.tsx:34-53` compiles untouched.

```ts
export type PickerLayout = 'expanded' | 'compact';

export interface SearchablePickerProps {
  // — unchanged —
  items: PickerItem[]; // { id, label, group }
  groupOrder: readonly string[];
  excludeIds?: readonly string[];
  placeholder: string;
  emptyMessage: string;
  testIdPrefix: string;
  onSelect: (id: string) => void;

  // — new —
  /** The currently picked item. Gets a check on the right of its row. Single-select. */
  selectedId?: string | null;
  /** Groups whose items keep the order the caller passed. Everything else sorts by `localeCompare`. */
  unsortedGroups?: readonly string[];
  /** localStorage key for the expand/collapse choice. Omit and the choice is per-mount only. */
  layoutStorageKey?: string;
  /** Forwarded to Popup. Needed only by a caller inside a dialog — see § 8. */
  shouldRenderToParent?: boolean;
  role?: string;
  label?: string;
  fallbackPlacements?: Placement[];

  trigger: (triggerProps: PickerTriggerProps, toggle: () => void) => ReactNode;
}

/**
 * `Omit` rather than `extends`: `TriggerProps['aria-haspopup']` is `boolean | 'dialog'`
 * (popup/dist/types/types.d.ts:9), so narrowing it in an interface extension is an illegal override.
 * Spread Popup's own props, overwrite that one key, add `role` — callers keep writing
 * `<button {...triggerProps}>` and get combobox semantics for free.
 */
export type PickerTriggerProps = Omit<TriggerProps, 'aria-haspopup'> & {
  role: 'combobox';
  'aria-haspopup': 'listbox';
};
```

No `mode`, and no `defaultLayout` / `showLayoutToggle`: the source design listed `defaultLayout`, but both
callers want `'expanded'`, so it is a module constant (`DEFAULT_LAYOUT`, `EXPANDED_COLUMNS = 3`) until a
second answer exists.

## 2. File split

112 lines today; this roughly triples it. Mirror `ReportListing/`, which already separates pure logic
from its hook (`report-search.ts` + `useReportSearch.ts` + colocated tests):

| File                           | Status   | Why                                                                                                                                                 |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchablePicker.tsx`         | modified | Props, `Popup`, `isOpen`, layout state, augmented trigger props. Stays thin.                                                                        |
| `PickerPanel.tsx`              | new      | Everything inside the popover: search, grouping, rows, active index, refs, both layouts, footer.                                                    |
| `picker-grid.ts`               | new      | Pure grid math (`buildRows` / `buildPositions` / `moveActiveIndex`). No React, no DOM.                                                              |
| `usePickerKeyboard.ts`         | new      | `activeIndex` + `handleKeyDown`, thin over `picker-grid.ts`.                                                                                        |
| `usePickerLayout.ts`           | new      | The guarded `useLocalStorage` wrapper, `parseLayout`, `PickerLayout`.                                                                               |
| `SearchablePicker.stories.tsx` | new      | **Not optional polish.** jsdom has no layout, so this is the only place the grid, sticky headers, scrollport and scroll math are verifiable at all. |
| `index.ts`                     | modified | Also re-export `PickerLayout`, `PickerTriggerProps`. `AddColumnButton`'s import path does not change.                                               |

No `PickerFooter.tsx` — ~12 lines, used once; inline it.

**Moving `search` into `PickerPanel` is a simplification, not a relocation.** `Popup` renders nothing
when closed (proved by `SearchablePicker.test.tsx:43,48`), so the panel unmounts on close and takes its
query, refs and active index with it. Both `setSearch('')` calls (`:70`, `:95`) delete, and
`'clears the search between openings'` (`:101-111`) keeps passing for a structural reason instead of a
bookkeeping one.

## 3. Layout persistence — `usePickerLayout.ts`

Keep the default `serialize`, so the stored value is JSON (`'"compact"'`); guard only the read side.

```ts
const UNPERSISTED_KEY = '__searchable-picker-layout-unpersisted__';

export const parseLayout = (raw: string): PickerLayout => {
  if (!raw) return DEFAULT_LAYOUT; // JSON.parse('') throws — useLocalStorage.ts:11 hands us ''
  try {
    return JSON.parse(raw) === 'compact' ? 'compact' : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT; // hand-edited or pre-JSON value
  }
};

/**
 * Hooks can't be conditional, so `useLocalStorage` is always called — but with no `layoutStorageKey`
 * we hand back a plain `useState` pair instead, so its setter never runs and nothing is written.
 */
export const usePickerLayout = (storageKey?: string) => {
  const persisted = useLocalStorage<PickerLayout>(storageKey ?? UNPERSISTED_KEY, { deserialize: parseLayout });
  const ephemeral = useState<PickerLayout>(DEFAULT_LAYOUT);
  return storageKey ? persisted : (ephemeral as typeof persisted);
};
```

Export `parseLayout` separately so the missing-key and garbage-value guards are directly testable. Call
the hook from `SearchablePicker`, not the panel, so the choice survives close/reopen even with no key.
Each caller passes **its own key** so expanding in the modal does not also expand the table's picker.

## 4. Sorting

Fold into the existing `grouped` computation (`SearchablePicker.tsx:52-63`):

```ts
const unsorted = new Set(unsortedGroups ?? []);
// …inside the existing groupOrder.map:
items: unsorted.has(group) ? inGroup : [...inGroup].sort((a, b) => a.label.localeCompare(b.label)),
```

Copy before sorting — `available.filter(...)` returns a fresh array today, but that is an implementation
detail worth not depending on.

- `ValueReportForm`: `unsortedGroups={['Common']}` — `fieldCatalog.ts:57-68`'s curated order.
- `AddColumnButton`: `unsortedGroups={['Common', 'Identity', 'Report Fields']}` — all three are curated
  in `buildColumnCatalog.ts:226-271` (`identity` is a hand-written array; `builtin` follows
  `BUILTIN_CONCEPTS`; `reportFields` follows `REPORT_FIELD_FACETS` plus the four estimation columns).
  `Fields` sorts (already name-sorted by `useJiraIssueFields`, so this only guarantees it); `Computed`
  is currently unpopulated.

## 5. The two layouts

```
expanded (w-[640px])                          compact (w-72)
┌────────────────────────────────┐            ┌──────────────┐
│ [search                      ] │            │ [search     ] │
├────────────────────────────────┤            ├──────────────┤
│ IDENTITY            ← sticky   │            │ IDENTITY      │
│ Issue Key  Issue Type  Summary │            │ Issue Key     │
│ DERIVED                        │            │ Issue Type    │
│ Percent Complete               │            │ Summary       │
│ COMMON                         │            │ DERIVED       │
│ Assignee   Parent Key  Release │            │ …             │
├────────────────────────────────┤            ├──────────────┤
│                    ⇤ Collapse  │            │    ⇥ Expand   │
└────────────────────────────────┘            └──────────────┘
```

- Each group is a full-width band: a header, then that group's items in `grid grid-cols-3 gap-x-2`
  (expanded) or `flex flex-col` (compact — byte-identical to `SearchablePicker.tsx:85` today). Because
  each band is its own block, **a group can never continue on the previous group's line** — the
  requirement falls out of the structure rather than needing a rule. Tailwind's `grid-cols-3` already
  compiles to `repeat(3, minmax(0, 1fr))`, the value the design asked for.
- Cells need `min-w-0 truncate` (a grid item's `min-width` is `auto`) or long custom-field names blow the
  column out. Add `title={item.label}` so truncated text stays readable.

> ### ⚠ The group header must stay a `<span>`, and a direct child of the section `<div>`
>
> `TableReportControls.test.tsx:92-94` does `within(popover).getByText('Fields').closest('div')` and then
> clicks an option inside the result — so `.closest('div')` from the header has to land on the element
> that _also_ holds that group's options. Wrapping the header in its own `<div>` "for stickiness"
> silently breaks it. `position: sticky` works fine on `<span className="sticky top-0 z-10 block">`.
> Put `role="group"` on the section div, not on an inner wrapper, for the same reason.
>
> That test is brittle by accident but it is testing something real (two "Story Points" labels in
> different groups). Add `data-testid={`${prefix}-group`} data-group={section.group}` as well, so future
> work has a non-fragile selector to move to.

- `SearchablePicker.test.tsx:61-71` asserts group headings in **DOM order**. Sections must therefore stay
  in `groupOrder` DOM order — a per-group grid does this for free; hand-partitioning items into
  per-column `<div>`s would not. Another reason for the band layout over columns.
- Header styling: existing `text-xs font-semibold text-neutral-801` plus `sticky top-0 z-10 block
bg-white`. The opaque background and `z-10` are both load-bearing — without them rows scroll _over_
  the header rather than under it.
- Keep horizontal padding on the outer panel (`p-3`, as at `:74`) and off the scroll body, so the sticky
  white header spans the full scrollport with no sliver of content beside it.
- Scroll region: `relative max-h-[min(24rem,50vh)] overflow-y-auto`. `relative` makes it the options'
  `offsetParent` for the scroll math in § 6, which means the section and grid wrappers must stay
  statically positioned. The `50vh` clamp matters because § 8 forbids `shouldFitViewport`.
- Icons — one glyph per import, verified present and **not** deprecated:
  `@atlaskit/icon/core/grow-horizontal` (Expand), `@atlaskit/icon/core/shrink-horizontal` (Collapse),
  `@atlaskit/icon/utility/check-mark` (selected row). Do **not** use `@atlaskit/icon/core/collapse` —
  `core/collapse.js:16-17` deprecates it in favour of `shrink-horizontal`, so `expand`/`collapse` is a
  half-deprecated pair. Horizontal is also the honest semantics: it is the panel's _width_ that changes.
  New-style icons take a **required** `label`; pass `label=""` for presentational ones.
- Footer: `border-t border-neutral-301`, right-aligned real `<button>`, label "Expand"/"Collapse",
  `aria-label` "Expand field list"/"Collapse field list". Give it
  `onMouseDown={(e) => e.preventDefault()}` so clicking it does not steal focus off the search input —
  otherwise arrow keys stop working right after a toggle, and no ref-and-refocus dance is needed.
  No field counts and no total; the design is explicit about that.
- **Tell popper the panel resized.** Toggling 288px ↔ 640px moves the panel's edges and popper does not
  observe it. `content` receives `ContentProps.update` (`popup/dist/types/types.d.ts:19-23`); thread it in
  and `useEffect(() => { void repositionPopup(); }, [layout, sections.length, repositionPopup])`.

## 6. Keyboard navigation

`SearchablePicker` has none today; this is the accessibility gap the redesign closes. Follow
`useReportSearch.ts:52-68`'s shape — **the handler goes on the search input**, not the list, so the input
keeps focus and typing never breaks.

Put the grid math in a pure module with its own test. The model: _flat reading order is the source of
truth; visual rows are a derived view._ Because every group starts a new row, within a group the flat
order **is** the reading order, and group boundaries are just row boundaries.

```ts
/**
 * `counts` is the option count per visible group, in render order.
 *   buildRows([2, 4], 3) -> [[0,1], [2,3,4], [5]]
 *   buildRows([2, 4], 1) -> [[0],[1],[2],[3],[4],[5]]
 * Chunks per group rather than over the flat list, which is what stops a group continuing on
 * another group's row.
 */
export const buildRows = (counts: readonly number[], columns: number): number[][] => { … };

export const moveActiveIndex = (rows, positions, activeIndex, direction, optionCount): number => {
  if (optionCount === 0) return 0;
  // Left/Right are one step in reading order. Because every group starts at column 0, stepping off
  // the end of a row lands on the next row's first cell — and off the end of a group lands on that
  // group's successor — with no special cases.
  if (direction === 'left') return Math.max(activeIndex - 1, 0);
  if (direction === 'right') return Math.min(activeIndex + 1, optionCount - 1);
  // Up/Down move one visual row and keep the column, clamped to the target row's width so a ragged
  // last row (or a 1-item group) still catches the cursor.
  const position = positions.get(activeIndex);
  const targetRow = rows[position.row + (direction === 'down' ? 1 : -1)];
  if (!targetRow) return activeIndex;
  return targetRow[Math.min(position.col, targetRow.length - 1)];
};
```

With `columns === 1` (compact) every row holds one index, so Up/Down collapse to ±1 — exactly today's
behaviour and exactly `useReportSearch.ts:53-58`. **One code path, two layouts.** And because flat order
is layout-independent, toggling layout mid-navigation keeps the same option active, for free.

Wiring, in `usePickerKeyboard.ts`:

- `activeIndex` indexes the flattened visible list (`sections.flatMap(s => s.items)`), so headers are
  skipped for free. Precompute an `id → index` Map rather than `flat.indexOf(item)` per row — that is
  O(n²) over 180 fields.
- `ArrowDown`/`ArrowUp`: `preventDefault()`, then `moveActiveIndex`.
- `ArrowLeft`/`ArrowRight`: expanded only, **and only when the caret has nowhere left to go** — focus
  lives in the search input, so ←/→ belong to the caret first; they walk the grid only at a collapsed
  selection at position 0 / `value.length`. This is the bargain a browser autocomplete makes. Treat
  `selectionStart === null` as "at the boundary" (jsdom returns nothing measurable). If it proves fussy
  in review the fallback is `isGrid && search === ''` — do **not** always-intercept, which makes the
  search box impossible to edit.
- `Enter`: `preventDefault()`, select the active item (same path as a click). No-op at zero matches.
- Reset `activeIndex` to 0 on every query change, as `useReportSearch.ts:47-50` does, plus an effect
  clamping it when `optionCount` shrinks (a new query, or `excludeIds` changing while open).
- Sync `activeIndex` on row `onMouseEnter`, as `ViewReports.tsx:86` does.

> ### ⚠ Write no Escape handler, and above all no `stopPropagation()`
>
> `Popup` closes on Escape from a **`window` keydown listener** and refocuses the trigger itself
> (`use-close-manager.js:163-176`, `:179-186`). A `stopPropagation()` in a React handler on the input
> would stop the event ever reaching `window` — i.e. it would break the very close it was meant to scope.
>
> `@atlaskit/layering` is what keeps one Escape from also closing the dialog: `Modal` wraps in
> `<Layering isDisabled={false}>` (`modal-wrapper.js:147`) → level 1; `Popup` wraps its content in
> another, only while open (`popup.js:91-93`, `:128`) → level 2. `LevelProvider` pushes the top level to
> 2 (`layering-context.js:52-56`), so the modal's `useCloseOnEscapePress` (`modal-dialog.js:123`) bails
> on `isLayerDisabled()`. On unmount the level pop is deliberately deferred in a `setTimeout(…, 0)`
> (`layering-context.js:64-68`), so one Escape cannot cascade. Still **verify it by hand** — § 13.

**Scroll the active row into view by writing `container.scrollTop` — never `scrollIntoView()`**, which
scrolls every scrollable ancestor including the page and, inside a modal, drags the dialog. jsdom does
not implement it at all (nothing in `vitest.setup.ts` polyfills it), so a stray call throws in tests.

```ts
// offsetTop is relative to the offsetParent — the scroll container, because it is the only positioned
// ancestor. That invariant is why the section/grid wrappers stay static.
const headroom = header?.offsetHeight ?? 0; // the sticky header would cover a group's top row
const top = option.offsetTop;
const bottom = top + option.offsetHeight;
if (top - headroom < container.scrollTop) container.scrollTop = top - headroom;
else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
```

Depend on `[activeId, layout]` — 288px ↔ 640px reflows every row. In jsdom all three measurements are
`0`, so the effect is an inert no-op: it cannot crash a test, and no test can come to depend on a
measurement jsdom cannot produce. Real verification belongs in the story.

## 7. Accessibility

Add only what `@atlaskit/popup` does not already do. `triggerProps` already carries `aria-expanded`,
`aria-haspopup` and `aria-controls`, and the popup already focus-locks and returns focus to the trigger
(`shouldReturnFocus` defaults true, `popup.js:67-68`). **Do not hand-roll a focus trap.** Pass
``id={`${testIdPrefix}-popup`}`` so `aria-controls` is deterministic rather than generated
(`popup.js:88`) and can be asserted.

| Element               | Attributes                                                                                                                       | Source             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| trigger               | `role="combobox"`, `aria-haspopup="listbox"` from us; `ref`, `aria-expanded`, `aria-controls` from Popup                         | `popup.js:126-131` |
| search input          | `aria-label={placeholder}` (it has **no** accessible name today), `aria-controls`→listbox, `aria-activedescendant`→active option | new                |
| scroll body           | `role="listbox"`, `id`, `aria-label`                                                                                             | new                |
| section band          | `role="group"`, `aria-labelledby`→header span's id                                                                               | new                |
| grid / column wrapper | `role="presentation"`                                                                                                            | new                |
| option                | `role="option"`, `aria-selected`, `id`, `tabIndex={-1}`                                                                          | new                |

Rows stay `<button>`s so they remain clickable; `role="option"` overrides the implicit button role for
AT, and `tabIndex={-1}` cedes the cursor to `aria-activedescendant`.

**Two deviations to raise in review rather than bury.** (a) `role="listbox"` sits on the scrolling body,
not the outer panel — the panel also holds the search field and footer button, and a listbox may only own
options and groups, so putting it there would be invalid ARIA. (b) Strictly by APG, `combobox` belongs on
the **search input** (which owns focus, `aria-activedescendant` and `aria-controls`), not on the trigger
button; it is on the trigger as the design specified, with the input given `aria-controls` and
`aria-activedescendant` so arrow navigation is still announced.

---

## 8. Making the popover survive `@atlaskit/modal-dialog`

**This section supersedes the diagnosis in `ValueReportForm.tsx:50-56`.** Three findings, each verified
in `node_modules`:

**(a) The z-index defect is real and would be fixable.** `@atlaskit/popup`'s default `zIndex` is
`layers.layer()` = **400** (`@atlaskit/theme/dist/cjs/constants.js:105`, consumed at `popup.js:30,58`);
the modal portals at `layers.modal()` = **510** (`constants.js:111`, `modal-wrapper.js:150`). 400 < 510 —
exactly the documented symptom. `zIndex={9999}` does fix it: `popup.js:128` passes it to
`@atlaskit/portal`, whose `createContainer` sets it on the container div
(`portal-dom-utils.js:14-18`), and the shared parent is `display: flex` _specifically so each portal
forms a stacking context_ (`portal-dom-utils.js:38-40`).

**(b) But the portal path loses a second, unrecorded fight — with `react-focus-lock`.** The modal wraps
its children in `<FocusLock whiteList={allowListCallback}>` (`modal-wrapper.js:155-158`). In
`react-focus-lock/dist/cjs/Trap.js:126-141`, focus is moved back inside the lock's observed node whenever
`!focusInside(workingArea)` — and a portalled panel is outside that node. Atlaskit's `allowlistElements`
(`modal-wrapper.js:44-54`) returns `true` for everything except `[data-atlas-extension]`. So **focus is
yanked back into the modal the moment the panel's search field takes it.** This is why the two
react-select menus work — they portal but never take focus — and why a `Popup` with a search input would
not. It is invisible until you put a focusable input in the popover, which is exactly what this does.

**(c) Clipping is a non-issue, and provably so.** `strategy` defaults to `'fixed'`
(`@atlaskit/popper/dist/cjs/popper.js:50`), and popper's `getClippingParents` returns `[]` for a fixed
popper with no transformed ancestor (`@popperjs/core/lib/dom-utils/getClippingRect.js:36-49`,
`getOffsetParent.js:56-68`). The modal has no permanent transform: `positioner.js:78` applies
`transform: none` at `stackIndex === 0`, and `@atlaskit/motion` removes its entrance class once the
animation ends (`keyframes-motion.js:78-82`, `animationFillMode: 'backwards'` at `:98`). The original
"clipped by the modal's scroll container" observation was about react-select's `position: absolute`
inline menu under the old `ModalBody`, which `AddReportModal.tsx:36-41` has since removed anyway.

### The decision: `shouldRenderToParent`, not portal + `zIndex`

`shouldRenderToParent` renders the panel as a DOM sibling of the trigger _inside_ the modal (`popup.js:128`
skips the portal branch). That makes `focusInside(workingArea)` true, so the focus lock is a no-op, and
puts the panel inside the positioner's own stacking context (`positioner.js:31-38`:
`position: fixed; z-index: 510`) where the popup root's `z-index: 400` (`popper-wrapper.js:37`) beats its
`auto` siblings. **No `zIndex` is needed — and it is ignored under `shouldRenderToParent`, so passing it
would be actively misleading.** Table stays on the portal path, unchanged.

```tsx
placement="bottom-start"
fallbackPlacements={['bottom-end', 'top-start', 'top-end']}
shouldRenderToParent
role="dialog"
label="Choose a field"
// leave at defaults: boundary, rootBoundary ('viewport'), shouldFlip, shouldReturnFocus,
// autoFocus, strategy ('fixed')
// do NOT set: zIndex, shouldFitViewport, shouldDisableFocusLock, appearance
```

- `boundary` / `rootBoundary`: leave default. Popup only wires `boundary` into the **flip** modifier
  (`popper-wrapper.js:143-151`); `preventOverflow`'s boundary is hardcoded `clippingParents` in
  `@atlaskit/popper` (`popper.js:60-66`), which per (c) degenerates to the rootBoundary. My earlier
  instinct to pass `boundary={document.body}` was wrong — it would do nothing.
- `fallbackPlacements` is **required**, not optional: `flipVariations: false` is hardcoded in
  `@atlaskit/popper`'s `constantModifiers` (`popper.js:28-36`), so flip will never try `bottom-end`
  unless it is listed. It carries real weight — see the width arithmetic below.
- **Do not set `shouldFitViewport`.** It injects the `maxSize` modifier (`max-size.js:44-96`) which writes
  `max-height` on the popper root — and `shouldRenderToParent` _removes_ that root's `overflow: auto`
  (`popper-wrapper.js:74`: `!shouldRenderToParent && scrollableStyles`). A `max-height` with no scroller
  silently truncates the panel. Hence the `max-h-[min(24rem,50vh)]` on the panel's own scroll region in § 5.
- **Do not set `shouldDisableFocusLock`.** With `shouldRenderToParent` it enables close-on-Tab
  (`popper-wrapper.js:120`), so tabbing from the search field to the first option would close the panel.
- **Do not set `appearance="UNSAFE_modal-below-sm"`.** `vitest.setup.ts:4-12` mocks `matchMedia` with
  `matches: vi.fn()` — a **function, therefore truthy** — and `usePopupAppearance` does
  `useState(!!(mq?.matches))` (`use-appearance.js:26`). So `isSmallViewport` is `true` in every test:
  every jsdom test would take the fullscreen-sheet branch (`popper-wrapper.js:52-61,196-199`) and no
  browser would.
- `role="dialog"` + `label`: `popper-wrapper.js:120` computes `shouldDisableFocusTrap = role !== 'dialog'`.
  That only changes behaviour behind the `platform_dst_popup-disable-focuslock` flag, which resolves
  `false` here — functionally inert today, but it announces the panel correctly and preserves the focus
  trap if that flag ever flips. `role` without `label`/`titleId` would be an a11y regression, hence both.

### Panel width vs modal width — measure before building

`@atlaskit/modal-dialog`'s default is `medium` = **600px**
(`modal-dialog/dist/cjs/internal/constants.js:13,17`; `AddReportModal` passes no `width`). The expanded
panel is 640px, so it is _wider than the dialog it opens from_.

`grid-cols-[1.3fr_1fr_auto] gap-2` inside `px-6` of a 600px modal gives ~552px of content; minus a ~60px
Add button and two 8px gaps leaves ~476px for 2.3fr, so **the field trigger is ~207px wide with its left
edge ~301px into the modal**. A 640px panel at `bottom-start` therefore overflows the viewport by ~6px at
1280px and ~129px at 1024px. It is never clipped — `preventOverflow` is on unconditionally with
`padding: 5` (`popper.js:60-66`) and shifts along the main axis — but a shifted panel stops reading as
"anchored to this field".

**This is what `fallbackPlacements={['bottom-end', …]}` is for.** At 1024px the trigger's right edge is
~720px into the viewport, so a 640px panel right-aligned to it starts at ~80px and fits without shifting.
Flip should choose `bottom-end` before `preventOverflow` has to shift. **Confirm this by eye at 1440 /
1280 / 1024 in step 0's story before building the panel.** If it still reads badly, the two fallbacks
are `<Modal width="large">` (800px, `constants.js:8`) or a narrower expanded panel in the modal case only.

## 9. A trigger that reads as the select's sibling

This is the objection in `ValueReportForm.tsx:52-56` that no `Popup` prop answers: the Field control sits
immediately beside the Work-item `@atlaskit/select` in the same grid row.

Build a `FieldTrigger` in `ValueReportForm.tsx` and style it with **Tailwind arbitrary values wrapping the
select's own CSS variables** — not the Tailwind palette, and not `token()`.

- _Not the Tailwind palette_, because it almost works, which is the trap. `neutral.100` = `#7A869A` = N100 ✓,
  `neutral.200` = `#6B778C` = N200 ✓, `neutral.800` = `#172B4D` = N800 ✓, `blue.200` = `#4C9AFF` = B100 ✓
  — but `neutral.20` = `#F1F2F4` while the select's resting fill is N20 = `#F4F5F7` ✗. Four of five match,
  so it looks right until you look at the fill. And hardcoded hex cannot follow `--ds-*`, so the pair
  diverges under any non-default theme — and this app has one (spec/016-report-of-reports/008-theme).
- _Not `token()`_, because it emits the same `var(--ds-…, fallback)` string but only through a `style` prop
  or emotion, and mixing that into a Tailwind-classed component recreates exactly the specificity fight
  `ValueReportForm.tsx:130-133` already documents.

All values read from `node_modules/@atlaskit/select/dist/cjs/styles.js`:

| Property     | Select source                                      | Tailwind                                                                                                                                                                                                                   |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| height       | `:79` `minHeight: isCompact ? 32 : 40`             | `h-10`                                                                                                                                                                                                                     |
| border       | `:73-74`                                           | `border border-[var(--ds-border-input,#7A869A)]`                                                                                                                                                                           |
| radius       | `:72`                                              | `rounded-[var(--ds-border-radius-100,3px)]`                                                                                                                                                                                |
| background   | `:36`                                              | `bg-[var(--ds-background-input,#F4F5F7)]`                                                                                                                                                                                  |
| hover        | `:37`, `:93`                                       | `cursor-pointer hover:bg-[var(--ds-background-input-hovered,#EBECF0)]`                                                                                                                                                     |
| focus        | `:34,:36,:76-78` (`inset 0 0 0 1px <borderColor>`) | `focus-visible:border-[var(--ds-border-focused,#4C9AFF)] focus-visible:bg-[var(--ds-background-input-pressed,#FFFFFF)] focus-visible:shadow-[inset_0_0_0_1px_var(--ds-border-focused,#4C9AFF)] focus-visible:outline-none` |
| value text   | `:196`                                             | `text-[var(--ds-text,#172B4D)]`                                                                                                                                                                                            |
| placeholder  | `:189`                                             | `text-[var(--ds-text-subtlest,#6B778C)]`                                                                                                                                                                                   |
| font         | `:20`                                              | `text-sm font-normal leading-5`                                                                                                                                                                                            |
| padding      | `:104-107`, `:140-147`                             | `px-[6px] py-[2px]`                                                                                                                                                                                                        |
| caret colour | `:133`                                             | `text-[var(--ds-text-subtle,#42526E)]` on the icon span                                                                                                                                                                    |
| transition   | `:80`                                              | `transition-[background-color,border-color] duration-200 ease-in-out`                                                                                                                                                      |
| disabled     | `:40-43`                                           | `disabled:cursor-not-allowed disabled:border-[var(--ds-background-disabled,#F4F5F7)] disabled:bg-[var(--ds-background-disabled,#F4F5F7)] disabled:text-[var(--ds-text-disabled,#A5ADBA)]`                                  |

**Caret:** import the same module the select does —
`import ChevronDownIcon from '@atlaskit/icon/utility/migration/chevron-down'`
(`select/dist/cjs/components/indicators.js:12`, rendered at `:56-62` with `color="currentColor"`). That
guarantees an identical glyph at an identical size.

Use `h-10` and `truncate`, **not** `min-h-10` — the select never grows, so the trigger must not either,
or the pair can differ in height on a long field name.

**The label association survives with no test change.** `<label htmlFor="ror-value-field">`
(`ValueReportForm.tsx:162-169`) + `<button id="ror-value-field">` still resolves through
`getByLabelText('Field')`: `@testing-library/dom/dist/label-helpers.js:29-37` uses `element.labels`,
which `HTMLButtonElement` implements, and `:57`'s `formControlSelector` includes `button`. What does
**not** work is `getByRole('button', { name: 'Field' })` — a native `<label>` contributes nothing to a
button's accessible name.

## 10. `FieldSelect` → `FieldPicker`

Same props, same reason for existing (`useJiraIssueFields` is a `useSuspenseQuery`; ROR's only boundary is
`ReportOfReportsWrapper.tsx:34`, so without a nearer one, opening the modal blanks the whole document).
Three changes:

1. **Delete the regrouping `useMemo` (`:185-192`).** `buildFieldOptions` already returns
   `{id,label,group}[]` (`fieldCatalog.ts:20-24`) — exactly `PickerItem` — and `SearchablePicker` does its
   own grouping, ordering and empty-group dropping (`:52-63`) with identical `groupOrder` semantics.
   Pass `items={buildFieldOptions(fields)}` and `groupOrder={FIELD_GROUP_ORDER}`. Net deletion.
2. **Change `field` state from `SelectOption | null` to `FieldOption | null`.** `handleAdd` reads only
   `field.value` (`:81`) and `canAdd` only `field !== null` (`:76`); the trigger needs the label. Store the
   `FieldOption`, use `field.id`, and resolve the id in `onSelect` (`options.find(o => o.id === id)`).
   This deletes the `id`/`value` naming round-trip.
3. **Extract `FieldTrigger` so the Suspense fallback can render it.** This is the structural requirement:

```tsx
<Suspense fallback={<FieldTrigger label={null} isDisabled isLoading />}>
  <FieldPicker value={field} onChange={setField} />
</Suspense>
```

That preserves `ValueReportForm.tsx:119-123`'s property exactly — the fallback is the same control,
disabled and loading, in a byte-identically sized 40px box, so nothing moves when the catalog arrives.
Keep `id="ror-value-field"` on the fallback so `<label htmlFor>` is never dangling mid-suspense (no
duplicate-id risk: Suspense swaps them).

**Reset-on-add needs nothing new.** `handleAdd` (`:78-85`) already does `setField(null)`, and `field` is
the only source for the trigger's text. `SearchablePicker` owns `isOpen`/`search` internally and clears
them on select and close, so there is no picker state for `ValueReportForm` to reset.
`ValueReportForm.test.tsx:141-153` passes as written and is now a _stronger_ assertion —
`queryByText('Summary')` covers the trigger's own text, not just a closed react-select menu.

## 11. Focus, Escape and the surrounding modal

- **Escape with the panel open closes the panel only** — the layering chain in § 6.
- **Escape with the panel closed still closes the modal.** Unchanged.
- **`useReportSearch`'s ↑/↓/↵/Esc cannot fire while the panel is open**, and it is worth stating why,
  because it rests on a detail: they are a React `onKeyDown` on the reports search `<Textfield>`
  (`AddReportModal.tsx:128`, `useReportSearch.ts:52-68`), so they only see events whose React-tree path
  includes that input — and the panel is a sibling subtree, not a descendant. (React synthetic events
  _do_ propagate through `createPortal` along the React tree, so this would be a genuine conflict if the
  handler sat on an ancestor of `ValueReportForm`. It does not.) On top of that, `focus-trap` holds focus
  inside the panel (`use-focus-manager.js:47-59`).
- **Focus return** is `shouldReturnFocus`'s default (`popup.js:68`) → `focus-trap`'s
  `returnFocusOnDeactivate` puts focus back on the trigger, inside the modal. That is also what keeps
  `react-focus-lock` quiet on close.
- **Blanket click** closes the panel first (level 2 wins the outside-click guard,
  `use-close-manager.js:78-96`), then a second click closes the modal. Correct and standard, if mildly
  surprising.

## 12. `AddColumnButton` — inherits, two props added

```tsx
<SearchablePicker
  // …unchanged…
  layoutStorageKey="table-add-column-layout"
  unsortedGroups={['Common', 'Identity', 'Report Fields']}
/>
```

No `shouldRenderToParent` and no `role`/`label` — the toolbar is not inside a dialog, so it keeps the
portal path exactly as today. `testIdPrefix="table-add-column"`, `excludeIds={shownColumnIds}` and the
trigger are untouched, so `TableReportControls.tsx:334-340` and `handleAddColumn` (`:200`) do not change.

---

## Phases

Each leaves the suite green and commits separately.

0. **Fix `InAModal` first.** `ValueReportForm.stories.tsx:99-109` wraps the form in a plain `<div>` with
   `shadow-lg` — no stacking layer, no `react-focus-lock`, no `@atlaskit/layering`. Its docblock
   (`:94-97`) claims it is _the_ check for "both menus have to paint above a modal", so it will show a
   perfectly working popup while the real modal is broken — worse than having no story. Replace the
   wrapper with a real `<Modal>`. No production code; suite unaffected. **Also settle the § 8 width
   question here, by eye at 1440 / 1280 / 1024.**
1. **`picker-grid.ts` + its test.** Pure, no React, no portal. The only genuinely tricky logic, and
   cheapest to get right in isolation.
2. **`usePickerLayout.ts`** (with `parseLayout` exported) and `usePickerKeyboard.ts`.
3. **Add the new `Popup` passthrough props to `SearchablePicker`, all defaulted to today's behaviour.**
   `SearchablePicker.test.tsx` and `TableReportControls.test.tsx` pass **unchanged** — that is the proof
   the props are inert. Add one default-off / one explicit-on test.
4. **Extract `PickerPanel`, compact branch only.** Move `search`/`grouped` in from `:48-63` verbatim,
   render only the single-column layout, confirm all 7 existing picker tests _and_ the two
   `TableReportControls` tests still pass. **Commit on its own** — this is the checkpoint that protects
   the `.closest('div')` traversal, and if that breaks it should break here, in isolation.
5. **Expanded branch**: 3-column bands, sticky headers, footer toggle, `selectedId` check,
   `repositionPopup`. Table's `+ Add column` has the redesign at this point.
6. **`unsortedGroups`**, then the a11y roles and the scroll effect.
7. **Extract `FieldTrigger`, unused**, and add the `FieldTriggerStates` story. Converge the pixel values
   here, while a mismatch is still free.
8. **Swap `FieldSelect` → `FieldPicker`**: `FieldOption` state, delete the regrouping `useMemo`, point the
   Suspense fallback at `<FieldTrigger label={null} isDisabled isLoading />`, update `pickField`. The only
   step where the suite goes red first, and only via that one helper.
9. **Rewrite the two rejection docblocks** (`ValueReportForm.tsx:22-32` — `menuAboveModal` stays, the
   work-item select still needs it — and `:53-56`). Do not delete them; rewrite as "why it is right now,
   and what had to be true": `shouldRenderToParent` for the layer, `react-focus-lock`'s `whiteList` for
   the focus, the select's own tokens for the sibling read. Also `SearchablePicker.tsx:10-12`, whose
   `trigger` render-prop rationale now has a third reason (the Suspense fallback needs the trigger
   standalone).
10. **Remaining tests and stories.**

## Test impact

**Must stay green with no assertion changes:** `AddReportModal.test.tsx:158-163`
(`'leaves focus on the reports search'` — **the canary**; if `focus-trap` or `react-focus-lock` misbehave
on mount, this is what fails, so leave it verbatim), `fieldCatalog.test.ts`, and all 7 existing cases in
`SearchablePicker.test.tsx:39-111`.

Land-mines in the existing suites:

- **`TableReportControls.test.tsx:92-94`** — the `.closest('div')` traversal. See § 5. Highest-risk
  existing test in this change.
- `SearchablePicker.test.tsx:61-71` asserts heading DOM order; no new text may match
  `/^(Common|Report Fields|Fields|Ignored)$/` — "Expand"/"Collapse" don't.
- Sorting reorders anything depending on document order. The fixture is
  `Assignee / Story Points / Story Points / Hidden`, already alphabetical, so it should hold — verify
  rather than assume.
- Keep the `fireEvent`-not-`userEvent` rule (`:33-35`): the search field is in a popper portal that
  repositions on mount.
- Add `localStorage.clear()` in `beforeEach`/`afterEach` (the convention at `SelectCloud.test.tsx:56-63`)
  or a persisted `compact` leaks from one test into the next.

New cases:

- **`picker-grid.test.ts`** (pure, table-driven): `buildRows([2,4],3) === [[0,1],[2,3,4],[5]]`;
  `columns: 1` gives six single-index rows; empty groups skipped; Right off a row's end lands on the next
  row's column 0; Right off a _group's_ end lands on the next group's first option; Down from col 2 into a
  2-wide row clamps to col 1; Up on the first row and Down on the last are no-ops; `optionCount === 0`
  returns 0 for every direction.
- **`parseLayout`**: `''` → `'expanded'` without throwing (the missing-key case `useLocalStorage.ts:11`
  produces); `'"compact"'` → `'compact'`; `'"nonsense"'` and `'not json'` → `'expanded'`.
- **Layout**: defaults to expanded; the toggle flips `data-picker-layout` and the accessible name; with a
  key the choice survives close/reopen and writes `'"compact"'`; a pre-seeded key opens compact; garbage
  opens expanded; with **no** key nothing is written (`localStorage.length === 0`) and a fresh mount is
  expanded; two pickers with different keys do not share.
- **Keyboard**: ArrowDown/Up move `aria-activedescendant` and clamp at both ends; Enter selects the active
  id and closes; Enter with zero matches does nothing; a new query resets to the first match;
  ArrowRight/Left walk the grid with the caret at a boundary but are **ignored mid-text**
  (`setSelectionRange(2,2)` after typing) and ignored entirely in compact; `mouseEnter` sets active.
- **Escape** closes the popover and never calls `onSelect` — asserts we did _not_ swallow Popup's window
  handler.
- **Never calls `scrollIntoView`**: stub `Element.prototype.scrollIntoView = vi.fn()` (jsdom omits it
  entirely), arrow through the list, assert zero calls, restore in `afterEach`.
- **Structure**: trigger has `role="combobox"` / `aria-haspopup="listbox"`; `aria-expanded` flips;
  `aria-controls === 'picker-popup'` while open; scroll body is `role="listbox"`; options are
  `role="option"`; sections are `role="group"` with `aria-labelledby` matching their header's id;
  `selectedId` renders exactly one check and no `selectedId` renders none (guards `AddColumnButton`,
  which never passes one).
- **The fragile traversal, re-asserted in the picker's own file so it fails there first**:
  `within(popover).getByText('Fields').closest('div')` contains that group's option — in **both** layouts.
- `ValueReportForm.test.tsx` — one helper changes. `pickField` (`:64-67`):

  ```ts
  const pickField = (label: string) => {
    fireEvent.click(screen.getByLabelText('Field')); // was: keyDown ArrowDown
    fireEvent.click(within(screen.getByTestId('ror-field-popover')).getByText(label));
  };
  ```

  Add `within` to the `@testing-library/react` import at `:5`. The _locator_ does not change —
  `getByLabelText('Field')` keeps resolving to the `<button>` via `HTMLButtonElement.labels` (§ 9); only
  the interaction does. Scope the option click with `within`, because the trigger now renders the picked
  label too. `:94` and `:151` are unchanged; add a comment at `:94` noting it now proves the label
  association survived.

- New in `ValueReportForm.test.tsx`: trigger shows `Field` then the picked label; the popover closes on
  select; and **the Suspense fallback**, which nothing covers today even though it is the reason the split
  exists — needs a second render helper that lets the query actually suspend (a never-resolving
  `fetchJiraFields` on the `jira` stub at `:25-31`, skipping the module mock), asserting a disabled
  control carrying `id="ror-value-field"`.
- New in `AddReportModal.test.tsx` — **the single most valuable test in this change**, and the only
  automated check on the layering contract:

  ```ts
  await userEvent.click(screen.getByLabelText('Field'));
  expect(screen.getByTestId('ror-field-popover')).toBeInTheDocument();
  fireEvent.keyDown(screen.getByTestId('ror-field-search'), { key: 'Escape' });
  expect(screen.queryByTestId('ror-field-popover')).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  ```

  Honest caveat: jsdom can tell you Escape did not close the modal, **not** that the panel painted above
  it. Z-order is Storybook-only. And do not add an "↑/↓ still works in the reports search while the picker
  is open" test — with focus in the panel the input never receives the event, so it would only prove the
  harness. Say that in a comment instead.

**Not unit-testable in jsdom** — sticky headers, the 3-column grid, the scrollport, the scroll math, and
every z-order and pixel-parity claim. Those belong to the stories, deliberately.

## 13. Verification

```bash
npm test -- SearchablePicker picker-grid ValueReportForm AddReportModal TableReportControls
npm test          # full suite — the change touches a shared component
npm run typecheck
```

**Storybook — `npm run storybook` → http://localhost:6006. This is the real verification, not a
nice-to-have.** `vitest.setup.ts:16-38` says as much in its own comment; every test above is a proxy.

- New `SearchablePicker.stories.tsx`: a fixture of ~6 groups × 3–11 items so both layouts, the sticky
  headers, the ragged last row and the scrollport are visible. Plus a 180-field `Fields` group for scroll
  and scroll-into-view; a group with 1 item beside a group with 14 (the uneven case the band layout exists
  for); a `selectedId` story; and a very long label, to confirm truncation in a 3-column cell.
- New `FieldTriggerStates` in `ValueReportForm.stories.tsx`: the trigger beside a **real**
  `@atlaskit/select` in a `grid-cols-[1.3fr_1fr_auto]` row — resting / hover / focus / disabled+loading /
  long value. This is where the § 9 pixel values converge.
- New `FieldCatalogLoading`: drop the two `client.setQueryData` seeds (`:48-50`) and give `fetchJiraFields`
  a never-resolving promise, so the Suspense fallback is reviewable beside the work-item select. The
  no-layout-shift claim cannot be checked in jsdom.
- `ManyFields` in `AddReportModal.stories.tsx`: `mockFields` there has **three** entries (`:14-18`), far
  too few to exercise the panel's columns or scroll region. Seed 60.
- In the fixed `InAModal` and in `AddReportModal`, check: the panel paints **above** the dialog; it is not
  clipped while the reports list scrolls under it; focus lands in the panel's search and returns to the
  trigger on close; **one** Escape closes the panel and leaves the dialog open; and the trigger is
  indistinguishable from its sibling at 1440 / 1280 / 1024.

**In the real app** (needs Jira credentials — use the `launch-dev` agent): `npm run dev` →
http://localhost:5173.

- ROR document → add row → Add Report → Field. Against a real instance `Fields` is 180+ entries: confirm
  the 3-column grid makes it scannable, headers stick, and no custom-field name blows out a column.
- Confirm `Common` still leads with Summary / Status / Assignee — i.e. `unsortedGroups` works and the
  curated order survived.
- Table toolbar → `+ Add column`: same picker, expanded by default, `excludeIds` still hides shown
  columns, and expanding there does **not** change the modal's stored layout (separate keys).
- Reload and reopen: the layout choice persisted.

## Risks and known trade-offs

1. **Two rendering technologies in one row — the original rejection was right about this, and this plan
   does not eliminate it, only manages it.** § 9 matches a Tailwind `<button>` to an emotion-styled
   react-select by copying `dist/cjs/styles.js` — a **private** file, not a public entry point. An
   `@atlaskit/select` minor bump drifts the pair silently and no test catches it.
   `ValueReportForm.tsx:129-142` is already three paragraphs of this debt for _one button height_; this
   adds ~14 coupled values. The only mitigation that works is keeping `FieldTriggerStates` (with the real
   select in it) and looking at it — a recurring cost, not a one-time one.
2. **`shouldRenderToParent` is safe only while nothing in the modal's ancestry has a transform.** True
   today (`positioner.js:78`, `keyframes-motion.js:78-82`) — false the moment someone adds a CSS
   transition to the modal, or **stacks a second modal**: `stackIndex > 0` applies
   `transform: translateY(...)` (`positioner.js:76-77`), at which point the panel is positioned relative to
   the modal _and clipped by it_. ROR has `DeleteConfirm.tsx` in the same island. **Confirm a second modal
   cannot be open alongside Add Report.** If it can, use the portal path plus `data-no-focus-lock` on the
   panel (`focus-lock/dist/es2015/constants.js:13`, consumed by `focusIsHidden.js`) or
   `focusLockAllowlist={(el) => !el.closest('[data-ror-field-picker]')}` on `<Modal>`.
3. **`platform_dst_popup-disable-focuslock` is a time bomb.** Every focus conclusion above depends on
   `fg()` returning `false` (`@atlaskit/platform-feature-flags/dist/cjs/index.js:32-34`; no resolver
   installed). `@atlaskit/popup` has two entirely separate focus code paths behind it
   (`use-focus-manager.js:31-46` vs `:47-59`; `use-close-manager.js:108-176`). One
   `setBooleanFeatureFlagResolver` call anywhere in this app, or a default flip in a version bump, changes
   popup-in-modal focus wholesale. Name the flag in a comment where it matters.
4. **Sharing becomes _conditional_ sharing.** After this, `SearchablePicker` has a portal path (Table) and
   an inline path (ROR) differing in focus, stacking, and whether the root scrolls
   (`popper-wrapper.js:74`), and four of its props exist for one caller. That is the beginning of the drift
   the extraction was meant to prevent. If a third divergence appears, the honest move is two components
   over a shared `<PickerList>` body.

## Alternative considered and rejected

**Keep the `@atlaskit/select` and override only its `Menu`:** `components={{ Menu: FieldPanel }}`
(`@atlaskit/select` re-exports react-select's `components`, `dist/types/index.d.ts:1`). The control stays
_literally_ an Atlaskit select — 40px, correct tokens, correct focus ring, correct label association, no
trigger to design and no private values to keep in sync — and `menuPortalTarget` + `zIndex: 9999` is
already **proven** in this exact modal (`ValueReportForm.tsx:30-32`). It removes risks 1 and 2 outright.

Rejected because the panel would live inside react-select's state machine, where **a search field inside
the menu fights react-select's own input for focus** — and an always-visible search input in both layouts
is a locked requirement of this design. It also is not shared with Table, which loses the "one control,
not two that drift" goal that `SearchablePicker.tsx:4-8` exists to serve.

Worth revisiting **only** if the search field is ever dropped from the design (i.e. if the columns are
judged to replace searching). In that world this option is strictly better.

## Out of scope

- Column reordering and removal — stays in `ColumnHeaderMenu.tsx`. No "Manage columns" modal.
- Multi-select mode (checkboxes, chips, footer Add button, selected count).
- Any change to which fields or groups either catalog offers, including restoring the commented-out
  `Status Update` derived option (`fieldCatalog.ts:36-46`).
- Virtualization. 180 rows of plain DOM is fine; revisit only if profiling shows jank.
- Search debouncing — both catalogs are already in memory, so there is nothing to debounce.
