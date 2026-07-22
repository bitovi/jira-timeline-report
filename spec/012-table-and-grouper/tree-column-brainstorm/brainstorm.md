# Tree column & row-ordering brainstorm

Design exploration for three intertwined problems the user raised on the
**Table (beta)** report (`table2`, flag `tableReport`,
[`src/react/reports/TableReport/`](../../../src/react/reports/TableReport/)).
No code changes here — options + recommendations only.

> User's words:
> "It shouldn't be called 'Rows' for the sort vs hierarchy. We need something
> better than this. It's very confusing. Also, the indentation was to be on a
> single column with both the icon and the summary combined. (The summary should
> be a link, but not look like it until hovered.) Some options: a special 'Icon &
> Summary' column folks can add. It will have different sort options like
> 'hierarchy' where it will do the indentation and show the hierarchy, or
> 'summary' where it can just sort the summary."

---

## 1. Problem summary

Three coupled questions, grounded in the current code:

1. **The "Rows" control name is confusing.** The primary control bar exposes a
   single-select dropdown labelled **"Rows"** whose two values are **"Sort"** and
   **"Hierarchy"** — see the `ControlCell label="Rows"` +
   `SingleSelectDropdown` (`testId="table-row-ordering"`, options
   `{ Sort, Hierarchy }`) in
   [components/TableReportControls.tsx](../../../src/react/reports/TableReport/components/TableReportControls.tsx#L138-L151),
   persisted under route key `tableRowOrdering`. "Rows" reads as "which rows" or
   "row count", not "how rows are ordered/nested". The values are a category error
   too: "Sort" (a verb about column ordering) vs "Hierarchy" (a noun about tree
   nesting) aren't parallel.

2. **Icon, key, and summary are three separate columns; the user wants one
   combined tree column.** The catalog emits `issueKeyColumn()`, `summaryColumn()`,
   and `issueTypeColumn()` as **three distinct identity columns**
   ([model/fieldTypeRegistry.ts](../../../src/react/reports/TableReport/model/fieldTypeRegistry.ts#L92-L152)),
   and the default view shows all three separately
   (`DEFAULT_TABLE_COLUMNS = [identity:issueType, identity:key, identity:summary]`,
   [model/persistence.ts](../../../src/react/reports/TableReport/model/persistence.ts#L24-L29)).
   Only `summaryColumn()` carries `isTree: true`, so the indent + expand/collapse
   caret decoration lands on the summary cell alone
   ([model/columns.ts](../../../src/react/reports/TableReport/model/columns.ts#L86-L90);
   `isTreeCell = column.isTree && rowOrdering === 'hierarchy'` in
   [TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L800-L826)).
   The user wants a single **"Icon & Summary"** column that combines the type icon
   + (linked) summary + the indentation/caret, and — crucially — wants the choice
   between *hierarchy nesting* and *plain summary sort* to be a **property of that
   column** rather than a separate global control. This directly overlaps with
   problem 1: if hierarchy becomes a per-column sort mode, the global "Rows"
   toggle may disappear entirely.

3. **The summary should be a link that looks like plain text until hovered.**
   Today the summary renders as bare text (`render: (value) => value`,
   [fieldTypeRegistry.ts](../../../src/react/reports/TableReport/model/fieldTypeRegistry.ts#L112-L124))
   — the *issue key* column is the only link. The user wants the summary itself to
   be the hyperlink to the Jira issue, styled to look like normal text at rest and
   reveal the link affordance (underline/color) only on hover.

---

## 2. Current behavior

**Row ordering ("Rows").** `rowOrdering` is a global mode read from
`tableRowOrdering` (default `'sort'`). In
[TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L530-L560)
the body branches on it: `'sort'` → `flatRows` (filter + `applySort` over the
full flat issue set); `'hierarchy'` → `hierarchyRows` (depth-first
`buildHierarchyRows` from rolled-up roots, with column sort ordering *within*
siblings). Hierarchy and grouping are **mutually exclusive** — picking Hierarchy
clears `groupBy`/`groupByCol`, and picking a group forces `'sort'`
([TableReportControls.tsx](../../../src/react/reports/TableReport/components/TableReportControls.tsx#L100-L120)).
This matches design.md §1, which frames hierarchy as "not a separate data mode —
it's a sort key plus an indent + expand/collapse decoration applied to one
designated 'tree' column."

**Tree / summary / icon columns.** The three identity columns are independent.
The tree decoration is bolted onto whichever column has `isTree` (only Summary):
in the non-grouped render path the cell wraps `column.render(...)` in a flex row
with `paddingLeft: row.depth * 20`, a caret `<button>` when `row.hasChildren`, and
`<span className="truncate">{content}</span>`
([TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L800-L826)).
The icon column renders `<img>` from `issue.fields['Issue Type'].iconUrl`; the key
column renders `<a href={issue.url}>{key}</a>`. Because they're separate columns,
a user must add all three and order them correctly to reproduce the Estimation
Table's single indented "icon + key-link + summary" cell — which the legacy
[EstimationTable.tsx](../../../src/react/reports/EstimationTable/EstimationTable.tsx#L54-L72)
does in **one** `<td>` (icon `<img>`, key `<a class="link">`, summary
`<span class="truncate">`).

**Sorting.** Clicking a header cycles sort asc → desc → none via `cycleSort`
using the column's type-aware `compare`
([TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L708-L720)).
When hierarchy is on, that column sort orders *within* siblings
(`compareSiblings` passed to `buildHierarchyRows`,
[TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L548-L560)).
So today "hierarchy vs sort" is a **table-global** mode, and header-click sort is
a separate, orthogonal thing layered on top.

**Link styling (existing).** The `TABLE_STYLES` scoped `<style>` block already
sets `tbody a { color: #0c66e4; text-decoration: none }` and
`tbody a:hover { text-decoration: underline }`
([TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L206-L214)) —
so links are already "no underline until hover", but they're still Jira-blue at
rest (the key column). Nothing makes the *summary* a link, and "look like plain
text" means also neutralizing the blue at rest.

---

## 3. Options for the naming / control

### Option A — Rename the control to "Layout" (keep it global)
Keep a single global dropdown but relabel it **"Layout"** (or **"Rows"→"Order
rows by"**) with clearer values: **"Flat"** and **"Tree"** (or "Nested").
- **Pros:** smallest change — only label/option strings + the route value mapping.
  Keeps hierarchy discoverable as a first-class control. No migration of
  `tableColumns`.
- **Cons:** doesn't address the user's deeper idea that nesting belongs *to the
  tree column*. "Flat/Tree" still reads oddly next to "Group by ↓".

### Option B — Segmented "Flat / Tree" control (global, but visual)
Replace the dropdown with an Atlaskit segmented/toggle control **`Flat | Tree`**
sitting next to "Group by". Same semantics as A, better affordance (mockup
README already calls it a "`Rows` segmented control").
- **Pros:** clearer that it's a binary layout switch; matches the mockup framing.
- **Cons:** still global; still separate from the column that actually renders the
  tree. Adds a non-dropdown control to a row the code deliberately kept uniform
  ("EVERY Table control here is also a DropdownMenu",
  [TableReportControls.tsx](../../../src/react/reports/TableReport/components/TableReportControls.tsx#L10-L14)).

### Option C — Fold row-ordering into the tree column (no global control) ⭐
Remove the standalone "Rows" control entirely. Nesting becomes a **sort mode on
the Icon & Summary column** (problem 2): the column header menu offers
**"Sort: Hierarchy"** vs **"Sort: Summary (A→Z / Z→A)"**. Choosing "Hierarchy"
puts the table into tree layout; any other column sort ⇒ flat.
- **Pros:** directly implements the user's mental model; eliminates the confusing
  label by deleting the control; keeps the concept where the indentation visibly
  lives.
- **Cons:** hierarchy becomes **less discoverable** (buried in a hover-only header
  menu). Needs a fallback when the Icon & Summary column isn't shown. Interacts
  with grouping mutual-exclusion logic that currently lives in the global control.

**Recommendation:** **Option C, softened by a visible hint.** Make hierarchy a
sort mode of the tree column (aligns with problem 2 and the user's stated
preference), but keep a *small* visible affordance so it isn't hidden: e.g. the
tree column header shows a tree/indent glyph when in Hierarchy mode, and the
"Add column" catalog entry for Icon & Summary defaults to Hierarchy. If we want a
staged path, ship **Option A ("Flat/Tree", relabeled)** first (cheap, unblocks
the naming complaint) and migrate to C when the combined column lands.

---

## 4. Options for the combined Icon & Summary column

All options introduce a single catalog column (proposed id `identity:treeSummary`,
label **"Icon & Summary"**, `group: 'Identity'`, `isTree: true`, `isIdentity: true`)
whose `render` composes: indent spacer (`depth * 20`) → expand/collapse caret
(when `hasChildren`) → issue-type `<img>` → summary as a link (problem 3). The key
can be included inline (e.g. muted `PROJ-123` before the summary) or left to the
separate key column.

### Option A — Combined column, hierarchy stays a global mode
Add the combined column but keep the global "Rows: Flat/Tree" control (§3 A/B).
The column just *absorbs* icon+key+summary into one cell; `isTree` still gates on
`rowOrdering === 'hierarchy'`.
- **Pros:** minimal churn to the ordering logic; the existing
  `isTreeCell = column.isTree && rowOrdering === 'hierarchy'` check keeps working.
- **Cons:** ignores the user's "sort modes on the column" idea; still two places
  express nesting (global control + which column has `isTree`).

### Option B — Row-ordering is a per-column property of the tree column ⭐
Row ordering becomes a **sort mode owned by the Icon & Summary column**, not a
global mode. The column's header menu lists sort options:
**Hierarchy · Summary A→Z · Summary Z→A**. Selecting **Hierarchy** = tree layout;
selecting a Summary sort (or sorting by any *other* column) = flat. The global
`tableRowOrdering` key is derived/retired: hierarchy is "active" iff the active
sort is the tree column's `hierarchy` mode.
- **Pros:** exactly the user's model; single source of truth for nesting; removes
  the confusing global control. Naturally answers "how does choosing hierarchy on
  the column relate to the global toggle" — **it replaces it.**
- **Cons:** biggest refactor. `SortState` currently only encodes
  `{ columnId, dir }` ([model/applyView.ts](../../../src/react/reports/TableReport/model/applyView.ts#L28-L34))
  — a "hierarchy" mode needs a third variant (e.g. `dir: 'hierarchy'` or a
  `mode` field). Grouping mutual-exclusion (today driven by the global control)
  must move to "grouping clears the tree column's hierarchy sort." Need a defined
  behavior when the tree column isn't shown (fall back to flat).

### Option C — Combined column with an explicit "display mode" enum (not just sort)
Like B, but nesting is a distinct **display mode** on the column
(`treeMode: 'hierarchy' | 'flat'`) stored on the persisted column entry, separate
from sort direction. Sort (A→Z etc.) still applies within whichever mode.
- **Pros:** cleaner separation — "am I a tree" vs "how am I sorted" don't overload
  one field; extensible (future modes). Fits the existing per-column entry shape
  (`TableColumnEntry` already carries `aggregation?`, `width?` — add `treeMode?`).
- **Cons:** two concepts (mode + sort) the user has to understand on one column;
  slightly more persisted state.

**Recommendation:** **Option B** — make row-ordering a property of the Icon &
Summary column's sort menu, because it matches the user's request and collapses
two confusing controls into one. Implementation notes:

- **What happens to separate Icon/Key/Summary columns?** Keep them in the catalog
  (so power users can still add a bare Summary or a standalone Key), but change
  `DEFAULT_TABLE_COLUMNS` to `[identity:treeSummary]` (optionally + a couple of
  field columns). Only the combined column has `isTree`.
- **Persistence / migration of `tableColumns` + route params.** Persisted views
  are `TableColumnEntry[]` of `{ sourceId }`
  ([persistence.ts](../../../src/react/reports/TableReport/model/persistence.ts#L18-L22)).
  Because the report is beta and design.md §Persistence explicitly says **"No
  migration of legacy Grouper/Estimation settings"**, we can also skip migrating
  early `table2` views — but a tiny, safe shim is cheap: when loading entries,
  collapse a contiguous `issueType → key → summary` run into one
  `identity:treeSummary` entry, and map a persisted `tableRowOrdering:'hierarchy'`
  onto the tree column's hierarchy sort. Unknown/legacy ids already drop out
  gracefully (`columnIds.map(catalogById.get).filter(...)`,
  [TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L520-L525)),
  so no crash if we do nothing.
- **Grouping.** Preserve today's mutual exclusion: entering a group clears the
  tree column's hierarchy sort (⇒ flat), mirroring the current
  `handleSelectGroup` logic
  ([TableReportControls.tsx](../../../src/react/reports/TableReport/components/TableReportControls.tsx#L110-L120)).

---

## 5. Options for summary-as-link styling

**Repo constraint (must honor):** Tailwind is **precompiled** into
`dist/production.css` and *not* processed at runtime (see
[/memories/repo/styling-and-storybook.md] and the explicit comments in
[TableReport.tsx](../../../src/react/reports/TableReport/TableReport.tsx#L160-L214)) —
so a *new* Tailwind utility that isn't already in that build will silently not
apply. New styling must go in the scoped `TABLE_STYLES` `<style>` block (literal
CSS always applies), not as new utility classes.

The summary link render becomes (conceptually):
`createElement('a', { href: issue.url, target: '_blank', rel: 'noreferrer',
className: 'table-summary-link' }, summary)`.

### Option A — Extend `TABLE_STYLES` with a `.table-summary-link` rule ⭐
Add scoped CSS so the summary link is neutral-colored + no underline at rest, and
reveals the affordance on hover:

```css
[data-testid="table-report"] a.table-summary-link {
  color: inherit;            /* look like plain body text, not Jira-blue */
  text-decoration: none;
  cursor: pointer;
}
[data-testid="table-report"] a.table-summary-link:hover {
  color: #0c66e4;            /* reveal link affordance on hover */
  text-decoration: underline;
}
```

- **Pros:** obeys the precompiled-Tailwind constraint (literal CSS in an existing
  block that already styles `tbody a`); one small, self-contained rule; easy to
  keep the truncation (`<span className="truncate">` still wraps it, and `truncate`
  already exists in the prebuilt CSS since the current tree cell uses it).
- **Cons:** need `color: inherit` to *override* the existing
  `tbody a { color:#0c66e4 }` rule already in `TABLE_STYLES` — order/specificity
  matters (a class selector beats the bare `tbody a`, so this is fine, but the
  rule must live in the same block).

### Option B — Inline `style` object on the anchor
Render the anchor with an inline `style` for the rest state and no hover (inline
styles can't express `:hover`).
- **Pros:** guaranteed to apply; no CSS block edit.
- **Cons:** **can't do hover** — the whole point is the hover reveal — so you'd
  need JS `onMouseEnter/Leave` state, which is heavy for pure styling. Rejected.

**Recommendation:** **Option A** — a scoped `.table-summary-link` rule appended to
`TABLE_STYLES`. It's the only option that expresses the plain-until-hover behavior
cleanly while respecting the precompiled-Tailwind rule. Keep `target="_blank"
rel="noreferrer"` for parity with the Estimation Table key link
([EstimationTable.tsx](../../../src/react/reports/EstimationTable/EstimationTable.tsx#L62-L66)).
Ensure keyboard focus also reveals the affordance (`:hover, :focus-visible`) for
a11y.

---

## 6. Open questions for the user

- **Global control vs per-column sort:** OK to *remove* the "Rows" dropdown
  entirely and make Hierarchy a sort mode of the Icon & Summary column (§3 C / §4
  B)? Or keep a small visible "Flat/Tree" control for discoverability?
- **Key placement:** Should the combined "Icon & Summary" cell also show the
  issue **key** inline (e.g. muted `PROJ-123 — summary`), or stay icon + summary
  only with Key remaining an optional separate column?
- **Default columns:** Change `DEFAULT_TABLE_COLUMNS` from the three separate
  identity columns to just the combined `identity:treeSummary` (+ maybe Status /
  Story Points)? What's the desired out-of-the-box view?
- **Keep the old separate columns in the catalog** (bare Summary, standalone Key,
  standalone Icon) for power users, or drop them once combined exists?
- **Hierarchy when the tree column isn't shown:** if a user removes the Icon &
  Summary column, should hierarchy silently fall back to flat, or should removing
  it be disallowed while in hierarchy mode?
- **Migration effort:** Given design.md says no legacy migration is required, is
  the tiny shim (collapse `icon+key+summary` runs; map old `tableRowOrdering`)
  worth doing, or should early `table2` views just reset to defaults?
- **Summary link target:** open the Jira issue in a **new tab** (`_blank`, like
  Estimation Table) or same tab?
