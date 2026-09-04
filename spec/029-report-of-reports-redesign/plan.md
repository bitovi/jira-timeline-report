# 029 — Report of Reports hierarchy styling

Restyle the Report of Reports tree (sections containing nested sections or reports, up to 4 levels).
Structure and collapse behaviour stay as they are — this is a styling/spacing change only.

## Context

The document (`src/react/reports/ReportOfReports/`) nests sections up to `MAX_SECTION_DEPTH = 3`
(`model/sections.ts:533`), with reports as a fourth, leaf level. Today every level renders
identically: `IndentLevel.tsx` puts the same `border-l border-neutral-201 pl-[21px]` rail on _every_
section's children container, and `SectionTitle.tsx`'s `headingFor()` only has two visual steps
(`depth <= 1` vs `depth >= 2`). Three sibling sections read as one undifferentiated block, and a
level-3 section is visually indistinguishable from a level-4 report. This pass gives each of the four
levels a distinct, single accent, without touching the data model, collapse/hover/pin state, or edit
controls.

### Decided with the user

**Font-family stays theme-driven, not hard-pinned.** An earlier draft of this spec called for pinning
Poppins (levels 1–2) and Inter (level 3 / reports — not currently loaded anywhere in this app).
`SectionTitle.tsx` deliberately does _not_ fix a font family today — a comment there explains it was
reverted from a Poppins pin specifically so headings follow the report's theme font (`--font-sans` /
`.report-font-scope`) instead of overriding it. Keep that behavior: depth is carried by size, weight,
letter-spacing, and color only. No font-family column, and no new font load.

## The model: one accent per level type

Each level is marked by a **different kind** of accent, not by more of the same:

1. **Top-level section** → a card (elevation).
2. **Its direct child sections** → each gets its own left rail segment.
3. **Everything deeper** → heading only. No rail, no box.

Nothing nests a bordered or filled box inside another box. **Indent and size are a function of level
only, never of node kind** — a section and a report at the same level get the identical indent and the
identical size (§6, superseding an earlier rule that indented reports relative to their parent instead).
Only weight, colour, and letter-spacing are allowed to vary by kind (section vs. report); depth is
carried by indent and the type scale together (§4).

Do not set the section background colour — `.color-bg-section` / `--section-color` already owns it
and is themeable. No nested element gets its own fill.

## Key structural change

`depth = path.length` is already computed and passed to `SectionTitle` (`depth={path.length}` at
`ReportOfReports.tsx:237`), but nothing else reads it yet. Two things need it that don't have it:

- **Report row titles** need the depth-based size split (§4 below) — thread `path.length` (or an
  `isTopLevel` bool) into `SavedReportView`, `InlineReportView`, `InlineValueView`, `CommentRow`
  (`CommentReport.tsx`), and `UnknownView`.
- **The rail** needs to move off the parent. Today `IndentLevel.tsx` puts one rail on a section's
  _children container_, shared by every sibling at that depth — which is exactly why three siblings
  currently read as one block. It needs to belong to each level-2 section's own wrapper instead, so it
  starts at that section's title and stops after its own last child.

`IndentLevel` is only consumed by `SectionView` in `ReportOfReports.tsx` (plus `NodeRow.stories.tsx`).
Replace it with depth-conditional layout inline in `SectionView`:

