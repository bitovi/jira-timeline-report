# spec/012 Table (beta) — issues review & fix plan

Review of [`issues.md`](./issues.md) against the built code
(`src/react/reports/TableReport/`). Each issue below is confirmed against the
source with the root cause and the fix.

Blocked on: verifying most of these end-to-end really wants the
[spec/013 mocking-data](../013-mocking-data/summary.md) replay pipeline (inject a
dataset with real parent/team objects without Jira). The fixes can be written
against the Storybook stories in the meantime.

---

## Issue 1 — Group By control (UI + behavior)

**"Only show columns that are added."** — CONFIRMED. `TableReportControls.tsx:87`
builds `groupableColumns` from the *entire* catalog (every Jira field), and the
Group By / column-dimension dropdowns list all of them (`:150`, `:182`). Per design
§7 + mockup README, you group on the columns you're **showing** (measures = shown
columns minus the grouped field).
**Fix:** derive group options from `columnIds` (the added `tableColumns`), not the
full catalog, filtered to non-identity columns.

**"Why don't they have the arrows the mocks have."** — CONFIRMED. Triggers read
`"Group by"` / `"+ column dimension (2D)"` with no `↓`/`→` axis arrows; mock shows
`Group by ↓` + `then ↓/→` and a styled `⇄` swap. The `⇄` button exists
(`:164`) but the directional affordance and labels don't match.
**Fix:** match the mock labels/arrows (`Group by ↓`, second selector reads `then →`
in 2D), style the swap per mock.

## Issue 2 — Adding a column must load the field & reload (the important one)

CONFIRMED gap. The legacy Grouper wrote added fields to the **`fields`** route param
→ `allFieldsToRequest` (`route-data.js:375-385`) → `rawIssuesRequestData` re-fetches
issues from Jira with the new field (`state-helpers.js:28`, `jira-data-requests.js:95`).
TableReport writes **only** `tableColumns`; nothing feeds `fields`/`allFieldsToRequest`,
and `TimelineReport.tsx` binds none of it for `table2`. So a column for a
not-already-loaded field reads `issue.fields?.[name]` → `undefined` → renders blank,
with no reload.
**Fix (implemented):** make `tableColumns` the **single source of truth** — no
parallel `fields` write. `route-data.js` `allFieldsToRequest` now unions the base
fields, the legacy `fields` URL param, and a new `tableColumnFields` getter that
extracts the Jira field keys from `field:<key>` sourceIds in `this.tableColumns`.
The keys (`parent`, `status`, `customfield_1`, …) are valid Jira field ids, and the
fetch's name→id `nameMap` passes unmatched ids straight through
(`jira.ts:282`), so no key→name translation is needed. Because the getter reads
`this.tableColumns`, adding/removing a column anywhere auto-refetches and removals
prune automatically — strictly better than the Grouper's manual "Additional Fields"
list.

## Issue 3 — Object-valued fields (parent, team)

CONFIRMED. `buildColumnCatalog.ts:55` field columns do `issue.fields?.[field.name]`
— a raw scalar lookup. `Parent` is an **object** (`.key` / `.fields.summary`);
`Team` isn't in raw `issue.fields` at all (normalized at `issue.team.name`). Both
render `[object Object]`/blank and group into one useless bucket. The Grouper had
dedicated extractors (`GroupingReport/ui/grouper.tsx:41-53` parent, `projectKey`
normalized).
**Fix:** covered by Issue 4's approach (extractors that read the object/normalized
shape and produce a display string + a stable group key).

## Issue 4 — Normalized/derived/rolled-up vs raw Jira fields

**DECISION (user): prefer normalized, fall back to raw.** One column per concept —
where a normalized/derived property exists (status, parent, team, project, dates,
story points, rollups) the column reads it; otherwise read raw `issue.fields`.
Estimation columns already read the derived/rollup shape (`buildColumnCatalog.ts:66-86`).
**Fix:** in `buildColumnCatalog` / `fieldTypeRegistry`, add a normalized-source map
(field key → accessor on the normalized/derived issue: `parentKey`+parent object,
`team.name`, `projectKey`, `status`, `derivedTiming.*`, `completionRollup.*`) that
takes precedence over the raw `issue.fields[name]` lookup, with the raw lookup as
fallback. Group keys/compare use the normalized value. This resolves #3 too.

Normalized/derived issue shape (for reference): `src/jira/normalized/normalize.ts:71-103`
(`projectKey`, `parentKey`, `status`, `team{name,...}`, `storyPoints`, `dueDate`…) and
`src/jira/derived/derive.ts:26-33` (`derivedTiming`, `derivedStatus`); rollups add
`completionRollup.totalWorkingDays`. Raw Jira fields live at `issue.issue.fields[<display name>]`.

## Issue 5 — "Why doesn't the table UI look like the mock?"

CONFIRMED and FIXED. My first pass was wrong to call this "downstream of #1" — the
report body was a bare `<table class="w-full">` with plain-text cells: no card, no
header/row borders, Status as plain text, keys not linked. A side-by-side with
`mockups/table-report.html` made the gap obvious.

**Fix (implemented):**
- **Table chrome** via a scoped `<style>` block in `TableReport.tsx`
  (`[data-testid="table-report"] …`) rather than Tailwind utilities — the app/Storybook
  load PRECOMPILED Tailwind, so new utilities silently wouldn't apply (MEMORY note).
  Card border+radius, uppercase-subtle header row with a 2px divider, 1px row
  separators + hover, and blue link colour for issue keys — matching the mock's
  `--border #dfe1e6` / `--subtle #626f86` palette.
- **Status → Atlaskit `Lozenge`** (`model/normalizedRenderers.tsx`), coloured from
  `statusCategory` with a label-keyword fallback (To Do→gray, In Progress→blue,
  Done→green, Blocked→red). Wired via a `render` override on the normalized status
  source. Uses the design system rather than the mock's hardcoded hex.

Verified in Storybook against the mock (Flat, Grouped1D) — card/header/rows/lozenges/
links now match.

**Remaining minor deltas (not blocking):** numeric columns aren't right-aligned yet;
issue-type icons are empty in the fixtures (data-driven — `iconUrl` unset in sample
data, real Jira supplies it).

---

## Suggested order

1. **Issue 4 + 3** (normalized-first field sourcing) — unblocks meaningful columns.
2. **Issue 2** (field-load wiring) — so added columns actually populate.
3. **Issue 1** (group-by from shown columns + arrows) — behavior + mock parity.
4. **Issue 5** (final visual polish vs mocks).

Verification will be far easier once spec/013 replay lets us inject a dataset with
real parent/team objects. Until then, extend `TableReport.stories.tsx` fixtures.
