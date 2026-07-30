# 016 — Report of Reports: 004-redesign

Rebuild the builder from stacked bordered cards into a flat, indented row list. Presentation and control
placement only — the data model and every capability stay as they are.

## Context

The builder currently renders every node as a bordered card: sections box their children from depth 2
down (`ReportOfReports.tsx:153`), each embedded report gets its own bordered card
(`ReportOfReports.tsx:232`), and every node shows three persistent control buttons plus a three-button
add row per container. On a document with a few sections that is a wall of nested boxes and ~20
permanently visible buttons competing with the actual charts.

This replaces nesting-by-box with nesting-by-indent: one surface card holding an indented row list, with
all controls hidden until you point at the node they act on. **No data model change and no capability
change** — `model/sections.ts` is untouched, and documents saved before or after this render identically.

Net effect: from 3 buttons per node + 3 add buttons per container, all persistent, down to zero controls
at rest and at most 4 on the node under the pointer.

### Decisions locked with the user

- **Every node keeps a title row; charts render beneath, not inside, the row.** A row is the
  collapsible/controllable unit. A `saved-report` node is a row (its saved name + controls) followed by
  its `ChildReport` chart as non-row content at the same indent:

  ```
  ▾ Q3 Planning                    (btns)
  │ ▾ Delivery                     (btns)
  │ │ Alpha                        (btns)
  │ │ ▓▓▓▓▓░░░  primary report (not a row)
  │ Beta                           (btns)
  │ ▓▓▓▓▓░░░  primary report (not a row)
  │ ▾ Risks                        (btns)
  ```

- **A report node's controls reveal on hover anywhere in that node** — header row _or_ its chart — not
  just the row.
- **Report titles are read-only.** Only section titles and value expressions are click-to-edit; a report
  row's title is the saved report's real name, and renaming belongs on the Saved Reports page. Report
  rows get no hover hit-area and no text cursor, so they never look editable.
- **"Add Value" is parked.** The add row goes back to two buttons (Add Section, Add Report). Existing
  `inline-report` nodes still render and still round-trip; they just can't be created from the UI.
- **"Selected row" == the click-pinned row** from §5 of the notes. One at a time, cleared by outside
  click or Escape. No selection model, no keyboard navigation.
- **Collapse state is ephemeral** (React state, lost on reload) — persisting it would be a schema change,
  which the notes rule out.

---

## The hazard that shapes the implementation

The notes specify controls at `opacity: 0; pointer-events: none`, revealed on hover. Implemented the
obvious Tailwind way (`opacity-0 group-hover:opacity-100`) **this breaks ~15 existing tests
irrecoverably**: jsdom does not evaluate `:hover`, so `group-hover:` never applies in a test, leaving
`pointer-events: none` permanently — and `@testing-library/user-event` v14 (`package.json`) throws
"unable to click element as it has or inherits pointer-events set to none". No test currently hovers
anything, so there is no existing escape hatch.

**So hover is React state, not CSS.** A single `hoveredPath` in context, set from `onMouseEnter` /
`onMouseLeave` on each node wrapper. `userEvent.hover()` fires real mouse events, so jsdom sees it and
the conditional class flips.

This also settles a correctness problem CSS would fight: §6 wants a section's Add row shown "while the
pointer is anywhere within that section", and §5 (per the user) wants a report's controls shown while the
pointer is anywhere in that node. Both are "is this node or a descendant hovered" — a path-prefix test,
not a nested-`group-hover` puzzle.

Cost: a context update per row crossing. A document holds tens of nodes, so this is fine — noted rather
than optimized.

## Three pieces of UI state, three different keys

| State           | Shape                             | Keyed by  | Why                                                                                                                  |
| --------------- | --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| Hover           | `hoveredPath: LayoutPath \| null` | path      | Prefix test answers "this node or a descendant". Transient, so path churn on reorder is harmless.                    |
| Pin / selection | `pinnedNodeId: string \| null`    | `node.id` | Must survive a move — pinning a row then clicking Move Up has to keep it pinned.                                     |
| Collapse        | `collapsedIds: Set<string>`       | `node.id` | Same reason, more so: keyed by path, collapsing a section then reordering its siblings would collapse the wrong one. |

All three go in the existing `components/DocumentEditing.tsx` context, which already holds per-node UI
state (`editingNodeId`, `pickerPath`) for exactly this reason.

