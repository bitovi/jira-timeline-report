# 013 — Loader ideas

Fun, honest loader concepts for the report-loading experience, plus standalone HTML
mocks demonstrating each. The central design constraint: **the total number of issues to
load is an estimate that grows as the load runs.**

## The problem

Today the loading experience is text-only — a white box showing `Loading ...` and, once a
count is known, `Loaded {received} of {requested} issues.` No spinner, no bar, no
percentage (see `src/react/TimelineReport/components/ReportMessages.tsx` →
`LoadingMessage`, gated by `ReportArea.tsx`).

The interesting part is the **growing total**:

- Each fetch calls Jira's `approximate-count` endpoint and _adds_ the result into a shared
  `progress.data.issuesRequested`
  (`src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts`).
- With **Load all children** on, `makeDeepChildrenLoaderUsingNamedFields.ts` recursively
  re-fetches children in batches of 40 at every depth — **each batch adds its own count** —
  so `issuesRequested` climbs as new layers of children are discovered.
- The progress state flows CanJS → React via `useReportLoadingState`
  (`src/react/TimelineReport/hooks/useReportLoadingState.ts`), whose own test asserts the
  "total climbs mid-load" behavior (requested 10→22 while received 3→15).

### Failure modes any design must avoid

1. **Backward jumps.** A naive `received / requested` bar sits at 80%, the loader
   discovers 400 children, and it snaps back to 55%. That reads as "broken."
2. **The frozen counter.** After issues load, changelogs (history) are fetched in bulk
   with **no progress reporting** (default `USE_DIRECT_BULK_CHANGELOG = true`). The
   counter freezes at "Loaded N of N" while real work continues.
   `ProgressData` (`src/jira-oidc-helpers/types.ts`) already has
   `changeLogsRequested` / `changeLogsReceived` fields — the UI just never reads them.

## Guiding principles

- **Never regress.** The indicator only ever moves forward. "Still finding more" is a
  feature, not a regression — surface discovery as motion, not a rollback.
- **Make discovery legible.** The growing total should read as "we found more work,"
  which is honest and reassuring, not alarming.
- **Cover every phase**, including the currently-silent changelog/history phase, so the
  loader never appears stuck.
- **Stay on-brand.** Atlaskit look — Atlassian blue and neutral grays (the app uses
  `@atlaskit` pervasively; Tailwind mimics it).

## The lifecycle the mocks simulate

All four mocks run the **same** simulated lifecycle so they're directly comparable:

| Phase         | requested                   | received   | note                                  |
| ------------- | --------------------------- | ---------- | ------------------------------------- |
| `estimating`  | 0 → **342**                 | 0          | approximate-count for the root JQL    |
| `loading`     | 342                         | 0 → 342    | root issues stream in                 |
| `discovering` | **342 → 822 → 1132 → 1282** | 342 → 1282 | 3 waves of children; total jumps up   |
| `history`     | 1282                        | 1282       | changelog phase — indeterminate today |
| `building`    | 1282                        | 1282       | normalize + derive + render           |
| `done`        | 1282                        | 1282       | report appears                        |

The `discovering` phase is where the total jumps **up twice** while received is still
climbing — the exact moment a naive bar would go backwards.

## The four concepts

### A — Momentum bar + live count (`mocks/momentum.html`)

