# Selected issue type → From→To hierarchy range

Companion to [`plan.md`](./plan.md) / [`design.md`](./design.md). Covers two related
problems with the current `selectedIssueType` control:

1. **Bug:** removing the `selectedIssueType` URL param doesn't stick — it is
   immediately re-added, which pins the report to a single top hierarchy level and
   "filters" the visible list down to that level.
2. **Feature:** promote issue-type selection to a first-class control **right after the
   Report type selector**, and let it express a **From→To hierarchy range** (à la Jira
   Plans' Hierarchy "From / To"), instead of a single level.

---

## Current behavior (why the param re-adds itself)

`selectedIssueType` is a **derived, self-healing** route-data observable
(`src/canjs/routing/route-data/route-data.js:549-723`). Its resolver:

- Reads the value from (in priority order) the URL param → saved report data → `''`.
- **Waits** for `derivedIssues` to load, then validates the value against the *actual*
  `issueHierarchy` (levels present in the query results, not Jira metadata).
- If there is **no stored value** (or the stored value names a level not present), it
  defaults to the **highest available level** `issueHierarchy[0].name` **and writes it
  back to the URL** (`writeUrlParam(defaultType)`, lines 629-640).

So deleting the param triggers: resolve → "no stored value" → default to top level →
`writeUrlParam` re-adds it. **This is by design** — the current data pipeline *requires*
a single primary level:

```
selectedIssueType                       (route-data.js:549)
  └─> primaryIssueType / secondaryIssueType   (route-data.js:724-729, via toSelectedParts)
        └─> rollupTimingLevelsAndCalculations  (timeline-report-view-model.js:66-83)
              = issueTimingCalculations.slice(indexOf(primaryIssueType))  ← "this level AND BELOW"
              └─> rolledupAndRolledBackIssuesAndReleases  (…:86)
                    └─> groupedParentDownHierarchy         (…:114)
                          └─> primaryIssuesOrReleases = groupedParentDownHierarchy[0]  (…:138)
                                = the ONE top level rendered as rows
```

**Key insight:** `rollupTimingLevelsAndCalculations` already encodes *"the selected type
and everything below it."* In other words, **`selectedIssueType` is already the "From"
(top) of an implicit range whose "To" (bottom) is always the deepest level.** The
requested feature is really: **let the user also cap the "To" (bottom) level.**

### What "filters the list" means to the user

`primaryIssuesOrReleases` is `groupedParentDownHierarchy[0]` — only the **top** level
becomes rows. Reports then reveal lower levels through their own mechanisms
(Gantt `primaryReportBreakdown`, WorkBreakdown cards, EstimationProgress level rollups,
EstimationTable / the new Table's **hierarchy** mode). Defaulting `selectedIssueType` to
the top level is what makes the report "only show Initiatives."

---

## Scope: does any other report benefit? (answering the open question)

- **The "From" already app-wide.** `selectedIssueType` / `primaryIssueType` feeds
  *every* report's pipeline. Reports already consume "selected level **and below**":
  Gantt breakdown, WorkBreakdown, EstimationProgress (`EstimationProgress.tsx:149-191`
  walks levels 1/2/…), EstimateAnalysis (`EstimateAnalysis.tsx:66`), and the Table
  report's hierarchy mode all descend below the primary.
- **The "To" cap is genuinely new.** No report today lets you stop the descent at a
  chosen level — hierarchy/breakdown always goes to the bottom.
- **The Filters panel** (`Filters/components/IssueTypeFilters/IssueTypeFilters.tsx`) has
  issue-type-adjacent toggles (`hideUnknownInitiatives`, releases, semver) but **no
  level-range control**.

**Recommendation:** model the range at the **route-data / pipeline layer** (app-wide
capable, generalizing the existing single-level selector) but **surface the new control
in the Table report's controls first**. Other reports keep the current single "Report on"
selector until they opt in. This avoids a risky big-bang change to every report while
making the underlying data model correct and reusable. See Phase C.

---

## Selection model: From→To range (decided)

Chosen over arbitrary multi-select. Hierarchy levels are inherently **ordered**
(Outcome > Initiative > Epic > Story), and parent→child rollups assume a **contiguous**
chain, so a top/bottom range is the correct primitive. Non-contiguous multi-select
(e.g. Outcome + Epic, skipping Initiative) would break rollup parentage and is out of
scope.

- **From** = top level (rows / primary issues) — this is today's `selectedIssueType`.
- **To** = bottom level the report descends to (defaults to the deepest level =
  today's behavior, so nothing changes unless the user narrows it).
- Optional **"Show full hierarchy"** convenience toggle (matches the screenshot) = set
  To to the deepest level.

---

## Persistence / param design

Constraint from the user: *"we might not be able to use the `selectedIssueType` param,
or we need to change it to optionally support an array."* Since a From→To range is two
ordered endpoints, an ordered pair is cleaner than an array.

**Option A (recommended) — keep `selectedIssueType` as "From", add `toIssueType`.**
- `selectedIssueType` keeps its exact current meaning and self-healing resolver (the
  "From"/primary level). Zero migration; every existing report and saved report keeps
  working; existing URLs are unchanged.
- Add a new optional route-data observable `toIssueType` (the bottom cap). Empty/absent
  = deepest level (current behavior). Validated against `issueHierarchy` the same way,
  and clamped so `To` is never above `From`.
- `rollupTimingLevelsAndCalculations` changes from `slice(fromIndex)` to
  `slice(fromIndex, toIndex + 1)` — the *only* pipeline change.

**Option B — encode a range in `selectedIssueType` itself** (e.g. `Initiative..Epic`).
- Single param, but overloads a value that legacy code, saved reports, and
  `toSelectedParts` parse as a single type + the `Release-` prefix convention. Higher
  regression risk. Rejected unless we want to avoid adding a param.

**Decision to confirm:** Option A. (Array form is only needed for true multi-select,
which we ruled out.)

### Fixing the "re-adds itself" bug under Option A

The re-add is correct *for the required "From" level* — a report must have a primary
level. Two sub-fixes:

1. **"From" (`selectedIssueType`)**: keep defaulting-and-persisting (it's required), but
   make it obvious in the UI that this is a required selector, not a removable filter —
   the new control replaces the sense that it's a deletable URL param.
2. **"To" (`toIssueType`)**: make it *truly optional* — when absent, resolve to the
   deepest level **without writing it back to the URL** (no self-heal persist), so
   "clear the To cap" / "show full hierarchy" leaves a clean URL and does not re-add.
   Only persist `toIssueType` when the user explicitly narrows it.

This gives the user a removable knob (the To cap) while keeping the required From level
stable.

---

## UI — control after Report type

Placement: the shared `ReportControls` row, immediately after `<SelectReportType />`
(`ReportControls/ReportControls.tsx`), the same row the Table controls already live in
(plan §"Control placement"). Reuse the `ReportControlsWrapper` idiom or a bespoke branch.

Two `@atlaskit` dropdowns modeled on the screenshot:

```
Report type [ Table (beta) ▾ ]   Hierarchy  From [ Initiative ▾ ]  To [ Epic ▾ ]
```

- **From** dropdown = the existing `SelectIssueType` behavior (levels + the Releases
  submenu). Keep its release handling (`Release-<secondary>`).
- **To** dropdown = levels **at or below** the From level only (options derived from
  `issueHierarchy` sliced from the From index down). Selecting the deepest level (or a
  "Full hierarchy" item) clears `toIssueType`.
- Options come from `issueHierarchy` (the real, results-based hierarchy already used by
  the resolver) so we never offer a level absent from the data.
- Loading state mirrors current `SelectIssueType` (`isLoading` until `issueHierarchy`).

Do **not** add a second above-table filter bar; this is a top-of-report control, not a
per-column filter (consistent with plan Q6).

---

## Phased plan

### Phase A — Fix the bug + make `toIssueType` a real, optional observable
- Add `toIssueType` to route-data (Option A), validated/clamped against `issueHierarchy`,
  **absent = deepest**, no self-heal write-back when absent.
- Audit the `selectedIssueType` resolver so removing the *To* cap does not re-add it, and
  document why *From* still self-heals.
- Unit tests: resolver defaulting/validation for From (unchanged) and To (optional,
  clamp To ≥ From index, absent ⇒ deepest, no persist on absent).

### Phase B — Pipeline: honor the To cap
- `timeline-report-view-model.js` `rollupTimingLevelsAndCalculations`:
  `slice(fromIndex)` → `slice(fromIndex, toIndex + 1)`; keep the `Release` /
  `secondaryIssueType` branch working (`:72-82`).
- Verify `groupedParentDownHierarchy`, `primaryIssuesOrReleases`, rollups, and the
  Table hierarchy mode all respect the capped range.
- Tests: with To < deepest, lower levels are excluded from rollup/hierarchy; To = deepest
  reproduces today's output exactly (regression guard).

### Phase C — UI control (Table report first)
- Add the From→To control to the Table `ReportControls` branch, after Report type.
- Bind `selectedIssueType` (existing) + `toIssueType` (new) via route-data, matching the
  Grouper/Table binding idiom in `TimelineReport.tsx` baseProps.
- Extend/reuse `SelectIssueType`; add a `SelectToIssueType` (or a combined
  `SelectHierarchyRange`) component. Tests mirror `SelectIssueType.test.tsx`.
- **Do not** change other reports' controls yet — they keep the single selector; the
  pipeline change in Phase B is backward-compatible because absent To = deepest.

### Phase D (optional, later) — Generalize to other reports
- If desired, replace the single "Report on" selector app-wide with the From→To control,
  now that the data model supports it. Gate behind the same rollout discipline as
  plan Phase 7. Out of scope for the initial Table work.

---

## Open questions

1. **Param name / shape.** Confirm Option A + `toIssueType` (vs Option B single-param
   range). Recommended: Option A.
2. **"Show full hierarchy" affordance.** Explicit checkbox (screenshot) or implicit via
   selecting the deepest level in the To dropdown? Recommended: a "Full hierarchy" item
   in the To dropdown that clears `toIssueType` (fewer controls).
3. **Releases + To.** When From = `Release`, what does a To cap mean across the
   `Release-<secondary>` boundary (`route-data.js:613-614`, view-model `:72-82`)? Needs a
   defined rule (likely: To applies to the secondary-and-below chain only).
4. **Saved reports.** Should saved reports capture `toIssueType`? (Same persistence path;
   default absent keeps old saved reports behaving as today.)
5. **App-wide rollout.** Is Phase D wanted, or is the range a Table-only control
   long-term?