**Collapsed children stay mounted, hidden with CSS.** Unmounting would remount `ChildReport` on expand,
refetching every chart from Jira — the node-identity constraint the earlier phases were built around. It
also lets print override the hide, so a collapsed section still prints in full; otherwise "collapse to
tidy up, then print" silently drops content. One rule in `src/css/print.css`, which already owns this
contract:

```css
.collapsed-content {
  display: none;
}
@media print {
  .collapsed-content {
    display: flex !important;
  }
}
```

## Tokens — everything below already exists

Verified against `tailwind.config.js` (Tailwind 3.4). No new tokens except one noted gap.

| Intent             | Class                                                 | Value / source                                                                                                  |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Surface card       | `bg-white border border-neutral-30 rounded shadow-sm` | House surface — `AutoScheduler.tsx:120`, `CriticalPath.tsx:146`                                                 |
| Row hover tint     | `bg-neutral-201`                                      | `#091E420F`, 6% black — matches `ColumnHeaderMenu.tsx:221`                                                      |
| Selected row       | `bg-blue-101` + `ring-1 ring-inset ring-blue-300`     | `#E9F2FF` / `#0065FF` ("this is what we use")                                                                   |
| Hairline rail      | `border-l border-neutral-201`                         | 6% black is the lightest neutral; `neutral-301` at 14% is the heavier border grey                               |
| Indent step        | `pl-[22px]` on a per-level wrapper                    | Wrappers nest, so each level gets its own rail for free — and the Add row "shares the same rail" as §6 asks     |
| Muted text / icons | `text-neutral-801`, `text-slate-500`                  | `#44546F`; both already in use here                                                                             |
| Display face       | `font-bitovipoppins`                                  | Poppins — the only non-default family defined                                                                   |
| Radius             | `rounded`                                             | Also `rounded-jirasm` (3px) if rows want tighter corners                                                        |
| Transition         | `transition-opacity duration-150`                     | No 120ms token exists; 150 is the nearest named one                                                             |
| **Danger tint**    | `hover:bg-red-500/10`                                 | **The one gap** — `red` has only `500` (`#BF2600`), no light variant, so the tint needs Tailwind's alpha syntax |

**Icons** — all five glyphs exist, but the carets are not where you would look. `@atlaskit/icon/core/`
has **no chevron at all**; they live in `glyph/`, which this codebase already uses:

- `@atlaskit/icon/glyph/chevron-down`, `.../chevron-right` — as `Accordion/AccordionTitle.tsx:4-5`
- `@atlaskit/icon/core/arrow-up`, `.../arrow-down`, `.../delete` — already in `NodeControls.tsx:6-8`
- `@atlaskit/icon/core/add` — the plus

**Delete confirmation** uses `@atlaskit/popup` (`^1.29.4`), following `ColumnHeaderMenu.tsx:9` — which is
also the house precedent for a hover-only trigger pinned open on click (`:219-223`).

---

## Phases

### Phase 1 — UI state in context

`components/DocumentEditing.tsx`: add the three fields above plus `isHovered(path)`, `isCollapsed(id)`,
`toggleCollapsed(id)`, `pin(id)`, `clearPin()`. Escape and outside-click clear the pin. Pure state, no
visual change yet — unit-testable on its own.

### Phase 2 — The row primitive

`components/NodeRow.tsx` (new), pure and prop-driven like `SectionTitle` and `InlineValue` before it:
two-column grid (title left, controls right), `min-h-10`, vertically centered, `rounded`, hover/selected
tints, and an optional leading caret slot that **only sections occupy** — reports and values reserve no
space, per §3. Takes `title`, `depth`, `caret`, `controls`, `isHovered`, `isPinned`, and mouse handlers.
Ships with `NodeRow.stories.tsx` covering rest / hover / pinned / collapsed / every depth.

`components/IndentLevel.tsx` (new): the `pl-[22px] border-l border-neutral-201` wrapper. Top level
renders without one, so top-level rows have no rail.

### Phase 3 — Controls

Rewrite `components/NodeControls.tsx`: the same three `IconButton`s with the same accessible names
(`Move X up` / `Move X down` / `Remove X` — unchanged, so 15 tests keep their selectors), now wrapped in
a hover/pin-gated cluster with a `border-l border-neutral-201` divider before Delete. Keeps
`print-hidden`. Delete becomes a `Popup` trigger — _Delete "Title"?_, or _Delete "Title" and everything
inside it?_ when `children?.length` — with a subtle Cancel and a `danger` Delete.

`canMoveNodeAt` (`model/sections.ts`) still drives the dimmed arrows; no model change.

### Phase 4 — Caret and collapse