A big rolling issue count is the hero. The slim bar is deliberately **decoupled from the
jumpy `received / requested` ratio** — it's driven by the _volume loaded_ via an
asymptotic curve (`1 - e^(-received/k)`) that approaches, but never reaches, full until
the load is truly done. A subtle caption names the current activity ("Discovering
children…", "Loading history…").

- **Growing total:** because the bar depends only on `received` (which only ever grows), a
  jump in `requested` can't move it backward — it just keeps climbing. The growing total
  is told honestly by the number ("453 of ~822 found"), not by a bar fighting itself. This
  also avoids the naive-ratio trap where the bar hits ~100% after the first phase and then
  looks stuck-near-done for the rest of the load.
- **Tradeoffs:** calmest and most honest; low effort; less explicit about _what_ is
  happening than the stepper.

```
        1,284
     issues loaded
  ████████████████░░░░░░░   (eases, never regresses)
  Discovering children…
```

### B — Phased stepper (`mocks/stepper.html`) ★ chosen direction

Three phases — the ones that actually take time and mean something to a user:
**Loading primary work items → Loading children → Loading history.** Each shows its own
spinner/checkmark and a sub-count. The fast/invisible phases fold in: the
approximate-count estimate into "primary," and normalize/derive/render into the tail of
"history." (The full five-phase lifecycle above is still simulated under the hood; the
stepper just maps it to these three visible steps.)

- **Growing total:** it's scoped to **Loading children** — the child sub-count climbs and
  its "~N found" estimate grows only within that step, so it never rewinds a finished step.
  Child counts are shown relative to the children themselves (received/requested minus the
  342 primary items), so the step reads honestly.
- **Tradeoffs:** informative and reassuring during long loads; needs the changelog-progress
  plumbing (`changeLogsRequested/Received`, already on `ProgressData`) to make the "Loading
  history" step truthful rather than time-boxed.

```
  ✓ Loading primary work items   342 work items
  ⣾ Loading children             474 of ~790 found
  ○ Loading history
```

### C — Discovery tail (`mocks/discovery-tail.html`)

A single bar = a solid "loaded" segment + a shimmering indeterminate **tail that
lengthens** as `requested` grows. The moving goalpost _is_ the visual.

- **Growing total:** literally shown — the tail extends when children are discovered, so
  the denominator growing looks intentional and alive.
- **Tradeoffs:** the clearest single-visual explanation of the growing total; one compact
  element; the shimmer can feel busy if overdone.

```
  ██████████████│▒░▓▒░ ▓▒░   ← shimmer tail lengthens as more is found
  1,284 loaded · still finding more
```

### D — Report / hierarchy reveal (`mocks/hierarchy-reveal.html`) ★ favorite

Because this _is_ a timeline/hierarchy tool, show a skeleton timeline whose epic rows
appear and fill with real bars as issues load; story rows slide in during the discovery
waves. Progress is implied by the report materializing in front of you.

- **Growing total:** discovering children = new nested rows appearing — the growth is the
  content, not a number fighting itself.
- **Tradeoffs:** most delightful and most on-brand; highest build effort; the "how far
  along am I" signal is more felt than precise (pair with a small count if needed).

```
  ▸ EPIC    ███████░░░░
    ├ Story  █████
    └ Story  ▓▒░  (appearing…)
  ▸ EPIC    ███░░░  (discovering children…)
```

## Recommendation

- **B (three-phase stepper)** — **chosen direction.** Legible and reassuring, and the
  growing total is cleanly scoped to the "Loading children" step. Slimmed to just
  primary / children / history.
- **D** for delight / product fit — could be layered on later if we want the report to
  visibly build itself.
- **A** and **C** remain useful references for the "never regress" bar mechanics.

## Mapping the mocks to real data

Each mock is driven by a small simulation emitting `{ phase, requested, received }`,
which maps directly onto the real pipeline:

- `requested` ↔ `ProgressData.issuesRequested` (grows via `approximate-count` accumulation).
- `received` ↔ `ProgressData.issuesReceived`.
- `phase` is derived: `estimating`/`loading`/`discovering` all come from the existing
  issues-fetch progress; `history` and `building` are **not yet reported** and would
  require plumbing `changeLogsRequested/Received` (already on `ProgressData`) and a
  post-fetch/derive signal up through `useReportLoadingState`.
- A React port would consume `useReportLoadingState` and apply the same "never regress"
  easing/clamping shown in the mocks.

## Out of scope (follow-ups)

- Wiring a chosen concept into the real React app / `useReportLoadingState`.
- Plumbing real changelog + build progress into the UI so `history`/`building` phases are
  truthful rather than time-boxed.

## The mocks

Standalone — open directly in a browser, no build/network needed:

- `mocks/momentum.html`
- `mocks/stepper.html`
- `mocks/discovery-tail.html`
- `mocks/hierarchy-reveal.html`

Each has **Replay** and a **speed** control (1× / 4× / instant) to re-watch the
growing-total moment.
