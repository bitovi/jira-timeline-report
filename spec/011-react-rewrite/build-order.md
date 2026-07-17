# React rewrite — leaf component build order

Order for replacing the 5 CanJS leaf StacheElement components (the self-contained UI pieces, ahead of the `timeline-report.js` shell and the `route-data.js` + `useCanObservable` keystone). Ordered by **risk and dependency**: kill dead code first, then the independent live port, then the auth cluster in dependency order.

| #   | Component         | Status                        | Difficulty | Depends on        | Action                            |
| --- | ----------------- | ----------------------------- | ---------- | ----------------- | --------------------------------- |
| 1   | **status-filter** | ✅ Deleted                    | Easy       | —                 | Delete                            |
| 2   | **autocomplete**  | ✅ Deleted                    | Easy       | (deleted with #1) | Delete                            |
| 3   | **table-grid**    | ✅ Ported → `EstimationTable` | Medium-low | —                 | Port                              |
| 4   | **jira-login**    | Live, load-bearing            | Medium     | —                 | Extract auth store + React button |
| 5   | **select-cloud**  | Live (hosted only)            | Medium     | #4                | Port                              |

> **Progress (2026-07-16):** Phases 1 & 2 complete. status-filter + autocomplete deleted; table-grid
> ported to `src/react/reports/EstimationTable/` and registered as `table` in
> `urlParamValuesToReactComponents`. `src/canjs/reports/` is now empty and removed. Next up: Phase 3 (jira-login).

## Phase 1 — Delete dead code (status-filter + autocomplete)

Do these together; they form one dead subtree. `<auto-complete>` is only rendered by `<status-filter>`, and `<status-filter>` is never rendered — both are registered via a side-effect import at `timeline-report.js:5` but never instantiated. Their function (status multi-select) already shipped in React as `ChecklistDropdown`.

- Delete `src/canjs/controls/status-filter.js` and `src/canjs/ui/autocomplete/` (`.js` + demo `.html`).
- Remove the import at `src/timeline-report.js:5`.
- **Leave `src/canjs/ui/simple-tooltip/` alone** — still used by table-grid and select-cloud.
- Zero-risk; removes 2 of 6 elements and shrinks the surface immediately.

Details: `./status-filter/plan.md`, `./autocomplete/plan.md`.

## Phase 2 — Port table-grid (independent)

Self-contained live report with **one consumer** (`timeline-report.js`) and **no routeData/auth coupling**, so it can be done any time — parallel to Phase 1 if desired. Existing React report-mounting infra (`urlParamValuesToReactComponents` + `attachReactReport`) and GanttGrid's row/tooltip helpers make it a clean port.

- Build `EstimationTable.tsx`, reuse GanttGrid's `getChildren.ts` / `rows.ts` / tooltip + modal patterns, port the pure cell-formatting fns.
- Register `'table'` in `urlParamValuesToReactComponents` (`timeline-report.js:41-50`); drop the `{{# eq ... "table" }}` branch (`:97-101`); delete `table-grid.js`.
- Bulk of the effort is re-creating the `EstimateBreakdown` popup markup.

Details: `./table-grid/plan.md`.

## Phase 3 — jira-login (auth store extraction)

Do this **before select-cloud**. The UI is one trivial button, but `isLoggedIn` is consumed as a CanObservable by ~9 downstream places (route-data, timeline-report views, select-cloud, data-requests) and its `isResolved` event **gates whether the whole app mounts** (`main-helper.js:100-134`).

- Extract the auth state machine into an observable store (promote/fix the dead `stateful-data/login.js`).
- Keep `routeData.isLoggedInObservable = value.from(store, 'isLoggedIn')` and the bootstrap gate pointed at the store — the observable contract stays, so the ~9 consumers don't change.
- Replace the StacheElement with a thin React `<LoginButton>` reading the store via `useCanObservable`.

Details: `./jira-login/plan.md`.

## Phase 4 — Port select-cloud (depends on Phase 3)

The header site/cloud picker (hosted web only). Its query gates on `loginComponent.isLoggedIn`, so it wants the clean React-readable auth source from Phase 3.

- React component + `useQuery` on `fetchAccessibleResources` (React Query already present), gated on login.
- Replace the `SimpleTooltip` dropdown with an `@atlaskit` popover (or portal + positioning).
- Preserve `localStorage['scopeId']` + `window.location.reload()` on switch.
- Remove the `querySelector` prop-injection in `main-helper.js:94-98`.

Details: `./select-cloud/plan.md`.

## Dependency graph

```
Phase 1: status-filter ─┐
         autocomplete  ─┘  (delete, zero risk)

Phase 2: table-grid        (independent — any time)

Phase 3: jira-login  ──────▶  Phase 4: select-cloud
        (auth store)                 (needs login source)
```

## After the leaves

Once these 5 are done, 2 of the original 6 StacheElements are deleted and 3 are React. Remaining migration keystones (separate specs):

1. `src/timeline-report.js` — the 599-line app shell (converts near the end; entangled with bootstrap/routing).
2. `src/canjs/routing/route-data/route-data.js` (`ObservableObject` store) + `src/react/hooks/useCanObservable/useCanObservable.ts` bridge — the final swap, after which `src/can.js` can be deleted.

## Notes / open questions

- **Confirm before deleting (Phase 1):** grep the `status-filter` and `auto-complete` tags to re-verify zero live renders at execution time.
- **Keep the observable contract** through Phase 3/4: auth state stays in a CanJS-`value`-compatible store until route-data itself is migrated, so cross-framework consumers keep working.
- `simple-tooltip` is shared infra — retire it only after both table-grid and select-cloud are ported.