`components/CollapseToggle.tsx` (new): the chevron button, `aria-expanded`, accessible name
`Collapse "Q3"` / `Expand "Q3"`. Collapsed sections wrap their descendants — Add row included — in
`.collapsed-content`.

### Phase 5 — Assemble

`ReportOfReports.tsx`: `Document` gets the outer surface card. `SectionView`, `InlineReportView`, and the
`saved-report`/`Card` branch all lose their borders and re-express as `NodeRow` + indented content.
`Card` disappears; `MissingReportCard.tsx` loses its dashed border and becomes a row plus a muted
explanation line. `SectionTitle`'s `headingFor` scale shifts to §4's hierarchy: top level in the display
face bold, nested sections and reports one step down semibold, values lighter.

`components/AddContentRow.tsx`: drop the Add Value button; restyle both survivors as borderless text
buttons with a leading `add` glyph and muted label, hovering to neutral fill + accent label. The root
pair is always visible and unindented; a section's pair sits as its last child one level deeper, gated on
`isHovered(sectionPath)`. An empty section swaps a muted "Nothing here yet." for the buttons in a
fixed-height slot so nothing shifts.

---

## Files

**New** — all under `src/react/reports/ReportOfReports/components/`

- `NodeRow.tsx` + `.stories.tsx`
- `IndentLevel.tsx`
- `CollapseToggle.tsx`
- `DeleteConfirm.tsx` (the `Popup`)

**Modified**

- `DocumentEditing.tsx` (three state fields), `NodeControls.tsx` (hover gate, divider, confirm popover)
- `ReportOfReports.tsx` (all four node branches; `Card` removed), `AddContentRow.tsx` (two buttons,
  restyled), `SectionTitle.tsx` (type scale, hover hit-area), `MissingReportCard.tsx`, `InlineValue.tsx`
  (value as a neutral pill after the label)
- `src/css/print.css` (the `.collapsed-content` rule)

**Deliberately unchanged:** `model/*` in its entirety — `sections.ts`, `expression.ts`, `resolveField.ts`,
`formatFieldValue.ts` — plus `ChildReport.tsx`, `AddReportModal.tsx`, `hooks/useInlineExpression.ts`, and
`ReportOfReportsWrapper.tsx`. No stored-format change, so this needs no migration.

## Test impact (`ReportOfReports.test.tsx`, 34 tests)

- **Every control test needs a hover first.** `clickControl` (`:132`) is the one shared helper — change it
  once to hover the button's enclosing `[data-node-row]` before clicking, and all 15 callers follow. Same
  for the section Add row helpers (`:339`, `:347`).
- **Three Add Value tests** (`:462`, `:470`, `:481`) lose their button. Rewrite the two that assert
  _rendering_ to seed an `inline-report` node via `storedValue` (already defined at `:415`) and edit it in
  place; delete `adds a blank value with its field already focused`, which tests only the button. The
  other six inline-value tests already seed nodes directly and are unaffected — this is what keeps the
  003-self-reports work from rotting while its button is parked.
- **`sectionFor` / `closest('section')`** (`:489`) depends on the `<section>` element surviving the
  card→row change. Keep sections rendering as `<section>`.
- **New coverage:** caret collapse hides descendants and the Add row; controls absent at rest and present
  on hover; a pin surviving a Move Up; Escape clearing the pin; delete confirm cancelling without
  removing; report rows not being editable.

## Verification

