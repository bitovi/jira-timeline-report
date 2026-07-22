# Table Report — interactive mockups

Visual companion for [`../design.md`](../design.md). Open `table-report.html` in a
browser (no build needed — it's a single self-contained file with sample data).

## What it demonstrates

One engine, two orthogonal knobs, driving all four "modes" from the design doc:

| Knob | Values | Shown by |
| --- | --- | --- |
| **Row ordering** | Sort · Hierarchy | `Rows` segmented control |
| **Grouping** | None · 1 field · 2 fields | `Group by ↓` + `then` selectors (+ `⇄` swap) |
| **2D field axis** | Down rows · Across cols | `Fields` toggle (only when 2 fields grouped) |

- **Flat table** (Sort, no group) — `preview-1-flat.png`
- **Hierarchy** — depth-first parent→child indent with expand/collapse carets on the
  Summary cell; issue-type icons + Estimated/Rolled-Up-Days "last→current" diffs
  (reproduces today's Estimation Table) — `preview-2-hierarchy.png`
- **1D grouped** — synthetic group-header rows with member counts; measures aggregated per
  group. Groups start **collapsed (roll-up only)** so the report reads as an executive
  summary; click a group (or **Expand all**) to drill into member rows —
  `preview-3-grouped.png`
- **2D cross-tab** — two fields grouped (rows × columns, one value per cell). The **Fields**
  toggle flips how the measures are laid out inside it — down as sub-rows
  (`preview-5-2d-vertical.png`) or across as merged sub-columns (`preview-6-2d-horizontal.png`).

## Measures = the columns you're already showing

There is **no separate "cell values" picker**. The values that get aggregated are simply
the columns you've added, minus the ones that can't/shouldn't be aggregated in a group:

- **Identity columns** (Issue key, and the Summary tree column) drop out.
- The **field(s) you're grouping on** drop out (grouping by Status → no Status column;
  it's the group label instead).
- Everything left (Due date, Story Points, …) becomes a **measure**, each carrying its own
  type-aware aggregation, and repeats under each group.

So `key · project · status · due · storyPoints` grouped by **Project × Status** leaves
**Due date** and **Story Points** as the measures. Each cell = that measure
**aggregated over the issues in that group** (in cross-tab: `row-group ∩ column-group`).
This preserves today's "multiple aggregators" — you get one measure column per shown
field — without a second selection step.

## 2D cross-tab: how the measure fields are laid out

With two grouping fields you always get a **cross-tab**: one field down the rows, the
other across the columns, one value per cell. The `Fields` toggle only changes **which way
the measure fields (Due date, Story Points, …) run** inside that cross-tab:

- **↓ Down rows (default)** — each row-field value spans one **sub-row per measure**; the
  column-field values are the columns. Stays narrow regardless of measure count and reads
  top-to-bottom — the easier-to-read option. (`preview-5-2d-vertical.png`)
- **→ Across cols** — each column-field value is a **merged header spanning a block of
  measure sub-columns** (two-row header). This is today's Grouper pivot shape. Powerful but
  grows wide fast with several measures. (`preview-6-2d-horizontal.png`)

`⇄` swaps which field is rows vs columns. The second selector always reads **across →**
in 2D because that field owns the column axis either way.

> Both layouts show one **aggregated** value per cell (Sum of points, Range of dates, …).
> The per-cell aggregation is the column's own aggregation from its `⋯` menu.

## Per-column controls (the "hover-only" header menu)

The key open question from the design doc. Headers look static/printable at rest; the
`⋯` button appears only on hover/focus. It opens one popover combining, per the doc:

- **Sort** ascending / descending
- **Aggregation** (type-aware list; used when grouped — number→Sum/Avg/Min/Max/Count,
  date→Range, text/option→Distinct list). Adding the same field twice with different
  aggregations reproduces today's multi-aggregator behavior.
- **Filter** (type-aware: number→range, option/status→multi-select membership,
  text→contains). Active filters also surface as removable chips above the table and
  apply *before* grouping.
- **Remove column**

See `preview-4-column-menu.png`.

**+ Add column** opens a searchable catalog grouped into Identity / Fields / Estimation /
Computed — fields and the old "aggregators" are now the same addable-column concept.

## Deliberately not built here

- **Sticky headers / frozen label columns** — a requirement for the real report (see
  design doc §8): all header rows stick on vertical scroll, and the row-label column(s)
  freeze on horizontal scroll. The mockup just scrolls plainly.

## Not final

These are for resolving the open UX items (hover menu, group-header affordance, 2D
layout) — not a spec of exact Atlaskit components or the persistence schema. Colors
approximate Atlaskit tokens; the real report would use `@atlaskit` components.
