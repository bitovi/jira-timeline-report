# 023 — Add Report modal redesign

Improve the "Add Report" picker used by **Report of Reports** — the modal that appears when you
click _Add Report_ in a document. Today it is a stack of centered, subtle full-width buttons with no
search, no report type, and no other context (see the attached screenshot in the ticket). This spec
covers **presentation and one new capability (search)** for that modal; it does not change the
report-of-reports data model or how reports are stored.

- [mockups/add-report-modal.html](./mockups/add-report-modal.html) — five states: default,
  filtering, no-results, empty, and a "future metadata" variant. Open it in a browser.

## The component today

[`AddReportModal.tsx`](../../src/react/reports/ReportOfReports/components/AddReportModal.tsx) renders
an `@atlaskit/modal-dialog` whose body is a `<ul>` of `<Button appearance="subtle" shouldFitContainer>`
— one per report, label = the report name, centered. It is pure and prop-driven: the caller passes an
already-filtered, name-sorted `Report[]` from
[`selectableReports()`](../../src/react/reports/ReportOfReports/model/selectable-reports.ts).

Problems visible in the screenshot:

- **No search.** With ~18–20 saved reports you scroll a plain list. This is the headline ask.
- **No type.** Every row looks identical; you can't tell a Gantt from a Table from a Scatter.
- **No context.** Nothing distinguishes "All Outcomes" from "All Outcomes copy."
- **Centered subtle buttons** read as an undifferentiated wall of blue text rather than a list.

## What information do we actually have about a saved report?

This is the crux of two of your questions. A saved report is this record
([`src/jira/reports/fetcher.ts`](../../src/jira/reports/fetcher.ts)):

```ts
export type Report = {
  id: string; // uuid
  name: string; // the display name
  queryParams: string; // URLSearchParams string: primaryReportType, jql, tableColumns, …
  sections?: StoredNode[]; // only present on a report-of-reports
};
```

So, per report, we have **and can show today** with zero storage changes:

| Field            | Source                                                      | Use in the modal                     |
| ---------------- | ----------------------------------------------------------- | ------------------------------------ |
| **Name**         | `report.name`                                               | Row title (already shown)            |
| **Report type**  | `new URLSearchParams(queryParams).get('primaryReportType')` | Type icon + badge, and searchable    |
| **JQL / source** | `…get('jql')`                                               | Secondary line (optional, truncated) |

The `primaryReportType` key maps to a friendly name via
[`src/configuration/reports.ts`](../../src/configuration/reports.ts): `start-due` → "Gantt Chart",
`due` → "Scatter Plot", `table` → "Table", `cards` → "Cards", etc. `selectable-reports.ts` already
parses `queryParams` this exact way to exclude nested report-of-reports, so the pattern is proven.

### Icons per report type

Showing the type as an icon + badge means **every** `primaryReportType` needs one — there is no
"generic report" fallback we'd want in the common case. The mockup's legend draws the full set; each
icon is a hand-rolled inline SVG (no icon-font dependency) tinted by a per-type color token:

| `primaryReportType`   | Name                | Icon                                 | Color   |
| --------------------- | ------------------- | ------------------------------------ | ------- |
| `start-due`           | Gantt Chart         | staggered horizontal bars            | blue    |
| `due`                 | Scatter Plot        | scattered dots (no baseline)         | purple  |
| `estimation-progress` | Estimation Progress | partially-filled pill / progress bar | orange  |
| `auto-scheduler`      | Auto-Scheduler      | histogram in a bell-curve shape      | indigo  |
| `estimate-analysis`   | Estimation Analysis | bars under a magnifier               | magenta |
| `table`               | Table               | grid                                 | green   |
| `flow-metrics`        | Flow Metrics        | double chevron                       | cyan    |
| `time-in-status`      | Time in Status      | stopwatch                            | gold    |
| `cards`               | Cards               | 2×2 card grid                        | teal    |
| `report-of-reports`   | Report of Reports   | a document stacked behind a document | orange  |

Notes:

- **Scatter Plot is dots on a time axis, not an XY cloud.** The actual report lays issues out as
  colored dots along a horizontal timeline (Jul → Q3 → Q4 …), so the icon is loose scattered dots —
  no line/axis drawn under them.
- **Report of Reports gets an icon even though the picker never lists it** (no nesting in v1). The
  type still surfaces on the [Saved Reports page](../../src/react/ViewReports/ViewReports.tsx) and the
  report-type dropdown, so a shared type→icon map wants an entry for it regardless.