- `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- Storybook is the real design-review surface here — `NodeRow` stories cover rest/hover/pinned/collapsed
  and all depths with no Jira needed.
- In the app (needs Jira credentials, `npm start`): build a document three levels deep with a report and a
  value in it; confirm hovering a chart reveals _that_ report's controls; collapse a section and confirm
  its Add row hides with it; move a pinned row and confirm the pin follows; delete a section with children
  and read the confirm copy.
- **Print check:** collapse a section, then Download PDF — the collapsed content must still appear, and no
  controls or Add rows anywhere on the page.
- Regression: reorder/remove still work at depth 3 (`MAX_SECTION_DEPTH`), and a document saved before this
  change opens unchanged — a smoke test, not a migration test, since the stored format is untouched.

## Risks / caveats

- **Hover-only controls on touch.** §5's click-to-pin is the entire touch and keyboard path. If pinning is
  fiddly on a tablet, the fallback is a persistent cluster at `pointer: coarse`, not a redesign.
- **`pointer-events: none` and future tests.** State-driven hover keeps today's tests workable, but any
  _new_ test touching a control must hover first. Worth a comment in the test file.
- **Collapsed sections still fetch.** Keeping children mounted means a collapsed section's charts still
  load. That's the right trade against refetch-on-expand, but it means collapse is not a performance tool.
- **A 22px step at depth 3** plus the Add row one level deeper is ~88px of gutter. Fine on desktop; worth a
  look at the narrow container-query breakpoints the report area already uses.
- **Parking Add Value** leaves `expression.ts`, `resolveField.ts`, `useInlineExpression.ts`, and
  `formatFieldValue.ts` reachable only by hand-edited or previously-saved documents. Their unit tests keep
  them honest, but the feature is dark until a button comes back.
- **The delete confirm is new friction** on an action that was one click and is undoable-by-not-saving.
  Justified for a section with children; arguably noise for a single value.

## Out of scope

Drag and drop, cross-level moves, an overflow menu, a duplicate action, keyboard tree navigation,
persisted collapse state, and any change to what a document can contain.

---

## As built

All five phases shipped. `npm run typecheck`, `npm test` (1324 passing, 2 todo), `npm run build`, and
`npm run build-storybook` are all clean. `model/*` is untouched, as planned — the stored format did not
change. Where the code diverges from the plan above:

- **`RowButton.tsx` is a sixth new component, and Atlaskit's `IconButton` is gone from these rows.** The
  plan kept `IconButton`, but the notes specify the resting, hover, and disabled treatments precisely,
  including a danger tint `subtle` has no equivalent of. A plain `<button>` also spreads
  `@atlaskit/popup`'s `triggerProps` without fighting its types, which is how every other Popup trigger
  in the codebase is built (`ColumnHeaderMenu`, `AddColumnButton`). It forwards its ref for that. The
  accessible names are unchanged, so every existing selector still resolves.
- **Two `hover:bg-*` utilities can't share an element.** Tailwind resolves them by stylesheet order, not
  by the order they appear in `class`, so `RowButton` emits one complete string per tone rather than a
  base plus an override.
- **`MissingReportCard.tsx` was renamed to `MissingReportNote.tsx`** (with its story). It is no longer a
  card, and no longer holds a row — `SavedReportView` owns both branches of "the report exists or it
  doesn't", so the `data-testid="missing-report"` hook the test selects on sits on the node wrapper. What
  is left is the explanation line that renders where the chart would have been.
- **`hoverNode` has to bail out on an unchanged path.** `mouseover` fires for every element the pointer
  crosses, not every row — a chart is thousands of them — and the paths are rebuilt on each render, so
  reference equality can't do it. Without the comparison, crossing one Gantt re-renders the whole
  document per bar.
- **The collapsed wrapper carries the `hidden` attribute as well as the class.** The class (with
  `!important`, so it beats a Tailwind `display` utility) is what print overrides; the attribute is what
  hides the subtree where no stylesheet is loaded at all, which is what makes `toBeVisible()` a usable
  assertion under jsdom. The wrapper deliberately has no `display` utility of its own.
- **`SectionTitle` only `grow`s while editing.** The field wants the row's width, but the resting hit
  area has to end where the text ends: a full-width one swallows clicks on the rest of the row — which
  is what pins it — and turns "click the row" into "rename the section".
- **A collapsed section shows no item count.** §3 asks for a muted `N items` after the title. Built, then
  removed on request as noise: the caret already says the section is collapsed, and the number wasn't
  worth a second piece of text on the row.
- **There is no surface card.** §1 asks for the tree to sit in "one surface card with soft shadow", which
  is what shipped; removed on request. The document is now an unframed row list (`flex flex-col py-4`,
  what it was before the redesign), so the indent rails are the only structure on the page and the only
  borders belong to the embedded reports. The `NodeRow` stories dropped their card frame to match, since
  Storybook is the review surface and a framed story would misrepresent the real thing.
- **Accessible names for the caret are `Collapse Q3` / `Expand Q3`**, not `Collapse "Q3"` — house style
  (`Move Alpha up`, `Add Report to Q3`) doesn't quote. The quotes stay in the delete confirm's visible
  copy, which the notes specify literally.
- **The caret is persistent, not hover-only.** §7's "zero at rest" is about the control cluster: a
  collapsed section whose caret only appears on hover is indistinguishable at rest from an empty one.
- **The add row kept `Add Report` before `Add Section`.** §6 names them in the other order, but it's
  describing the pair, not an ordering, and an existing test asserts the current document order.
- **`InlineValue` lost its `controls` prop** (and its `WithControls` story). Controls belong to the row
  now, so a component that renders a row's _label_ has no business taking them.
- **A chart gets `pb-4`.** Rows sit flush against each other because they're a list; a chart is content,
  and butting the next row against it reads as a mistake.
- **Reports collapse too, which §3 rules out.** The notes give the caret to sections only ("reports and
  values have no caret and reserve no space"). Asked for afterwards, and right: a chart is most of what
  there is to scroll past, so collapsing one is worth more than collapsing a section. It cost nothing —
  `collapsedIds` was already keyed by `node.id`, so it works for any node type — and the chart hides the
  same way a section's children do (mounted, `hidden` + `.collapsed-content`, restored for print). The
  rule is now "a caret if there's content beneath the row", which leaves values and a missing report
  without one, still reserving no space.
- **The path-prefix hover test was wrong, and is gone.** The plan makes "is this node or a descendant
  hovered" the core primitive. In a nested document that reveals a control on _every ancestor_ the
  pointer is inside: hovering three levels deep lit up three add rows and three sets of row controls
  (reported from the browser). It was also unnecessary — `stopPropagation` already resolves hover to the
  innermost _node_, and a chart isn't a node, so pointing at one resolves to the report that owns it.
  Exact matching covers the case the prefix test was introduced for. What replaced it:
  - `isHovered(path)` is an equality test, so exactly one row is ever lit.
  - `isContainerHovered(path)` backs the add rows, which belong to a container rather than a node. The
    provider tracks the hovered container alongside the hovered node: a section's own row and indent
    gutter count as inside it, and anything else counts as inside its parent. So one add row shows —
    the innermost — plus the root's, which is always visible.
  - `useNodeRow` takes the node rather than its path and id, because only the node's `type` says
    whether it's a container.
- **The empty-section copy needs `pointer-events-none`.** §6 asks for the copy and the buttons to occupy
  the same fixed-height slot, which means positioning one of them — and a positioned element paints over
  its in-flow siblings whatever its opacity is. Shipped without it, the faded-out copy sat on top of the
  buttons it had just revealed and swallowed every click on an empty section: reported from the browser,
  invisible to jsdom (no stylesheet, no hit testing), and the reason the test for it asserts a class.
- **~120ms is `duration-150`** — no 120ms token exists, and adding one for a 30ms difference isn't worth
  a theme change.
- **`hover:bg-red-500/10` is the only new value**, as predicted: `red` has just `500`.

### Test impact, as it landed

46 tests in `ReportOfReports.test.tsx`, up from 34. One deleted (`adds a blank value with its field
already focused` — it tested only the parked button); two rewritten to seed an `inline-report` node
instead of creating one, keeping the 003-self-reports coverage alive while its button is parked.

The `pointer-events: none` hazard turned out to be **latent rather than live**: vitest runs jsdom with no
stylesheet loaded (`vite.config.ts`, `vitest.setup.ts`), so a Tailwind `pointer-events-none` class has no
computed effect and the existing 15 control tests would have passed either way. State-driven hover is
still the right answer — it's what makes "the pointer is anywhere in this node" a prefix test, and it's
what the new tests actually assert — but the tests are not what forced it. `clickControl` hovers the
enclosing `[data-node-row]` regardless, so they describe the real interaction and would survive a test
setup that did load CSS.

New coverage: controls hidden at rest and revealed on hover; hovering a report's _chart_ counting as its
row; a pin outliving the pointer and the move it was clicked to make; Escape dropping it; a section's add
row staying up while the pointer is on a node inside it; collapse hiding a section's descendants and its
add row, hiding a report's chart while leaving its row, restoring either without remounting, and following
its node through a move; a value and a missing report offering no caret; the delete confirm's cancel and
its "and everything inside it" copy; an empty section's resting copy; and a report row not being editable.

Two of those tests exist because of the nesting bug above, and both were checked against the broken
version rather than assumed: with the prefix test restored, `lights up only the row the pointer is on,
not its ancestors` and `offers to add only in the innermost container, however deep the pointer is` fail
and nothing else does.

`NodeControls` and `AddContentRow` publish `data-visible` alongside their opacity classes. Visibility is
an opacity change by design — the buttons stay focusable, which is the keyboard path — so there is nothing
for a DOM query to observe otherwise.

### Still open

- The credentialed walkthrough in **Verification** above, including the print check. Nothing here can be
  exercised against real Jira without `npm start` and credentials.
- Charts inside a collapsed section are `display: none` while hidden. Content is drawn before the collapse
  and the SVG survives it, but a resize observer that fires at zero width could redraw wrong — worth a
  look during the credentialed pass, and not something jsdom or Storybook can tell us.