- depth 1 (rendering its own children): plain `flex flex-col gap-[34px]`, no rail.
- depth-2 section (the wrapper around that section's row + children): `pl-4 border-l-2
border-[#DFE2E2]` on itself — **no `border-radius`**. A radius on a `border-l` bends the corners of
  what has to read as one continuous straight line; a rounded corner there was tried and looked wrong.
  `pl-4` (16px) is this level's own indent contribution under §6's level-driven scale, not a rail-specific
  value.
- depth-3+ section: `pl-4 mt-[10px]` — the indent is no longer dropped past level 2 (see §6); any report,
  at any depth, gets the same flat `pl-4` its own level contributes, nothing extra.

Delete `IndentLevel.tsx` once nothing calls it, and update or remove its story.

## 1. Top-level section card

- `border-radius: 16px; overflow: hidden;`
- `box-shadow: 0 1px 2px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.10);`
- No border. Elevation alone does the containment, so it still reads as a section if the theme fill is white.
- Sibling cards: `flex` column, `gap: 20px`. Never margins on the cards.
- Card body (holds the children): `padding: 0 24px 22px 32px;`

## 2. Rails — one segment per child section

The rail belongs to **each** level-2 section, not to their shared parent. This is important: a single rail
spanning all of them makes three sections read as one block.

- The card body is a `flex` column with `gap: 34px`, and has **no** rail of its own.
- Each level-2 section wrapper: `padding-left: 16px; border-left: 2px solid #DFE2E2;` — no
  `border-radius` on this wrapper; the left border has to read as one straight line down the section,
  and a radius bends its corners where the border starts and ends. The `16px` is not a rail-specific
  number — it's this level's own indent contribution under §6's level-driven scale; the rail is a second,
  independent accent riding along on the same wrapper.
- Result: the rail starts at that section's title, stops after its last child, and 34px of clear air
  separates one segment from the next.
- **Reports never get a rail** — the rail means "these items are inside this section", so its absence
  marks a leaf. (Unchanged by §6: a report at level 2 gets the same `16px` indent an L2 section gets,
  just without the `border-left`.)
- **Levels 3+ get no rail** — the rail is L2-only, a section-specific accent. But per §6, every level
  past 1 — section or report — still adds its own `16px` of indent on top of its ancestors', so an L3
  node is not flush with its L2 parent; it's one step in. See §6 for why the earlier "sections stay
  flush past L2" rule was wrong and got reverted.

## 3. Header rows (every level is clickable)

- Top level: `display:flex; align-items:center; gap:10px; padding:16px 24px; cursor:pointer;`
- Nested: `display:flex; align-items:center; gap:9px; padding:5px 8px; margin-left:-8px; border-radius:8px; cursor:pointer;`
  (the negative margin lets the hover tint bleed slightly left of the title without moving the text)
- Hover: tint the whole row one step deeper than the section fill. The row is the hit target, not just the title.
- The **title is the first child and starts flush on its indent** — nothing sits to its left.
- The caret is the **last child, right-aligned**: `text-[#687879]`, `font-size:12px; flex:none`.
  Swap the icon component for state; do not rotate with a transform. This app has no Phosphor icon set —
  it already uses `@atlaskit/icon`'s `ChevronDownIcon` / `ChevronRightIcon` in `CollapseToggle.tsx`,
  already swapped rather than rotated, so only the color needs to change.
- Titles render exactly as the user typed them. No `text-transform`, no case rules anywhere.

Both row variants live in `NodeRow.tsx` (currently one fixed `min-h-10 px-2` for every depth) and
`SectionView` picks which one applies.

## 4. Title scale — size is level-driven, kind only changes weight/colour/tracking

**Superseded:** an earlier version of this section made size and tracking a joint function of depth
_and_ a hard-coded "is this a report" step (`13px` for a report exactly one level under a top-level
card, `12.5px` everywhere else). That's gone. See §6 for why, and for the `depth === 2 → 13px` special
case that's now just "level 2 → 17px, same as a section."

Size is a function of **level only** — a section and a report at the same level get the identical size.
Weight, colour, and tracking are a function of **kind only** — constant across every level for that
kind, never varying by depth:

| Level                  | Size   |
| ---------------------- | ------ |
| L1 (top-level section) | 20px   |
| L2                     | 17px   |
| L3                     | 13.5px |
| L4                     | 12.5px |

| Kind               | Weight | Colour                                                    | Tracking   |
| ------------------ | ------ | --------------------------------------------------------- | ---------- |
| Section            | 700    | themeable per level (§10) — `#002A2D`/`#00464A`/`#04646A` | —          |
| Report (any level) | 600    | themeable, one colour for every level (§10) — `#4C5B5C`   | `+0.045em` |

- **Superseded by §10:** this section originally fixed the section colour to a single constant
  (`#00646A`, teal-700) at every level, on the reasoning that depth should be carried by size alone. §10
  makes L1/L2/L3 Section Text independently themeable instead, defaulting to a dark-to-teal progression
  (`#002A2D` → `#00464A` → `#04646A`) that itself reads as depth — so weight is still constant across
  every level, but colour is no longer. (`#00848B`, the theme's usual teal, still fails the contrast
  floor at these sizes for any of the three — rule 7.)
- A report is tracked out and a single muted colour (`--report-title-text-color`, defaulting to
  `#4C5B5C`) at every level, including one hanging directly off the L1 card — a level-2 report reads at
  17px, the same size as an L2 section, not a fixed small report size. The tracking is what still reads
  as "a label, not a heading" and keeps it visually distinct from a section at the same level, without
  touching the case of user-entered text.
- Implemented as one shared scale (`levelFontSizeClassName` in `NodeRow.tsx`) that both
  `SectionTitle.tsx`'s `headingFor()` and `reportTitleClassName` (used by every report-row title —
  `SavedReportView`, `InlineReportView`, `InlineValueView`, `CommentRow`, `UnknownView`) build on, so the
  two scales can't drift apart by construction. Node kind may only add `font-weight`, `color`, and
  `letter-spacing` on top of that shared size — never re-derive the size itself from kind.

## 5. Report content

- Report body: `margin: 8px 0 0 0;` — flush under its own title, on the same indent as the title.
  (Today the inline status-update text is aligned to the page, breaking the link to its report title. It must
  sit on the report's own indent. In `ReportOfReports.tsx`, the `pb-2` wrapper around `CommentBody`
  becomes `mt-2` instead.)
- Tables: `width:100%; border-collapse:collapse;`
  - `th`: `padding:8px 12px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#687879; border-bottom:1px solid #DFE2E2; text-align:left;`
  - `td`: `padding:10px 12px; font-size:13px; color:#023538; border-bottom:1px solid #DFE2E2;`
  - **No margin below the table.** All vertical spacing between siblings comes from the parent's flex `gap`.
    (The current oversized dead space after tables is a stacked margin — remove it, don't tune it.)
  - This is about an ADF table inside a status-update/comment body (rendered by `@atlaskit/renderer`'s
    `RichAdf`, via `CommentReport.tsx`) — not the separate, shared `TableReport.tsx` report type used
    elsewhere in the app (`Stats.tsx`, `TimeInStatus.tsx`, `FlowMetrics.tsx`, `IssueDebugModal.tsx`),
    which is out of scope here. Scope these rules to the status-update body only (e.g. a `data-testid`
    or wrapper class), following the existing scoped-`<style>` pattern already used in
    `TableReport.tsx:289-373` (`[data-testid="table-report"] table {...}`), so nothing leaks into that
    component's other consumers.
- Status update: `ul` with `padding-left:18px`, `display:flex; flex-direction:column; gap:6px;`,
  `font-size:13px; line-height:1.55; color:#023538;`
  This is `AdfDocument`'s `fallbackClassName` prose overrides in `CommentReport.tsx` (currently
  `prose prose-sm prose-neutral max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0`) —
  add the equivalent `prose-ul:`/`prose-p:`/`prose-li:` modifiers for the values above.
  Meta line ("Updated by … · date"): `margin-top:10px; font-size:11px; color:#4C5B5C;`
  Today this is two separate `<p>` lines (`Updated by: {author}` / `Last updated: {date}`) in
  `CommentBody` — combine into one line: `Updated by {author} · {date}`.
- Empty section: `font-size:12px; color:#4C5B5C;` "No reports in this section." in place of the child list.
  There is currently no such message in read/print/fullscreen view — `AddContentRow.tsx`'s "Nothing here
  yet." only exists inside the edit-only add-row (`report-chrome-hidden`, hidden in fullscreen and
  print). This is a new, always-visible note, rendered by `SectionView` when `node.children.length === 0`,
  separate from `AddContentRow`'s edit-time note.