- These icons are **one shared `reportTypeIcon(typeKey)` map** — the Add Report modal, the Saved
  Reports page, and the report-type dropdown should all read from it so a type looks identical
  everywhere. Colors reuse Atlaskit token families already used elsewhere in the app.

  **Shipped as** [`src/react/components/ReportListing/`](../../src/react/components/ReportListing/):
  `report-type-meta.ts`, `describe-report.ts`, `report-search.ts`, `<ReportRow>`, and
  `useReportSearch()`. The modal and the Saved Reports page both consume it; the report-type
  dropdown does not yet.

### What we don't have

> _Do we have when they are saved? By who?_

**No.** There is no `createdAt`, `updatedAt`, `author`, or `owner` anywhere on the record — the four
fields above are the entire schema. Confirm: `Report` in
[`fetcher.ts`](../../src/jira/reports/fetcher.ts) has no timestamp or user field, and the save path
([`useSaveReports.tsx`](../../src/react/services/reports/useSaveReports.tsx)) writes exactly what's
passed with no metadata added.

To show **"Updated Jul 28 by Justin Meyer"** (mockup state E) we would need to, in a **separate,
optional follow-up**:

1. Add `updatedAt: string` (ISO) and `updatedBy: { accountId, displayName }` to `Report`.
2. Stamp them in `createReport` / the update mutation at save time — `updatedAt = new Date()`, and
   `updatedBy` from the current Jira user (we already have an authenticated client; the account is
   available via the `myself` endpoint the app calls on boot).
3. Backfill: every report saved before this ships has neither field, so **all readers must treat
   both as optional** and the row must render fine without them (the mockup's default state does).
4. This also unlocks a **"Recently updated" sort** (mockup foot of state E) and richer columns on the
   Saved Reports management page ([`ViewReports.tsx`](../../src/react/ViewReports/ViewReports.tsx)),
   which today shows only name + a delete menu.

Because it needs a schema change + migration tolerance, metadata is deliberately **out of scope for
the redesign** and drawn only to prove the row layout absorbs it later without another redesign.

## Proposed redesign (mockup states A–D)

Presentation + client-side search only. No new stored data.

1. **Search field, autofocused, at the top.** Filters `reports` in memory by a case-insensitive
   substring match against **name and type label**. Matched substrings are highlighted (`<mark>`).
   Purely client-side — every report is already in memory, so no fetch. Mirrors the autofocus pattern
   in [`SaveReportModal`](../../src/react/SaveReports/components/SaveReportModal/SaveReportModal.tsx).
2. **Left-aligned rows with a type icon + type badge.** The icon and badge come from
   `primaryReportType`. This is the single biggest scannability win and costs nothing to store.
3. **Optional secondary line** — the report's JQL (truncated), so near-duplicate names are
   distinguishable. Cheap, already in `queryParams`.
4. **Distinct empty vs. no-results states.** Keep today's "No other saved reports to add" copy for a
   genuinely empty list (state D); show a search-specific dead-end when a filter matches nothing
   (state C).
5. **Keyboard nav (stretch).** ↑/↓ move the active row, ↵ adds it, Esc closes. Makes the search
   field genuinely faster than the mouse. Can ship after the visual pass.

### Non-goals

- No change to `selectableReports()` (still excludes the current doc and nested report-of-reports).
- No change to the stored `Report` schema (metadata is a separate follow-up, above).
- No grouping-by-type in v1 — the flat, searchable list is enough at this scale. The badge already
  makes type visible; a group header is easy to add later if lists grow.

## Rough build order

1. Derive a `{ report, typeKey, typeName, jql }` view-model from `Report[]` (small pure helper next
   to `selectable-reports.ts`, using the `reports.ts` config for the type name).
2. Rebuild `AddReportModal` body: search input + filtered list of rows (icon, name, badge, meta).
   Keep the `onSelect(report.id)` / `onClose` prop contract unchanged.
3. Add the highlight + no-results + keyboard behaviors.
4. (Follow-up spec, optional) `updatedAt` / `updatedBy` schema + save-time stamping + sort + Saved
   Reports page columns.

## Open questions

- Show JQL on the secondary line, or hold it for the metadata line so we don't show two different
  secondary contents before/after the metadata work lands?
- Is keyboard nav in-scope for the first pass, or a fast follow?
- ~~Do we want this same searchable picker to eventually back the **Saved reports** dropdown too, so
  there's one report-picker component?~~ **Resolved — partly.** The rows and search now live in
  `components/ReportListing` and back both the Add Report modal and the
  [Saved Reports page](../../src/react/ViewReports/ViewReports.tsx), which dropped its
  `DynamicTable` (its columns were never sortable) for the shared row list and gained search, type
  icons, badges, and JQL lines. The **Saved reports dropdown** in the report header still has its
  own markup and is the remaining call site.
