# Work Breakdown — UI Improvement Ideas

## What "work breakdown" is today

The work breakdown is the **secondary report** rendered by
[`src/canjs/reports/status-report.js`](../../src/canjs/reports/status-report.js) when
`secondaryReportType === "breakdown"`. It draws a row of cards, one per primary issue
(Outcome / Release / Initiative). Each card contains:

- A **header bubble** colored by the issue's rollup status, showing the title.
- One **work-type row** per active work type (`design` / `dev` / `qa` / `uat`), each with a
  small colored key square and a target date colored by that work type's status.
- A **list of child issues**. Each child is prefixed by a run of tiny mono letters
  (`d` `D` `Q` `U`) — one per active work type — each colored by that child's status _for that
  work type_.

The visual model is: **color == status**, **letter == work type**, **card == primary issue**.
The four work types are `design` (`d`), `dev` (`D`), `qa` (`Q`), `uat` (`U`); only work types
that actually contain work are shown for a given board.

## Pain points

1. **No legend.** Nothing on screen explains that `d/D/Q/U` mean design/dev/qa/uat, or that
   the colors map to statuses (complete / on‑track / behind / warning / blocked / not‑started).
   New viewers have to be told what they're looking at.
2. **Hard to scan across children.** The per‑child status is encoded in up to 4 tiny
   1‑character glyphs jammed together. Comparing "which epics are behind on QA?" across a card
   means reading every letter's color individually.
3. **No progress / counts.** You cannot see "4 of 6 children complete" or "dev is 80% done"
   at a glance. The card communicates dates and per‑item status but no rollup magnitude.
4. **Accessibility.** Meaning rides almost entirely on color, and the status letters are
   ~11px mono. This is rough for color‑blind users and small screens.
5. **Uneven, wasteful layout.** Cards are height‑matched to the tallest, so a card with one
   child (e.g. "Loyalty QR Codes") leaves a large empty column. Dense boards (20+ outcomes)
   shrink everything to `text-xs` and become a wall of letters.
6. **Dates lack context.** A work‑type row shows `dev Mar 9` but not whether that's a start
   or a due date, nor how it compares to the previous period beyond a parenthetical.
7. **No prioritization.** Blocked / behind children are interleaved with complete ones in
   source order, so the things that need attention don't surface first.

## Options

Each option is a self‑contained mock in this folder. They are not mutually exclusive — the
legend from Option C, for instance, pairs well with any of the others.

### Option A — Status matrix (`option-a-status-matrix.html`)

Turn each card's child list into a compact **matrix**: rows are child issues, columns are the
work types. Every cell is a labeled status dot, so scanning a single column instantly answers
"who is behind on QA?". The header uses the child **issue type** (e.g. Epic) as the row label
and shows each work type's **rollup target date** (with the previous date in red if it slipped)
under its colored letter.

- **Pros:** Best scannability; aligns statuses into columns; self‑labeling.
- **Cons:** Wider cards; fewer cards fit per row on dense boards.
- **Best when:** ≤ ~12 outcomes and stakeholders compare progress across work types.

### Option B — Progress rollup (`option-b-progress-rollup.html`)

Keep the card/list shape but add **magnitude**: a slim progress bar + `done/total` count and
the **rollup target date** per work type in the header, plus a per-child progress meter.
Answers "how far along" not just "what status".

- **Pros:** Communicates completion at a glance; minimal layout change; degrades gracefully.
- **Cons:** Needs completion data per work type; bars add vertical height.
- **Best when:** Leadership wants a "how close are we" read, not per‑item detail.

### Option C — Grouped & legended (`option-c-grouped-and-legend.html`)

Add a **persistent legend** (work‑type letters + status colors) above the board, a one‑line
**summary** plus a strip of **work‑type target dates** in each card header, and **group
children by status** (Blocked → Behind → On track → Complete) with complete collapsed by
default.

- **Pros:** Fixes the "what do the colors mean" and "what needs attention" problems directly;
  smallest change to the existing card idiom.
- **Cons:** Grouping reorders children away from source order; collapsing hides detail.
- **Best when:** You want the current look, just clearer and attention‑ordered.

## Baseline

[`current-state.html`](./current-state.html) is a faithful replica of today's breakdown for
side‑by‑side comparison with the options.

## Recommendation

Start with **Option C**'s legend + header summary (cheap, high clarity win), then layer in
**Option A**'s matrix for boards where cross‑work‑type comparison is the main job.
