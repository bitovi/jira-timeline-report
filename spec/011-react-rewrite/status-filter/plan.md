# status-filter → React rewrite plan

**Source:** `src/canjs/controls/status-filter.js` (28 lines)
**Custom element:** `<status-filter>`
**Status: DEAD CODE — plan is DELETE, not port.**
**Difficulty: Easy**

## Is it used?

No. `<status-filter>` is registered (`status-filter.js:28`) but the tag is rendered in **zero** places across the entire codebase. The only reference is the side-effect import at `src/timeline-report.js:5`, which merely runs `customElements.define` — nothing ever instantiates the element.

It is coupled 1:1 with `<auto-complete>` (its only child, imported at `status-filter.js:2`), which is dead for the same reason. See `../autocomplete/plan.md`.

## What it does (for reference)

A thin presentational wrapper: takes `statuses` (options) and `selectedStatuses` (chosen) arrays and passes them through to a single `<auto-complete>` for multi-select tag/chip filtering. No routeData, no events, no state of its own. The `param` prop is declared but never referenced.

## CanJS surface

Imports `StacheElement, type, ObservableObject, ObservableArray` — but only `StacheElement` is actually used. `static view` + `static props` with `:from` / `:bind` bindings.

## Replacement

Its intended job (pick a subset of statuses) is **already shipped in React**:

- `src/react/reports/FlowMetrics/ChecklistDropdown.tsx` — live multi-select checklist dropdown, wired to the same route-data params (`flowMetricsStatusFilter`, `timeInStatusStatusFilter`) via `useRouteData`.
- A more feature-complete `StatusFilter.tsx` (adds a Show/Hide toggle, built on `@atlaskit/select`) was already prototyped on branch `origin/TR-206-status-filter-react-equivalent` (compiled artifacts remain in `dist/react/ReportControls/components/Filters/components/StatusFilter/`).

## Steps

1. Confirm nothing renders `<status-filter>` (grep `status-filter` tag — expect only the definition + the timeline-report import).
2. Delete `src/canjs/controls/status-filter.js`.
3. Remove the side-effect import at `src/timeline-report.js:5`.
4. Delete `src/canjs/ui/autocomplete/` in the same pass (see autocomplete plan) — it has no other consumer.
5. Run build + smoke test the app; the status-filter UI need for FlowMetrics/TimeInStatus is already covered by `ChecklistDropdown`.

## Risks / open questions

- **Do we need a true typeahead anywhere?** The dead component was a type-to-filter chip input; `ChecklistDropdown` is a checklist. If a real typeahead is wanted in future, build on `@atlaskit/select` (`isMulti` + `isSearchable`) — but that is net-new product work, not a migration blocker.
