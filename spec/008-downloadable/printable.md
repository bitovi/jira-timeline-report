# Implementation Plan — Printable / PDF-downloadable Gantt & Scatter reports

## Goal

Let users export the **Gantt** (`start-due`) and **Scatter** (`due`) reports to PDF via a
**"Download PDF"** button that triggers the browser's native _Save as PDF_
(`window.print()`), backed by a dedicated **print stylesheet** that isolates a _report-like
page_: **title/header + chart + footer legend** — with all app chrome (sidebar, nav, controls)
hidden.

The browser-print approach (**Option B**) was chosen over client-side rasterization
(html-to-image + jsPDF) and server-side Puppeteer because it:

- keeps text **vector / selectable** and preserves exact color + font fidelity (native render),
- adds **zero heavy dependencies** and **no backend**, so it works in both **web** and
  **plugin (Atlassian Connect iframe)** deployment modes,
- sidesteps the `oklch()` / web-font pitfalls that rasterizers hit with Atlaskit tokens.

The one real engineering risk — charts that are **wider than a page** — is handled with a
small JS-computed transform scale set just before printing.

## What exists today (so we don't rebuild it)

- **Both reports are plain DOM** (CSS grid + `<div>` rows/markers), not SVG/canvas, and mount
  into a stable `#react-report-container` element inside the view template of
  [`src/timeline-report.js`](../../src/timeline-report.js). This makes them print-friendly.
- **The footer legend already renders** into `#report-footer` (uses `position: sticky`) — see
  [`src/react/ReportFooter/`](../../src/react/ReportFooter/).
- **Report-type identifiers** are mapped in [`src/timeline-report.js`](../../src/timeline-report.js):
  scatter = `due`, gantt = `start-due`.
- **The controls bar** is rendered by
  [`src/react/ReportControls/ReportControls.tsx`](../../src/react/ReportControls/ReportControls.tsx);
  its default (scatter/gantt) return renders `Filters` / `ViewSettings` — the natural home for
  a new Print button.
- **No print CSS exists yet.** The CSS entry point is
  [`src/css/status-reports.css`](../../src/css/status-reports.css), which imports
  `primitives.css` / `colors.css` / `fonts.css` / `spacing.css` and then Tailwind.

## Layout ancestors to neutralize for print

The report is nested inside several scrolling/height-constrained containers that must be
un-constrained (or hidden) so the full chart flows onto the page:

- `#timeline-configuration` — left settings sidebar → **hide**
- The nav bar / `select-cloud` / `#login` in [`index.html`](../../index.html) → **hide**
- `#view-reports`, `#sample-data-notice`, `#saved-reports`, `#report-controls` → **hide**
- `.fullish-vh` wrapper (`overflow-y-auto`, fixed height) → **remove overflow/height clamps**
- `#react-report-container` and ancestors → **remove `overflow`** so nothing clips the chart
- `#report-footer` (`position: sticky`) → **unstick** (`position: static`) so the legend prints
  at the end

## Approach — phased, with a decision gate

### Phase 0 — POC spike (throwaway, decision gate)

The whole risk of Option B is _"what does it actually look like on paper?"_ Prove it with the
least code possible before building anything permanent.

- Add a **temporary** `@media print` block to
  [`src/css/status-reports.css`](../../src/css/status-reports.css) that:
  - hides `#timeline-configuration`, the nav bar, `#report-controls`, `#saved-reports`,
    `#view-reports`, and the sample notice,
  - sets `@page { size: landscape; margin: 10mm }`,
  - removes `overflow` / `height` clamps on `.fullish-vh` and its report ancestors,
  - unsticks `#report-footer`.
- **No button** — load a scatter and a gantt report and press **Cmd+P** to open print preview.

**What the POC validates (the only real unknowns):**

1. Do Atlaskit **`oklch` colors** and the **Poppins** web font survive native print? (Expected: yes.)
2. How badly does a **wide chart** overflow / clip / paginate horizontally _without_ scaling —
   confirming how aggressive the Phase-1 transform scale must be.
3. Do the hide selectors cleanly isolate the chart, or is there a surprise ancestor with
   `overflow: hidden` that clips content?
4. Does the **footer legend** land correctly once un-stuck?

**Decision gate:** promising → proceed to Phase 1+; unworkable even with scaling → reconsider
**Option A** (html-to-image + jsPDF). **Revert the temporary block** either way.

### Phase 1 — Print stylesheet

Promote the spike into a permanent, maintainable stylesheet.

