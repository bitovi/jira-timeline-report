# 016 — Report of Reports: nested sections

Sibling of [`../001-basic-layout-builder/plan.md`](../001-basic-layout-builder/plan.md), which shipped
Phases 0–4 and deliberately left sections as "schema-ready; UI later". This is that UI.

> **Status: built, phases 1–3.** `npm run typecheck`, `npm test` (1247 passing, 2 todo),
> `npm run build`, and `npm run build-storybook` are all clean. The 8-step end-to-end walkthrough
> under [Verification](#verification) is **not** done — it needs a real Jira instance, and it is
> where the persistence and print claims actually get tested. Nothing is committed.
>
> This document has been reconciled with what shipped; see
> [As built](#as-built--where-the-plan-was-wrong) for the six places the plan and the code diverged.

## Context

`report-of-reports` was a flat list: a document was a run of embedded saved reports plus an
"Add Report" button. The ticket asked for the grouping layer:

- An **"Add Section"** button beside the existing "Add Report" button.
- Sections carry an **editable title**, persisted in the saved report JSON.
- A user can add a section or a saved report **inside** a section, up to **3 levels** deep.

The point is documents that read like documents — "Q3 Planning" over three Gantts, "Risks" over two
scatter plots — rather than an undifferentiated stack. This was the last structural piece before
text and inline-field nodes become worth building.

**The groundwork was already in place, and that shaped the whole plan.** `001-basic-layout-builder`
built the tree nesting-first, so this ticket was almost entirely UI:

| Already worked with nesting                             | Where                                             |
| ------------------------------------------------------- | ------------------------------------------------- |
| `section` node type, with `params.title` and `children` | `model/sections.ts` — `StoredNode`, `SectionNode` |
| Recursive parse / serialize, lossless round trip        | `parseSections` / `toStoredSections`              |
| Appending into a container **at a path**                | `appendNode(nodes, node, path)`                   |
| Remove / move up / move down at any depth               | `removeNodeAt`, `moveNodeAt`, `canMoveNodeAt`     |
| Dirty flag reacting to a title change                   | `sameSections` compares serialized titles         |
| Recursive rendering                                     | `LayoutNodeView` — `ReportOfReports.tsx`          |

That held up: **no schema change, no data migration, and no change to `SaveReports.tsx`,
`useSelectedReport.ts`, `ReportLayoutProvider.tsx`, or `fetcher.ts`.** A section title saves and
reloads through the machinery that already existed.

### Decisions (locked with the user)

- **Depth means 3 nested sections.** The document root is not a level. A top-level section is
  level 1; sections nest to level 3. A level-3 section still accepts reports — it just can't hold
  another section.
- **A footer row per section.** Each section repeats `[ Add Report ] [ Add Section ]` at the bottom
  of its own content, matching the document-level row. Both rows are horizontally centred.
- **"Add Section" is hidden entirely at max depth.** A level-3 footer shows only "Add Report".
- **A new section is created blank and opens in edit mode**, title field focused. Left blank, the
  read view shows a muted "Untitled section" so there is still something to click.
- **Move / remove controls are out of scope.** `NodeControls` already handles section nodes at any
  depth; no new work on it. Cross-section moves and drag-and-drop stay out of scope (see
  Follow-ups — this is the sharpest known gap).
- **Every add button is `default` grey, at every level** — not a primary blue root button. A
  three-level document has four add rows, and four primary rows all shout at once. Atlaskit's
  `primary` marks _the_ action on a surface, and there isn't one here; these are tools.
- **The left rule and indent start at depth 2.** They mark a section as being _inside_ another one,
  so a top-level section gets neither and sits flush with the root's cards, which are its siblings.

---

## Phase 1 — Model: title edits and the depth cap

Pure functions in `src/react/reports/ReportOfReports/model/sections.ts`.

- **`MAX_SECTION_DEPTH = 3`** — one exported constant shared by the guard and its tests.
- **`setSectionTitleAt(nodes, path, title): LayoutNode[]`** — preserves the node's `id` **and its
  `children` array reference**. Same concern reorders had: a new id remounts the subtree, and a
  remounted `ChildReport` refetches from Jira. Returns the **same tree reference** when nothing
  changes — unresolvable path, a non-section node, or a title identical to the current one — which
  is what keeps a no-op inline-edit confirm from flipping the dirty flag.
- **`canAddSectionAt(nodes, path): boolean`** — `path` is the container being added into, the same
  path `appendNode` takes. `true` when `path.length < MAX_SECTION_DEPTH` **and** the path resolves
  to a section (or is `[]` for the root). Path length equals the container's section depth, since
  only sections have children, so the check really is that simple. Reuses the private `locate`.
- **`mapNodeAt(nodes, path, replace)` (private, new)** — one recursive "replace the node at this
  path" traversal, following the same-reference-when-unchanged convention `appendNode` /
  `removeNodeAt` / `moveNodeAt` established. `setSectionTitleAt` is three lines on top of it, and it
  is the natural home for the next node-mutating op.

Adding a _report_ needed no new function: `appendNode(sections, savedReportNode(id), path)` already
does it, and reports are allowed at every level.

**Tests — `model/sections.test.ts`, 57 → 73:**

- `setSectionTitleAt` — root section; at depth; a blank title accepted; preserves `id` and the
  `children` reference; same reference for a missing path / a `saved-report` target / an unchanged
  title; no mutation of the input.
- `canAddSectionAt` — a case table over a 3-deep fixture, in the style of the existing
  `canMoveNodeAt` cases.
- **Not** `MAX_SECTION_DEPTH === 3`, which proves nothing. Instead: append sections for as long as
  `canAddSectionAt` says yes, then assert the result is exactly three nested sections. That pins the
  guard to the ticket's wording rather than to its own constant.
- A stored document nested **deeper than 3** parses and round-trips intact, while `canAddSectionAt`
  returns false at its depth. The cap governs the creation affordance only; the reader stays
  tolerant, so a hand-edited or newer-client document renders rather than being silently clamped.

## Phase 2 — Editable section titles

- **`components/SectionTitle.tsx` (new) — pure and prop-driven.** Props: `title`, `depth`,
  `isEditing`, `onEdit`, `onConfirm(title)`, `onCancel`. No context, so it is directly
  unit-testable and storyable, the way `MissingReportCard` takes an injected `controls`.
  - Built on `@atlaskit/inline-edit` + `@atlaskit/textfield`, following
    `src/react/SaveReports/components/EditableTitle/EditableTitle.tsx` — including its
    `[&>form>div]:!m-0` margin reset and `autoFocus` on the edit view (that `autoFocus` is what
    delivers "opens in edit mode").
  - **It does not auto-save.** `EditableTitle` calls `updateReport` on confirm because the report
    _name_ is a live field. A section title is part of the document, so it follows the normal
    dirty → "Save report" flow like every other layout edit. Writing straight to Jira here would
    make one part of the document behave unlike the rest.
  - `readView` — a heading scaled by depth (`h2 text-lg` / `h3 text-base` / `h4 text-sm`) for a sane
    document outline. A blank title renders a muted italic "Untitled section"; `editButtonLabel`
    falls back to the same string so the edit affordance always has an accessible name.
- **`components/DocumentEditing.tsx` (new)** — a context **local to `ReportOfReports`** holding the
  document's transient editing state, none of which is document content: `editingSectionId` with
  `beginEditingSection(id)` / `endEditingSection()`, plus Phase 3's `pickerPath`.
  - Same reasoning `NodeControls` documents: read state at any depth instead of threading callbacks
    through a recursive renderer.
  - `ReportOfReports` mounts the provider itself, so **no test or caller has to mount anything new**.
- **`ReportOfReports.tsx`** — the section branch of `LayoutNodeView` became its own `SectionView`
  component. Hooks must be unconditional and `LayoutNodeView` early-returns per node type, so a
  dedicated component scopes the hook usage naturally. `SectionView` wires `SectionTitle` to
  `useReportLayout` (`setSections(setSectionTitleAt(...))`) and `useDocumentEditing`.
  - Nested sections (depth ≥ 2) carry `border-l-2 border-neutral-301 pl-4` — the same grey the cards
    use. The indent accumulates, so each level draws its own rule and a card's nesting can be read
    by counting rules to its left.
  - **No `print-avoid-break` on a section**, deliberately. A section can easily exceed a page, and
    `break-inside: avoid` on something page-sized is worse than nothing. It stays on cards only.

**Tests — `ReportOfReports.test.tsx`, 14 → 19:** clicking a title opens the field, focused;
confirming renders the new title; cancelling leaves it alone; a blank title renders a clickable
"Untitled section"; the edit does not remount the section's children (reusing the `mounts` probe).

## Phase 3 — Add Section and per-container Add Report

- **`components/AddContentRow.tsx` (new)** — the `[ Add Report ] [ Add Section ]` pair, carrying
  `print-hidden` (editing affordance, not content). Props: `path`, the container it adds into, and
  an optional `label` naming that container. Renders at the document root as `path={[]}` and at the
  bottom of every section as its own path — the same value `appendNode` and `canAddSectionAt` take.
  - "Add Section" renders only when `canAddSectionAt(sections, path)`.
  - Appends via `appendNode`, then calls `beginEditingSection(node.id)` on the freshly minted
    section so it opens in edit mode — otherwise the user has to hunt for an "Untitled section" to
    name the thing they just created.
- **Accessible names, and why they matter here.** A second "Add Report" button on the page makes
  `findByRole('button', { name: 'Add Report' })` ambiguous and would have **broken the seven
  existing tests** using the `addReport()` helper. Fixed the way the codebase already fixed it for
  `NodeControls`: individuate the names. Root keeps the bare `Add Report` / `Add Section`; in-section
  buttons get `` `Add Report to ${title || 'section'}` ``, mirroring `NodeControls`' convention.
- **The picker knows its target.** `pickerPath: LayoutPath | null` (`null` = closed) replaced
  `isPickerOpen: boolean`, and `handleSelect` appends at `pickerPath ?? []`. One modal instance for
  the whole document rather than one per footer.
  - **Gotcha:** `[]` is a valid path meaning "the document root", and `[]` is truthy in JS. The open
    check is `pickerPath !== null`, never a plain truthiness test.
- An empty section needs nothing extra — its footer row _is_ the affordance.

**Tests — `ReportOfReports.test.tsx`, 19 → 25:** "Add Section" renders beside "Add Report" at the
document level; clicking it adds a section with its field focused, and the title can be confirmed;
`Add Report to Q3` puts the card **inside** that section (asserted with `within(section)`, not
document order); `Add Section to Q3` nests a level; a level-3 footer has no "Add Section" but still
has its "Add Report". The seven pre-existing add/remove/move tests are untouched and green.

**Storybook (credential-free):** `SectionTitle` — `ReadView`, `Untitled`, `Editing`, `EveryDepth`
(the three heading sizes together), and `Interactive` (wired to local state the way a document wires
it, which also demonstrates that the component is pure).

---

## As built — where the plan was wrong

Six things the plan got wrong or didn't anticipate, recorded because they are the parts a reader
would otherwise trip over:

1. **Individuated labels went on `aria-label`, not the visible text.** Buttons read "Add Report"
   everywhere; only the accessible name becomes `Add Report to Q3`. Keeps three levels of footers
   from getting wordy, keeps the root query unambiguous, and satisfies WCAG 2.5.3 (Label in Name)
   because the accessible name starts with the visible label.
2. **InlineEdit names its read-view button `"Q3, edit"`, not `"Q3"`** — it appends its `editLabel`
   (default `'edit'`) for screen readers. Five tests failed on this first. The test file now has a
   `sectionTitle(title)` helper documenting the quirk in one place.
3. **`pickerPath` lives in the `DocumentEditing` context, not in `ReportOfReports` state.** That
   forced a split the plan didn't mention: `ReportOfReports` is now a thin wrapper mounting the
   provider around an inner `Document` component, because a component cannot consume a context it
   renders itself.
4. **All add buttons are `default` grey** (user's call), where the plan implied a primary blue root
   button. See Decisions.
5. **The left rule starts at depth 2** (user's call), where the plan said "depth ≥ 1".
6. **The planned `sameSections` title test already existed** at `sections.test.ts:176` — the plan's
   "nothing asserts it today" was simply wrong, so no duplicate was added.

Also worth knowing for future work: **`tsconfig.json` excludes `**/_.test.ts`but not`\*\*/_.test.tsx`.** That is why a missing `LayoutPath`import in`sections.test.ts` had gone
unnoticed (now fixed); it also means the component tests here _are_ typechecked.

## Files

**New**

- `src/react/reports/ReportOfReports/components/AddContentRow.tsx`
- `src/react/reports/ReportOfReports/components/SectionTitle.tsx` + `.stories.tsx`
- `src/react/reports/ReportOfReports/components/DocumentEditing.tsx`

**Modified**

- `src/react/reports/ReportOfReports/model/sections.ts` + `.test.ts`
- `src/react/reports/ReportOfReports/ReportOfReports.tsx` + `.test.tsx`

Nothing else in `src/` was touched. Prettier also reformatted two pre-existing spots in the files
above (`locate`'s signature, one long line in the test file).

**Deliberately unchanged** — worth stating, because a reviewer will look for them: the `StoredNode`
schema, `parseSections` / `toStoredSections`, `ReportLayoutProvider.tsx`, `SaveReports.tsx`,
`useSelectedReport.ts`, `src/jira/reports/fetcher.ts`, `NodeControls.tsx`, `PrintReportButton.tsx`.
No migration, and older documents keep loading.

## Verification

**Done:** `npm run typecheck`, `npm test` (1247 passing, 2 todo), `npm run build`,
`npm run build-storybook`.

**Outstanding — needs Jira credentials** (the `launch-dev` agent, or the user). This is where the
persistence and print claims get tested; unit tests cannot reach any of it:

1. Settings → Features, enable **Report of Reports**; switch the report type.
2. Add Section → confirm the title field is focused; type "Q3 Planning".
3. Inside it: Add Report, then Add Section → "Risks"; inside _that_, Add Section → level 3.
4. Confirm the level-3 footer offers **Add Report only**.
5. Save; reload from `?report=<id>`; confirm every title and the full nesting return.
6. Confirm the section titles are actually in the stored JSON, not just in memory.
7. Print the document — the add rows and node controls should be absent, the cards intact.
8. Regression: open a normal Gantt report and confirm nothing changed.

## Risks / caveats

- **Section titles are the first free text in a document.** `001-basic-layout-builder` flagged the
  ~32KB Jira description cap (all app data shares one blob on the web/dev builds); titles are small,
  but the caveat it deferred to "when text nodes land" now partly applies.
- **Heading order stays imperfect.** Sections scale `h2`/`h3`/`h4` by depth, but a card's title is a
  fixed `h3` and cards can sit at the root under no heading at all. Better than a flat wall of
  `h2`s, still not a clean outline. At level 3 the indent is doing nearly all the work, since
  `h4 text-sm` barely differs from a card's `h3 text-base`.
- **The nesting rules print.** `print-hidden` covers the add rows and `NodeControls`, but a
  section's left border and indent are structure, not chrome, so they survive into the printed
  document. Deliberate, but a decision — easy to hide if the printed output should be flat.
- **Two identically-titled (or two untitled) sections produce duplicate button labels.** Inherited
  from the `NodeControls` labelling convention, which has the same property and was accepted there.
- **A document nested deeper than 3 renders but cannot be extended.** Intentional — tolerant read,
  capped creation.

## Out of scope

- Moving a node between containers, and drag-and-drop. Confirmed out of scope by the user.
- Changes to the move / remove controls; they already work at depth.
- Grid / column options on a section's `params`.
- Collapsible sections, per-section page breaks, text and inline-field nodes.

## Follow-ups

- **There is no way to move an existing root-level report into a section** — a user has to remove it
  and re-add it inside. The most likely next request the moment sections ship, and the natural home
  for the drag-and-drop work already deferred once.
- A titled top-level section is now distinguished from the document root by heading size alone
  (`h2 text-lg` vs a card's `h3 text-base`). If that reads as too weak against a real document, a
  bottom border under the title row is cheaper than bringing the left rule back.
- Playwright coverage for `report-of-reports` is still blocked:
  `playwright/unauthenticated/report-switching.spec.ts` runs unauthenticated in sample-data mode
  while the report type is feature-flagged off by default, so it needs its own authenticated fixture.
- Two defects found earlier and still open, both predating this ticket: `timingCalculations` is
  corrupted on every save (serializes to `[object Object]`), and `routeData.serialize()` writes
  every param including defaults, which pushes saved reports toward the ~32KB ceiling.