## 6. Indent and size are driven by level, not by node kind (addendum, supersedes an earlier version of this section)

**Supersedes:** an earlier version of this section indented reports relative to their _parent's_ depth
(`paddingLeft = parentDepth < 1 ? 0 : 16 * max(1, parentDepth - 1)`), while §2/§4 kept sections flush
past L2 and gave them a level-varying colour (L1/L2 near-black, L3 teal). That combination was wrong: it
meant a section and a report that are both children of the _same_ parent — e.g. a "Delivery" section and
a "Summary" report both under "Q3 Planning" — rendered at **different indents and different sizes**,
which reads as parent/child rather than siblings. That rule (and its "no rail past L2, but reports still
get their own indent there" carve-out) is reverted; the paragraph below is what replaced it.

**Rule:** structural properties (indent, size) encode a node's _position in the tree_ — its level.
Cosmetic properties (weight, hue, tracking) encode what the node _is_ — section or report. A section and
a report at the same level get the identical indent and the identical size; only weight/colour/tracking
tell them apart, per §4's kind table.

| Level                                                                               | Indent added by that level | Size   |
| ----------------------------------------------------------------------------------- | -------------------------- | ------ |
| L1 (top-level section, or a bare report/value/comment sitting in the document root) | 0 (card padding only)      | 20px   |
| L2                                                                                  | 16px                       | 17px   |
| L3                                                                                  | 16px                       | 13.5px |
| L4                                                                                  | 16px                       | 12.5px |

A report hanging directly off the L1 card is a level-2 node: 17px, the same 16px indent an L2 section
gets (just without the rail, which stays L2-section-only per §2), grey/600/tracked rather than
teal/700 — no longer a fixed small report size regardless of level.

Implementation notes:

- **The indent is cumulative through nested wrappers, not an absolute offset computed per node.** Every
  wrapper past level 1 — section or report alike — adds a flat `padding-left: 16px` (Tailwind `pl-4`) to
  _itself_. Because a deeper node's wrapper is physically nested inside its ancestors' wrappers in the
  real DOM, the visual offset stacks for free: an L3 report sitting inside an L2 section's own `pl-4`
  reads at 32px total, the same total an L3 section reaches from that same parent. Nothing computes
  `16 * depth` or any other absolute formula — that's what produced a 48px L4 step where 32px was
  intended, under the old per-node-absolute-offset approach.
- Because the amount is now a flat, non-computed `16px` (not one of several depth-derived pixel values),
  it's a **plain Tailwind class** (`pl-4`) again, not the inline style the reverted rule needed —
  `levelIndentClassName(depth) = depth >= 2 ? 'pl-4' : ''` in `ReportOfReports.tsx`, used by both
  `sectionAccentClassName` (L2's rail wrapper, L3+'s wrapper) and every report/value/comment view's own
  wrapper (`SavedReportView`, `InlineReportView`, `InlineValueView`, `CommentReportView`, `UnknownView`).
- Size is likewise one shared function of level, `levelFontSizeClassName` (`NodeRow.tsx`) — see §4.
- Node kind may only change `font-weight`, `color`, and `letter-spacing`. If a change starts branching
  `font-size` or `padding-left` on section-vs-report, that's this bug coming back.
- Unchanged by this: the L1 card, the per-level-2 rail segments with 34px between them, and the chevron
  visibility rule (§7).

**Why 16px, not 20px (the old L2 rail's `pl-5`) or more:** the step now does structural work at up to
four levels inside one card, so anything larger reads as nesting depth for its own sake and pushes a
deep table off the useful content width. `16px` is also what let the L2 rail's own indent absorb into
the same flat per-level formula every other level uses, rather than staying a special-cased `20px`.

## 7. Chevron visible only when collapsed (or on row hover) (addendum)

A chevron on every header row at every level clutters the right edge, especially in a mostly-expanded
report where most of them convey nothing. The chevron earns its place only when it's telling you
something you can't already see:

- **Collapsed row** → chevron always visible. It is the only signal that content is hidden.
- **Expanded row** → chevron hidden, revealed on hover of the header row (or on pin, when pinning still
  existed — see §8, which retired it in favor of the row itself toggling collapse on click).

Chevrons are not removed entirely — without a persistent one on a collapsed row, a collapsed section
would be indistinguishable from an empty one whenever the cursor is elsewhere.

Implementation, in `CollapseToggle.tsx`:

- No new state. The condition is `isCollapsed || isRowActive`, where `isRowActive` is a new prop each
  of the four call sites (`SectionView`, `SavedReportView`, `InlineReportView`, `CommentReportView` in
  `ReportOfReports.tsx`) passes in as `rowProps.isHovered` — the same hover state `useNodeRow` already
  computes and `NodeControls` already reveals on, not a new signal. (Originally `rowProps.isHovered ||
rowProps.isPinned`, before §8 retired `isPinned`.)
- **Not** a CSS `:hover`/`group-hover` rule, deliberately: hover here is the row's own React state,
  because CSS `:hover` bubbles to every ancestor a nested row sits inside — the same reason
  `useNodeRow`'s hover tracking is JS-driven rather than CSS in the first place (see its doc comment in
  `DocumentEditing.tsx`). A `group-hover` caret would light up on every ancestor's row the pointer
  happens to be inside, not just the one it's actually on.
- `focus-visible:opacity-100` (plus `focus-visible:pointer-events-auto`) covers a caret reached by Tab
  directly, without a mouse.
- Opacity only — `transition-opacity duration-[120ms] ease-in-out` (`ease-in-out` is Tailwind's
  `cubic-bezier(0.4, 0, 0.2, 1)`) — and the caret is never unmounted or `hidden`, so the row never
  reflows as it appears or fades. `pointer-events-none` while hidden keeps an invisible caret from
  eating a click before hover has revealed it.

This depends on two things already true elsewhere in the document and not touched by this change:

1. The header row still tints on hover (`NodeRow`'s own `isHovered` background) — with no chevron
   showing at rest, that tint is the only remaining affordance saying an expanded row is clickable.
2. Every report/section still renders an explicit empty state when it has nothing to show (§5's "No
   reports in this section.", `CommentBody`'s "No updates found." / "No status update has been posted
   yet.", `MissingReportNote`, and whatever a given report type itself shows for zero results) —
   otherwise an empty expanded row and a collapsed row would look identical again, the exact ambiguity
   this rule exists to avoid.

## 8. Row click toggles collapse; editing moves to a pencil; pin retires (addendum)

Collapsing a row required landing precisely on the small caret button. The row itself is a much bigger,
more discoverable target for the same action — a standard pattern (file trees, accordions) — so:

- **Clicking anywhere on the header row now toggles its collapse**, not just the caret. The caret still
  exists and still works (§7 governs its visibility); clicking the row is an additional, larger hit
  target for the identical action.
- **Section titles no longer open for editing on a click of the bare text.** With the row itself meaning
  "toggle collapse," a title that also opened an editor on click would make the two affordances fight
  over the same gesture. Editing now starts from an explicit **pencil icon** beside the title — visible
  on row hover, matching the convention `NodeControls` already uses for its own reveal-on-hover cluster.
- **The click-pinned row ("selected") retires.** It existed as the touch-and-keyboard path to
  `NodeControls`' reorder/delete cluster when nothing was hovered. Keyboard already has an independent
  path (`focus-within`, CSS, unaffected by any of this); the accepted tradeoff is that a touch user, who
  has no hover, loses the click-to-reveal path to those controls specifically — tapping a row now
  collapses it instead of revealing its controls. This app is desktop/mouse-first, so that trade was
  judged acceptable rather than building a separate touch affordance for it.

Implementation:

- `useNodeRow`'s `rowProps.onClick` (`DocumentEditing.tsx`) changed from `pin(node.id)` to
  `toggleCollapsed(node.id)`. `isPinned`/`pin`, the `pinnedNodeId` state, and the Escape/outside-press
  `useEffect` that cleared it are all removed from `DocumentEditingProvider` — there is no pinned state
  left to hold. `NodeControls`' own reveal condition drops `isPinned(nodeId)`, keeping
  `isHovered(path) || isConfirmOpen`.
- **`NodeRow.tsx` stops a click on `controls` or `caret` from also bubbling up and firing the row's own
  handler a second time.** Before, the row's click handler was `pin` — idempotent, so a bubbled click
  from "Move Up" pinning the row again was harmless. Now that the row's handler is a _toggle_, the same
  bubble would flip collapse an extra, unwanted time (or — for the caret specifically — flip it right
  back, since the caret's own click already toggles it once). The fix: `controls` and `caret` render
  inside a `display: contents` wrapper carrying `onClick={(e) => e.stopPropagation()}`, invisible to
  layout so both stay direct flex children of the row exactly as before.
- `SectionTitle.tsx`'s read state no longer uses `@atlaskit/inline-edit` at all — its read view has no
  prop to suppress the click-to-edit trigger that ships baked into it (confirmed against the library's
  own source: a `Pressable` plus a `role="presentation"` click wrapper, neither call
  `stopPropagation`, and both always fire `onEdit`). Instead: a plain heading, plus a `RowButton`-based
  pencil (`@atlaskit/icon/core/edit`) that calls `onEdit` directly with its own `stopPropagation`,
  hover-revealed via a new `isRowHovered` prop (`SectionView` passes `rowProps.isHovered`) the same way
  `NodeControls` reveals its own cluster. `InlineEdit` is only ever mounted once editing has actually
  begun, with `isEditing` **hardcoded** `true` — so its read view (and the click trigger bundled with
  it) is never rendered at all; `editView`/`onConfirm`/`onCancel`/the Textfield are unchanged.
- The pencil keeps the _exact_ accessible name (`"{title}, edit"`) the old read-view trigger carried,
  so every existing test that finds "the thing that opens the title editor" by that name needed no
  change — only its two `it()` titles were reworded to say "pencil" instead of "the title."

Removed: the three tests asserting pin persisted a row's controls through an unhover, through the move
it was clicked to make, and cleared on Escape — none of that state exists anymore. Added: a row-click
toggles collapse the same as the caret; clicking a control (or the pencil) does not _also_ toggle
collapse as a side effect of its own click bubbling to the row.

## 9. Hover reveals the section you're in (addendum, supersedes §3's row hover)

Builds on §6's level-driven indent. Adds a hover affordance so the user can see which section a new
report or sub-section would be added to. Two signals, each at a different scope, so they don't compete:

- **Background tint on the section** → which container you're in.
- **Text darkens on the row** → which row you're on.

(The chevron reveal (§7) is a third, independent signal at the row scope — that a row is collapsible —
unaffected by this addendum.)

Only the **innermost** section responds — hovering a level-3 report or section drops its parent section
back to rest, so nested tints never show at once.

**An earlier version of this addendum drew the container signal as a ring + lift** (an inset box-shadow
plus elevation, teal-300, not themeable) instead of a background tint. That was reverted after review —
a plain background tint, matching the existing add-target tint's own mechanism, reads better and is
themeable (§10) — but its `sectionAccentClassName`-level plumbing turned out to be sound apart from the
ring itself, and is kept:

- The L2 rail is still an inset box-shadow (`shadow-[inset_2px_0_0_var(--section-border-color)]`) rather
  than a real `border-left` — a real border shaves layout space off the nested content it wraps, walking
  every deeper level's content a couple of pixels further in, and the box-shadow reads identically without
  that cost. **This is the rail this addendum keeps** — nothing about its resting appearance changed.
- The section-level hover state itself, `isContainerHovered(path)` (`DocumentEditingContext`,
  `DocumentEditing.tsx`), already answers "is this the innermost container the pointer is inside" —
  that's exactly "only the innermost section responds," so `SectionView` just reads it rather than
  introducing a parallel mechanism. No `data-sec` attribute or CSS `:has()` rule is needed for the same
  reason: this codebase already tracks hover as JS state driven by `onMouseOver` + `stopPropagation`
  (`useNodeRow`'s own doc comment explains why — nesting breaks a CSS `:hover`/`:has()` version the same
  way `group-hover` would).

**Superseded:** §3's "tint the whole row one step deeper than the section fill" is gone. `NodeRow` no
longer carries any hover background at all (`bg-neutral-201` removed from its className derivation) —
the row's only hover-driven change is its children's own text color, and the container-level tint lives
on the section wrapper instead (`SectionView`'s own `<section>` className, alongside the existing
add-target tint — the two are mutually exclusive in the same ternary, add-target winning if both are
somehow true at once).

**The tint** (`bg-[var(--section-hover-color)]`) applies at _every_ depth — L1 card, L2 rail, L3+ plain —
the same way the add-target tint already does, with no change to `sectionAccentClassName`'s own
depth-conditional card/rail/plain accent underneath it: the tint is a background layered on top, not a
frame that replaces the resting accent the way the reverted ring did.

**Row-level text darken, unchanged by the ring's reversion:**

- **Chevron** (`CollapseToggle.tsx`): darkens from `#687879` to `#002A2D` when `isRowActive`, on top of
  its existing opacity-based reveal-on-hover (§7) — two independent uses of the same boolean.
- **Section title** (`SectionTitle.tsx`'s `headingFor`): darkens to `#002A2D` when `isRowHovered`,
  overriding whatever the level's themeable color would otherwise be (§10).
- **Report title** (`reportTitleColorClassName` in `NodeRow.tsx`, shared by `SavedReportView`,
  `InlineReportView`, `CommentRow`, `InlineValue`): same darken, over the themeable
  `--report-title-text-color` at rest. Only applies to a title in its ordinary state — a missing report
  or a parse error keeps its own distinct muted color (`text-slate-500`) rather than taking this, since
  that color already means something more specific than "which row you're on."

## 10. Themeable rail border, heading text colors, and section hover tint (addendum)

The Theme panel's "Report of Reports" group (`src/jira/theme/fetcher.ts`) previously held one entry —
"Section" (the background). Six more now live beside it, all driven by the same
`getTheme`/`applyThemeToCssVars`/`ColorRow` plumbing §-8's original theme work built (a saved `{label,
backgroundColor}` pair, re-merged onto hardcoded css-var/description/group defaults on read — no schema
change was needed):

| Label             | Default   | CSS var                     | Consumed by                                   |
| ----------------- | --------- | --------------------------- | --------------------------------------------- |
| Border            | `#F5532D` | `--section-border-color`    | The L2 rail's resting `inset` box-shadow (§9) |
| Section Hover     | `#F4F5F5` | `--section-hover-color`     | The container-hover background tint (§9)      |
| L1 Section Text   | `#002A2D` | `--section-l1-text-color`   | `SectionTitle`'s `headingFor`, depth ≤ 1      |
| L2 Section Text   | `#00464A` | `--section-l2-text-color`   | `SectionTitle`'s `headingFor`, depth = 2      |
| L3 Section Text   | `#04646A` | `--section-l3-text-color`   | `SectionTitle`'s `headingFor`, depth ≥ 3      |
| Report Title Text | `#4C5B5C` | `--report-title-text-color` | `reportTitleColorClassName` (`NodeRow.tsx`)   |

The section background itself (the pre-existing "Section" entry) also picked up a new default alongside
these six, `#FBFCFC` (an almost-white, replacing plain `#FFFFFF`) — chosen together with the rest of this
palette rather than left over from before this addendum. "Border" moved off §2's original `#DFE2E2` too,
to `#F5532D` — the Bitovi brand orange (`--bitovi-red-orange` in `primitives.css`, kept as its own
independent, user-editable var rather than aliased to that one). The three section-text levels
deliberately do _not_ share one colour
the way an earlier draft of §4 had them — the dark-to-teal progression across L1→L2→L3 is itself a depth
cue, on top of size. Each row still gets a companion `textCssVar` (`--section-border-text-color`, etc.)
purely so `ColorRow`'s Lozenge preview has a readable label color on top of the swatch —
`applyThemeToCssVars` computes it the same way for every entry (APCA contrast against the picked color)
and nothing else reads it. The row-level hover darken (§9) is independent of "Section Hover" and isn't
itself themeable — hovering a row's text always reads as `#002A2D` regardless of what "Section Hover" or
any heading color is set to. (L1 Section Text's own resting default happens to be that same `#002A2D`,
so hovering an L1 section's own title is the one case where the darken is a no-op.)

**Deliberately out of scope:** the ADF status-update table's border color (§5, `COMMENT_TABLE_STYLES` in
`CommentReport.tsx`) is not wired to a theme entry — it's content styling rather than a section accent
this panel already governs.

## Rules to hold to

1. One accent per level type: card → rail → type only. Never nest a bordered or filled box inside another.
2. The rail belongs to each child section, never to their shared parent — it must break between
   siblings, and it must render as one straight line. Drawn as an inset box-shadow, never a real
   `border` or an `outline` (§9) — either takes layout space or draws outside the box, and a real border
   is what used to walk each nested level's chevron further left.
3. **Indent and size are driven by level, never by node kind** (§6) — a section and a report at the
   same level get the identical indent and identical size. Indentation does not stop at level 2; every
   level past 1 adds its own flat 16px, cumulatively, whether the node at that level is a section or a
   report. Only weight, colour, and letter-spacing may vary by kind.
4. The rail border, the section hover tint, and every heading's text color are themeable (§10, Theme
   panel → "Report of Reports"), defaulting to `#F5532D`, `#F4F5F5`, and (section text)
   `#002A2D`/`#00464A`/`#04646A` per level plus (report text) `#4C5B5C` — so "no colour on the rails" now
   means "no _hardcoded_ colour," not that a theme can't change it. Section weight stays constant across
   every level for a given theme (§4) — colour is now allowed to vary by level too, deliberately, as a
   second depth cue alongside size — and the row-level hover darken always overrides the theme with the
   fixed `#002A2D` (§9), the one state that isn't themeable.
5. Never change the case of user-entered titles.
6. Vertical rhythm is flex `gap` on the parent, never trailing margins on tables or blocks.
7. Contrast floor: any text or caret must be `#687879` or darker on a light section fill. (`#00848B` fails
   at these sizes; every themeable heading colour in §10's defaults is darker still.)
8. Full-width hit target on every header row — **text-only** hover on the row itself (§9): the title and
   chevron darken. The section a hovered row is in gets its own, separate background tint. Caret icon
   swap for state.
9. A caret is always visible while its row is collapsed; while expanded, it's hidden until the row is
   hovered (§7). It stays in layout (opacity only) at every state so the row never reflows.
10. Clicking anywhere on a header row toggles its collapse (§8); a click on `controls`, the caret, or
    the title's edit pencil must not _also_ trigger it via bubbling. Section titles open for editing
    only from that pencil, never from clicking the bare title text.
11. Only the innermost section tints on hover (§9) — `isContainerHovered(path)`, not a new mechanism.

## Files touched (for the implementation pass — not part of this planning step)

- `src/react/reports/ReportOfReports/ReportOfReports.tsx` — `SectionView` depth-conditional card/rail
  layout via `sectionAccentClassName` (now `pl-4`, not `pl-5`, and L3+ also carries `pl-4` rather than
  being flush); the shared `levelIndentClassName(depth)` (a plain `pl-4` Tailwind class, not the reverted
  rule's inline style) applied to every report/value/comment view's wrapper
  (`SavedReportView`/`InlineReportView`/`InlineValueView`/`CommentReportView`/`UnknownView`). §9 adds
  `isContainerHovered` to `SectionView`'s `isSectionHovered`, which the `<section>`'s own className
  ternary turns into `bg-[var(--section-hover-color)]` (mutually exclusive with the existing add-target
  `bg-blue-101`) — `sectionAccentClassName` itself is unchanged by this addendum beyond the earlier L2
  rail migration to an inset box-shadow. Also adds `reportTitleColorClassName` (plus a new `isRowHovered`
  prop threaded into `InlineValue`/`CommentRow`) at every report-title call site.
- `src/react/reports/ReportOfReports/components/SectionTitle.tsx` — `headingFor()` now builds on the
  shared `levelFontSizeClassName` scale, weight constant (`font-bold`) across every level. §9/§10:
  `headingFor(depth, isRowHovered)` and the new `sectionTextColorClassName` pick the level's themeable
  CSS var at rest, `#002A2D` while hovered.
- `src/react/reports/ReportOfReports/components/NodeRow.tsx` — top-level vs nested row padding/gap; now
  the home of both the shared `levelFontSizeClassName` (level-only size scale, §4/§6) and
  `reportTitleClassName` (that scale plus the report kind's weight/colour/tracking), so section and
  report titles can't drift onto different scales. §9: the `isHovered` prop and its `bg-neutral-201`
  background are removed entirely — the row draws no background at any hover state, container-level
  hover moved to `SectionView`'s own tint. Adds `reportTitleColorClassName(isRowHovered)`.
- `src/react/reports/ReportOfReports/components/InlineValue.tsx` — its field-name label takes the same
  report-title scale as every other report row's title. §9 adds an `isRowHovered` prop, applied via
  `reportTitleColorClassName`.
- `src/react/reports/ReportOfReports/components/IndentLevel.tsx` — retire; logic moves into `SectionView`.
- `src/react/reports/ReportOfReports/components/CollapseToggle.tsx` — caret colour; the §7 `isRowActive`
  reveal-on-hover opacity behavior. §9: `isRowActive` also darkens the caret to `#002A2D`.
- `src/react/reports/ReportOfReports/components/CommentReport.tsx` — meta line, prose list spacing,
  report-title scale, scoped ADF table styling. §9 adds `isRowHovered` to `CommentRowProps`, applied via
  `reportTitleColorClassName`.
- `src/react/reports/ReportOfReports/components/DocumentEditing.tsx` — §8: `useNodeRow`'s
  `rowProps.onClick` now toggles collapse instead of pinning; the whole pin subsystem (`isPinned`,
  `pin`, `pinnedNodeId`, its Escape/outside-press `useEffect`) is removed from
  `DocumentEditingProvider`/`DocumentEditingContextValue`. (§9 reads its existing
  `isContainerHovered` — unchanged by this addendum.)
- `src/react/reports/ReportOfReports/components/NodeControls.tsx` — §8: drops `isPinned(nodeId)` from
  its own reveal condition (and the now-unused `nodeId` prop).
- `src/react/reports/ReportOfReports/components/SectionTitle.tsx` (also §8) — read state stops using
  `@atlaskit/inline-edit` for its click trigger; adds the hover-revealed edit pencil; `InlineEdit` mounts
  only once editing has begun, with `isEditing` hardcoded `true`.
- `src/jira/theme/fetcher.ts` — §10: six new `defaultTheme` entries under `group: 'reportOfReports'`
  ("Border", "Section Hover", "L1/L2/L3 Section Text", "Report Title Text"); no schema change.
- `src/css/primitives.css` — §10: `--section-border-color`, `--section-hover-color`,
  `--section-l1/l2/l3-text-color`, `--report-title-text-color` defaults, alongside the existing
  `--section-color`/`--section-text-color`.
- `ReportOfReports.test.tsx`, `CommentReport.test.tsx`, `NodeRow.stories.tsx`,
  `CommentReport.stories.tsx`, `SectionTitle.stories.tsx` and any `IndentLevel` story — update for the
  removed component, the retired pin tests (§8), any assertions on the old rail classes or the old
  two-line "Updated by:" / "Last updated:" meta text, and (§9) the retired `NodeRow` `isHovered` prop.

## Verification (for the implementation pass)

- `ReportOfReports.test.tsx` keeps passing with no behavioral change — only update assertions that
  literally check removed classes (e.g. `IndentLevel`'s old rail classes) or the old two-line meta text.
- Build a 4-level-deep test document (root → section → section → section → report, plus one report
  directly under the root card) and confirm visually: card elevation at L1, a rail that breaks between
  L2 siblings with a straight (unrounded) left edge, no rail from L3 down, the four-step title scale,
  hover tint + full-row hit target, caret swap, combined "Updated by … · date" meta line, status-update
  list spacing, table styling with no dead space beneath it, "No reports in this section." for an empty
  section, and — per §6 — that a report and a section at the _same_ level line up on the identical left
  edge and the identical size (e.g. a report directly under the root card sits flush with, and at the
  same 17px size as, a sibling L2 section's title), while a level-3 node — report or section — sits one
  further 16px step in from its level-2 parent.
- Confirm fullscreen/print behaviour is unaffected — `report-chrome-hidden` and `.collapsed-content`
  semantics in `src/css/fullscreen.css` / `src/css/print.css` are untouched by this change.
- Per §7: a collapsed row's caret is visible with the cursor elsewhere; an expanded row's caret is
  invisible at rest, fades in on hover (mouse), and stays up once the caret itself is reached by Tab —
  in every case without the row reflowing.
- Per §8: clicking anywhere on a header row toggles its collapse, the same as clicking the caret;
  clicking a control button (Move Up/Down, Remove) or the title's edit pencil does not also toggle
  collapse as a side effect. A section's editor opens only from the pencil (hover-revealed), never from
  clicking the bare title text — clicking the rest of that row's title area collapses it instead.
- Per §9: hovering a report inside a nested section tints that section's own background (not its
  ancestors', and not a second tint on the report itself), while the row's own title and chevron darken
  to `#002A2D` and the row itself carries no background at any hover state. Moving from a report onto its
  section's own header row keeps that same section tinted; moving into a sibling section moves the tint,
  never leaving two sections tinted at once. Hovering the "Add Report"/"Add Section" button still shows
  the existing add-target tint, not the hover tint, even while the pointer is also inside that section.
- Per §10: changing "Border" in the Theme panel recolors the resting rail on a nested section (unaffected
  by hover); changing "Section Hover" recolors the container-hover tint from §9; changing any of "L1/L2/L3
  Section Text" or "Report Title Text" recolors that heading kind at rest, and hovering it still shows
  `#002A2D` regardless of what's picked. "Reset theme" restores all six new entries, and "Section" itself,
  to the defaults in §10's table — note "Section" changed too (`#FBFCFC`, not `#FFFFFF`), so a reset no
  longer reproduces the plain-white look this redesign shipped with before this addendum.
