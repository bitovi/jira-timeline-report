# 013 — Loader implementation plan

Replace the text-only report loader (`LoadingMessage`: "Loaded X of Y issues.") with the
**three-step concurrent-meter stepper** from `spec/013-loader/mocks/stepper.html`, and add
the backend + bridge plumbing it needs.

Read first: `spec/013-loader/loader-ideas.md` (concept B, the chosen direction) and
`spec/013-loader/mocks/stepper.html` (the exact visual + step logic to port).

## Context

The report loader is text-only today and the changelog phase reports no progress. We're
adopting the **phased stepper** (concept B), slimmed to three phases:

1. **Loading primary work items** — the root-JQL issues
2. **Loading children** — deep-children discovery (this is where the _total grows_)
3. **Loading history** — changelog (history) fetch

**Chosen model: concurrent meters (not strictly gated).** Each step shows its own live
progress and checks off when its own metric completes. This is required because of the
pipeline reality below.

### Pipeline reality (why concurrent, not sequential)

The active loader is `makeDeep( fetchAllJiraIssuesWithJQLAndFetchAllChangelog )`
(`src/jira-oidc-helpers/index.ts:105`). `rootMethod` fetches **issues _and_ their
changelogs in the same call** (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts`):
approximate-count → paginate issues → bulk-fetch _those_ issues' changelogs. The
deep-children loader calls `rootMethod` for the root, then again per 40-parent batch
(concurrently) for children. So **changelog work is interleaved through the whole load** —
"history" is not a trailing phase. The stepper therefore renders three independent live
meters; "Loading history" fills alongside "Loading children" and completes when the whole
request resolves.

`progress.data` is a single shared object across every recursive/concurrent call; totals
are accumulated (`+=`), which is why `issuesRequested` grows as children are discovered.
It already flows to React: `state-helpers.js` sets `progressData.value = { ...received }`
(spreads all fields), and `useReportLoadingState` reads fields off
`derivedIssuesRequestData.progressData.value.*`. So new fields flow through with no
`state-helpers.js` / `route-data.js` change — **verify this spread carries the new
fields; do not assume.**

## Changes

### 1. `src/jira-oidc-helpers/types.ts` — add a phase to `ProgressData`

```ts
export type LoadProgressPhase = 'primary' | 'children';

export type ProgressData = {
  issuesRequested: number;
  issuesReceived: number;
  changeLogsRequested: number;
  changeLogsReceived: number;
  keysWhoseChildrenWeAreAlreadyLoading: Set<string>;
  phase?: LoadProgressPhase; // NEW — undefined in the no-children path
};
```

Keep it **optional** so existing `ProgressData` literals (the two init blocks, tests)
don't break. "history" is _not_ a phase value — it's derived from the changelog counts.

### 2. `src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts` — set the phase

In `fetchAllDeepChildren` (~lines 71-97):

- Add `phase: 'primary'` to the `progress.data = progress.data || { ... }` init object
  (~line 79).
- Immediately before `const parentIssues = await rootMethod(newParams, progress);`
  (~line 86): `if (progress.data) progress.data.phase = 'primary';`
- Immediately before `const allChildrenIssues = await fetchDeepChildren(...)` (~line 89):
  `if (progress.data) { progress.data.phase = 'children'; progress(progress.data); }`

The shared `progress.data` means all concurrent/recursive child `rootMethod` calls keep
`phase === 'children'`. The base `fetchAll...Changelog` init uses `progress.data || {...}`
so it won't clobber the phase set here.

### 3. `src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts` — write changelog counts

In the `USE_DIRECT_BULK_CHANGELOG` branch (~lines 105-117), before firing the batches add
this call's issue count to `changeLogsRequested`, and increment `changeLogsReceived` as
each batch resolves (batch-granular is fine):

```ts
if (USE_DIRECT_BULK_CHANGELOG) {
  const batches = chunkArray(allIssues, 1000);
  if (progress.data) {
    progress.data.changeLogsRequested = (progress.data.changeLogsRequested || 0) + allIssues.length;
    progress(progress.data);
  }
  const changelogMaps = await Promise.all(
    batches.map((batch) =>
      fetchBulkChangelogs(config, { issueIdsOrKeys: batch.map((i) => i.id) }).then((m) => {
        if (progress.data) {
          progress.data.changeLogsReceived = (progress.data.changeLogsReceived || 0) + batch.length;
          progress(progress.data);
        }
        return m;
      }),
    ),
  );
  // ...unchanged: build changelogMap, map issuesWithCompleteChangelogs...
}
```

Accumulating (`+=`) across every root/child call means the history total grows in step
with discovery — consistent with the theme. Leave the `else` (inline-changelog) branch
alone; it's the non-default path.

### 4. `src/react/TimelineReport/hooks/useReportLoadingState.ts` — expose new fields

Extend `ReportLoadingState`:

```ts
export interface ReportLoadingState {
  status: 'idle' | 'pending' | 'resolved' | 'rejected';
  issuesRequested?: number;
  issuesReceived?: number;
  changeLogsRequested?: number;
  changeLogsReceived?: number;
  phase?: 'primary' | 'children';
  rejectReason?: any;
}
```

Add three more observables following the **exact existing pattern** (`value.from(rd, '...')`

- `useCanObservable`), reading:

* `derivedIssuesRequestData.progressData.value.phase`
* `derivedIssuesRequestData.progressData.value.changeLogsRequested`
* `derivedIssuesRequestData.progressData.value.changeLogsReceived`

Return them alongside the existing fields. Keep the promise-status `useEffect` as is.

### 5. New `LoadingProgress` stepper component + wire into `ReportArea`

Create `src/react/TimelineReport/components/LoadingProgress/LoadingProgress.tsx` — a
**presentational** component that renders the three-step stepper. Port structure, states,
and animations from `mocks/stepper.html`, translated to the app's styling conventions
(**Tailwind classes that mimic Atlaskit**, matching existing components — see the
`design-system-atlaskit` memory; reference `components/Skeleton/Skeleton.tsx` for
`animate-pulse`, and existing color/spacing class usage). Visual spec from the mock:

- circle per step: **empty gray ring** (pending), **empty blue ring** (active — no
  spinner), **green filled + check** (done); connector line between circles (green when the
  step above is done).
- label + right-aligned sub-count; a thin sub-bar under the **active** step (determinate
  fill for primary/children; indeterminate shimmer for history while its total is unknown).

**Props (presentational, fully testable):**

```ts
interface LoadingProgressProps {
  status: 'pending' | 'resolved' | ...;   // or a subset; enough to compute done-ness
  phase?: 'primary' | 'children';
  issuesRequested?: number;
  issuesReceived?: number;
  changeLogsRequested?: number;
  changeLogsReceived?: number;
  /** primary issue counts captured at the primary→children transition (see below) */
  primaryReceived?: number;
  primaryRequested?: number;
}
```

**Primary vs. children split.** `issuesRequested/Received` are _global cumulative_ (primary

- children). To show per-step counts, snapshot the primary totals at the moment `phase`
  first becomes `'children'` (parents are fully loaded then, so `issuesReceived` == parent
  count and `issuesRequested` == parent approximate-count). Do the snapshot in a small
  **container** (or a `useRef` in `TimelineReport`) that reads `useReportLoadingState`, keeps
  the primary snapshot, resets it when a new load starts (status → pending / promise
  changes), and passes both the live state and the snapshot into the presentational
  component. Then:

* primary counts: before children → `issuesReceived` of `issuesRequested`; after → snapshot.
* children counts: `issuesReceived - primaryReceived` of `issuesRequested - primaryRequested`.
* history counts: `changeLogsReceived` of `changeLogsRequested` (global).

**Step states (concurrent-meter rules):**

- **primary**: `done` when `phase === 'children'` or `status === 'resolved'`; else `active`.
- **children**: **hidden** unless children are being loaded (i.e. `phase === 'children'`
  has been observed — track a "sawChildren" flag; in the no-children path phase stays
  undefined → 2 visible steps). When shown: `active` while `phase === 'children'` and
  pending; `done` when resolved.
- **history**: `active` while pending and `changeLogsRequested > 0` (show "waiting…" before
  that); `done` when `status === 'resolved'`.

Wire into `src/react/TimelineReport/components/ReportArea.tsx`: replace the
`<LoadingMessage .../>` in the `{jql && pending && ...}` branch (line ~51) with the new
`LoadingProgress` (fed from `loadingState` + the primary snapshot). Keep the existing
outer white box layout (`my-2 p-2 h-780 ... color-bg-white`). Leave `LoadingMessage` in
`ReportMessages.tsx` (unused is fine, or remove its usage only) — keep the other messages.

### 6. Stories + tests

- Add `LoadingProgress.stories.tsx` (credential-free, like `ReportMessages.stories.tsx`)
  with stories for: primary loading, children loading (growing total), history filling
  concurrently, no-children (2 steps), and resolved/all-done.
- Add a unit test for the step-state logic (pending vs done, children hidden when no phase,
  primary/children count split).
- Extend `useReportLoadingState.test.tsx` to assert the new fields (phase + changelog
  counts) surface.

## Verification

- `npm run build` (typecheck) passes; the full test suite passes (`npm test` or the repo's
  configured runner — check `package.json`).
- Storybook renders `LoadingProgress` in all states (credential-free check). **Run
  `npm run build:css` first** — the app + Storybook load a prebuilt `dist/production.css`,
  so new Tailwind classes are invisible until it's regenerated (`npm run dev`/`build` do
  this automatically; `tsc`/`vitest` do not). Also avoid two conflicting same-property
  utilities on one element (e.g. base `bg-white` + state `bg-green-400`) — Tailwind
  precedence is by stylesheet order, not className order.
- End-to-end (needs Jira creds — use the `launch-dev` agent or ask the user): load a report
  with **Load all children** on and confirm: primary count fills → a "Loading children"
  step appears and its total grows → "Loading history" fills concurrently → all three check
  off and the report renders. Confirm no step ever counts backward. Also confirm a
  **Load all children = off** report shows just two steps (primary + history).

## Out of scope

- The `USE_DIRECT_BULK_CHANGELOG = false` (inline-changelog) branch progress.
- Per-page (sub-batch) changelog granularity — batch-granular is enough.
- Concepts A / C / D (kept as references in `mocks/`).