- Create **`src/css/print.css`** and import it from
  [`src/css/status-reports.css`](../../src/css/status-reports.css) (`@import './print.css';`).
- Rules:
  - `@page { size: landscape; margin: 12mm }`.
  - `@media print`: hide non-report chrome via a `.print-hidden` utility + the ID targeting
    above; show print-only elements via a `.print-only` utility (`display: none` on screen).
  - Neutralize `overflow` / `height` on `html`, `body`, `.fullish-vh`, and `#react-report-container`
    ancestors.
  - Unstick `#report-footer` (`position: static`).
  - **Scale wide charts:** apply `transform: scale(var(--print-scale, 1))` with
    `transform-origin: top left` to a chart wrapper so it fits the page content width.

### Phase 2 — Print header

- Add a print-only `#print-header` element (class `print-only`) to the report area of
  [`src/timeline-report.js`](../../src/timeline-report.js), populated with:
  - **report title** — saved report name if present, else the report-type label + primary
    issue type,
  - the **date**, and
  - the **JQL** (optional).
- Screen-hidden, print-shown.

### Phase 3 — Button + scale orchestration

- New modlet `src/react/ReportControls/components/PrintReportButton/`:
  - `PrintReportButton.tsx` — an Atlaskit button labeled **"Download PDF"**.
  - On click: measure `chartScrollWidthPx` (of `#react-report-container`'s grid) vs the printable
    page content width, set `--print-scale = pageWidth / chartScrollWidth` on the chart wrapper,
    then call `window.print()`.
  - Also handle `beforeprint` (recompute scale so **Cmd/Ctrl+P** works too) and `afterprint`
    (cleanup).
  - `index.ts` barrel export; colocated `*.test.tsx`.

### Phase 4 — Wire into controls

- Render `PrintReportButton` in the scatter/gantt (default) return of
  [`src/react/ReportControls/ReportControls.tsx`](../../src/react/ReportControls/ReportControls.tsx),
  next to `ViewSettings`, **guarded to only show for `due` and `start-due`**.

## Files touched

| File                                                                                               | Change                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`src/css/status-reports.css`](../../src/css/status-reports.css)                                   | Phase 0 temp block (reverted); Phase 1 `@import './print.css';` |
| `src/css/print.css`                                                                                | **NEW** — all `@media print` + `@page` rules                    |
| [`src/timeline-report.js`](../../src/timeline-report.js)                                           | **NEW** print-only `#print-header` in the report area           |
| `src/react/ReportControls/components/PrintReportButton/`                                           | **NEW** modlet — button + scale calc + `window.print()`         |
| [`src/react/ReportControls/ReportControls.tsx`](../../src/react/ReportControls/ReportControls.tsx) | Mount `PrintReportButton` for `due` / `start-due` only          |

## Verification

1. `npm run dev`; load a **scatter** and a **gantt** report.
2. Click **Download PDF** → the print dialog shows only **header + chart + footer legend**
   (no sidebar, nav, or controls). _Save as PDF_ yields a clean landscape page.
3. **Wide chart** (many quarters) → scales to fit the page width, not clipped.
4. **Tall gantt** → vertical pagination is acceptable and the footer legend prints.
5. **Cmd/Ctrl+P** (not just the button) produces the same isolated output.
6. Poppins font + Atlaskit status colors render correctly in the PDF.
7. `npm run typecheck` passes.

## Decisions

- **Approach B (native print)** — vector/selectable text, exact fidelity, no heavy deps, works
  in web + plugin modes.
- **Scope** — scatter (`due`) + gantt (`start-due`) only; other report types unchanged.
- **Content** — report-like page = print header (title/date) + chart + footer legend.
- **Trade-off** — the wide-chart scale/pagination is the main effort; handled via a JS-computed
  `--print-scale` transform.

## Open considerations

1. **Header content source** — recommend: saved report name if present, else report-type label +
   primary issue type; always include the date. (Alt: include full JQL.)
2. **Plugin (Atlassian Connect iframe) mode** — `window.print()` inside the iframe prints the
   iframe in Chrome; **acceptable**, verify — possible follow-up.
3. **Very tall Gantt** — allow natural vertical multi-page pagination rather than forcing a
   single scaled page.
4. **Fallback** — if Phase 0 shows wide charts are unworkable even with scaling, pivot to
   **Option A** (html-to-image → jsPDF): capture `#react-report-container` to PNG and embed in a
   PDF. Raster output (non-selectable text) but full layout control; `html-to-image` handles
   `oklch` where `html2canvas` fails.
