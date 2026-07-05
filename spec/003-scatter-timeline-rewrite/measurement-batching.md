# Element Width Measurement: Why Batch Instead of Estimate

## Context

The scatter-timeline layout needs the rendered width of each issue element to run its
collision-detection / row-packing algorithm. Today `defaultGetWidth()` in
[scatter-timeline.js](../../src/canjs/reports/scatter-timeline.js) measures each element
individually:

1. Clone the element
2. Wrap it in an off-screen `<div>` and append to `document.body`
3. Read `getBoundingClientRect().width`
4. Remove it from the DOM

This runs **once per issue** inside the `calculate()` loop.

## Why Not Just Estimate Widths?

Estimating width from data (e.g. character count × average glyph width) is cheap and
DOM-free, but it is inaccurate with proportional fonts. A word made of wide glyphs
(`WWWW`) is dramatically wider than one made of narrow glyphs (`iiii`), even with the same
character count. That inaccuracy would cause text overflow or wasted horizontal space and
would throw off the packing algorithm. Accurate estimation would require a per-glyph width
table kept in sync with the font — more complexity than it's worth.

**Conclusion:** keep real measurement for accuracy, but make it cheaper by batching.

## The Real Cost Today: Layout Thrashing

Every `getBoundingClientRect()` call forces the browser to flush pending layout. Because
the current code interleaves DOM mutations (`appendChild` / `removeChild`) with reads
inside a loop, the browser cannot batch its work — it recalculates layout on every
iteration. This is classic **layout thrashing**: O(n) forced reflows for n issues. The goal
of batching is to reduce this to a single reflow (or none) while keeping true measured
widths.

## Batching Approaches

### Option A — Batch DOM measurement (all writes, then all reads)

Separate the DOM mutations from the reads so layout is only flushed once.

1. Create a single off-screen container.
2. Append **all** issue elements to it (writes only — no reads yet).
3. Append the container to the document once.
4. Loop again and read every `getBoundingClientRect().width` (reads only).
5. Remove the container.

Because all writes happen before all reads, the browser flushes layout a single time
instead of once per element.

```
// pseudocode
const container = createOffscreenContainer();
const elements = issues.map(makeElementForIssue);
elements.forEach((el) => container.appendChild(el)); // writes
document.body.appendChild(container);                // one attach
const widths = elements.map((el) => el.getBoundingClientRect().width); // reads
document.body.removeChild(container);
```

### Option B — Canvas `measureText()` (no DOM at all)

Use the Canvas 2D API to measure text with the actual font. This gives true proportional
width without inserting or removing any DOM nodes, so there is zero reflow.

1. Create one `<canvas>` and get its 2D context (reuse across all measurements).
2. Set `ctx.font` to match the element's computed font (family, size, weight).
3. Call `ctx.measureText(label).width` for each issue.
4. Add fixed offsets for padding, icons, and margins that aren't part of the text.

Best when the measured width is dominated by a text label. Requires keeping the canvas
`font` string in sync with the CSS.

### Option C — Measure once and cache (`ResizeObserver` / `useLayoutEffect`)

In the React rewrite, render the elements once, measure them after layout via a
`useLayoutEffect` or `ResizeObserver`, and cache the widths. Recompute only when the label,
font, or container size changes rather than on every recalculation.

## Recommendation

- For accuracy with proportional fonts, **do not estimate** — measure.
- To remove the per-item reflow cost, use **Option A** (batched read/write) as the
  low-risk change, or **Option B** (`measureText`) if the element width is essentially
  text-driven.
- In the React rewrite, prefer **Option C** so measurement happens once per render and is
  cached, combined with A or B for the initial measurement pass.
