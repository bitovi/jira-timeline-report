# Multi-report ("report of reports") — architecture analysis

Status: **brainstorming / analysis**. This is not a finalized design. It captures
what we learned exploring the codebase, the decisions locked in so far, the
candidate approaches, and one open strategic question (sequencing vs. the React
rewrite). See [explore.md](./explore.md) for the original idea.

---

## 1. What we're building

A saved report that references other saved reports and renders them sequentially
as one long, scrollable/printable **combined deliverable** (e.g. a portfolio
status update across several teams). The main technical problem is **data
fetching** — today the app fetches for exactly one active report — plus giving
each child its own render context for the controls that stay editable.

## 2. Decisions locked in so far

From the clarifying discussion:

- **Primary use: combined deliverable.** One long scrollable/printable document.
  Some interactivity is needed, but child **sources and timing are locked**
  (JQL, child JQL, fields, issue types, timing calculations cannot be changed in
  the multi-report). **Other/view controls stay editable** (grouping, filters,
  display toggles) — when not in full-screen mode.
- **Child edits are ephemeral (v1).** Editing a child's view controls applies for
  the session and is not persisted. Later we may encode per-child overrides in
  the URL keyed by the child's UUID, mirroring today's single-report override
  mechanism.
- **First-class report in the same list.** A multi-report is a normal saved
  report with an extra ordered list of child UUIDs. It appears in the same
  picker / dropdown / `ViewReports` list and reuses all existing
  save/load/select machinery. A new `primaryReportType` value (`multi`) selects
  the renderer.
- **Full report per child.** Each child renders as it does standalone: its
  primary chart **plus** its secondary report (work-breakdown / status summary)
  if configured, under a heading.
- **No nesting (v1).** Children must be single reports; a multi-report cannot
  contain another multi-report. This avoids cycles and unbounded fetch fan-out;
  the picker filters out other multi-reports.

## 3. Relevant architecture (as found)

- **A saved report is minimal:** `{ id, name, queryParams }`, stored in a map
  keyed by `id` under the `saved-reports` storage key
  ([fetcher.ts](../../src/jira/reports/fetcher.ts)). All of a report's config
  lives in the single `queryParams` URL string; there are no separate JQL / view
  / settings fields. Create/update/delete mutations rewrite the whole map
  ([useSaveReports.tsx](../../src/react/services/reports/useSaveReports.tsx)).
- **`routeData` is a singleton.** One active report drives one fetch and one
  roll-up. Which view renders is `routeData.primaryReportType`, mapped to a React
  component in `urlParamValuesToReactComponents`
  ([timeline-report.js:41-50](../../src/timeline-report.js#L41-L50)).
- **The render pipeline is a chain of getters** on `timeline-report.js` that read
  config off `routeData` and call **already-pure functions**
  (`rollupAndRollback`, `calculateReportStatuses`,
  `groupIssuesByHierarchyLevelOrType`):
  `filteredDerivedIssues → rollupTimingLevelsAndCalculations →
rolledupAndRolledBackIssuesAndReleases → groupedParentDownHierarchy →
primaryIssuesOrReleases / planningIssues`
  ([timeline-report.js:182-193](../../src/timeline-report.js#L182-L193),
  [:417-509](../../src/timeline-report.js#L417-L509)).
- **Report components already consume observables**, not `routeData` directly.
  `renderReactReport` builds a `baseProps` bundle of `…Obs` observables and
  passes it to the component; components read them via `useCanObservable`
  ([timeline-report.js:218-265](../../src/timeline-report.js#L218-L265)). The
  secondary report (`WorkBreakdown`) works the same way
  ([:273-290](../../src/timeline-report.js#L273-L290)).

**Implication:** the pipeline logic is already pure; the getters are just wiring
it to the global `routeData`. Feeding a report from a _different_ config +
_different_ issue data is mostly a matter of re-wiring, not rewriting.

## 4. The core challenge

To render N full, independent reports at once, each needs its own config → data →
roll-up context. Today that context is the global `routeData` singleton. The
design has to give each child its own reactive config + data without regressing
the fine-grained recomputation the current single-report path enjoys (see §6).

## 5. Approaches considered

### Approach A — parameterized view-model + shared data layer _(recommended)_

Split the pipeline in two:

- **Shared data layer.** A fetch cache keyed by source `(jql, childJQL, fields)`.
  Collect the distinct sources across all children, fetch each **once** (union
  the `fields` per source so children sharing a JQL share one request), and hand
  the raw issues to whoever needs them. This is the load-time win from
  [explore.md](./explore.md).
- **Per-child view-model.** Extract the getter chain into a reusable, instantiable
  unit (see §6 for why it must stay observable, not a plain function). Each child
  parses its `queryParams` into a config, runs the pipeline against its shared
  issues, and produces the exact `…Obs` bundle the existing report components
  already consume. Editable controls are a small per-child observable seeded from
  `queryParams`; sources/timing are read-only.

**Why recommended:** the roll-up logic is already pure, so extraction is mostly
mechanical. Each child is genuinely live and independent, and the extraction is
the same routeData-decoupling that [spec 011](../011-react-rewrite/) is heading
toward — foundation, not throwaway.

### Approach B — N isolated `RouteData` instances

Instantiate one `RouteData` per child, seeded from its `queryParams`, detached
from the URL, with shared raw issues injected. Reuses the whole existing pipeline
per child with minimal extraction.

**Trade-off:** faster to stand up, but `RouteData` is built as a URL-bound
singleton (`pushStateObservable`, `reportsData`, link builders assume one
global). Running N detached copies is fragile, memory-heavy (N full observable
graphs), and becomes throwaway the moment routeData is migrated in spec 011.

### Approach C — render-and-snapshot compose

Render each child one at a time by swapping the global config, capture the
output, stitch into one document.

**Trade-off:** simplest for pure export, but no live interactivity (fails the
"some controls editable" requirement) and fights React's lifecycle. Only viable
if interactivity were dropped.

**Selected:** Approach A.

## 6. CanJS 6 memoization — why the view-model must stay observable

The bundle is **CanJS 6** (single-file build in
[src/can.js](../../src/can.js); ships `can-define@2.8.1`,
`can-observation@4.2.0`, `can-reflect@1.19.2`; `ObservationRecorder` throughout).
Getters on `StacheElement` / `ObservableObject` compile to **dependency-tracked,
memoized computes**: while bound, a getter caches its value and recomputes _only_
when an observable it actually read during execution changes. These getters are
bound in the render path — `value.from(this, …)` → `useCanObservable` calls
`.on()`, which activates the caching.

Concretely: changing `roundTo` does **not** recompute
`rolledupAndRolledBackIssuesAndReleases` (it never reads `roundTo`); changing a
filter recomputes only from `primaryIssuesOrReleases` **down**, reusing the
cached upstream roll-up.

**Consequence for the design:** extracting the pipeline into a _plain function_
called wholesale would discard this — a full pipeline recompute on every control
tweak, multiplied by N children. So the extraction target is a **reusable
observable `ReportModel`**, not a plain function:

- Its **getters are the pipeline stages**, same logic, still delegating to the
  pure leaf functions, but reading from `this.config.*` and `this.issues` instead
  of the global `routeData`.
- Its **inputs are per-property observables**: a `ReportConfig` observable (typed
  individual props, so dependency tracking stays per-property, not per-blob) plus
  an `issues` observable fed by the shared data layer.
- **Single-report** instantiates one `ReportModel` seeded from the global
  `routeData`; **each child** instantiates its own. Every instance keeps its own
  memoized graph, so a tweak to one child's filter recomputes only that stage,
  only for that child — exactly as today.

This is reusing routeData's _reactivity model_ in a decoupled, instantiable form,
without the URL-binding/singleton/link-builder baggage.

## 7. The routing question (vs. the React rewrite)

The concern raised: should we rewrite everything in React first
([spec 011](../011-react-rewrite/)), which replaces routing — and is React even
up to reproducing the current routing logic?

**Reframe: the "routing" is barely navigation.** It's a single page; everything
is query params. What looks sophisticated is a **reactive, URL-synced,
precedence-resolving config store**. `makeParamAndReportDataReducer`
([state-storage.js:220-310](../../src/canjs/routing/state-storage.js#L220-L310))
gives each property:

1. **Three-level precedence:** URL param → the selected report's stored
   `queryParams` → default
   ([:231-242](../../src/canjs/routing/state-storage.js#L231-L242)).
2. **Typed parse/stringify** per property.
3. **Write-back that omits defaults:** on set, it writes to the URL but drops the
   param when it equals the report's stored value
   ([:299-303](../../src/canjs/routing/state-storage.js#L299-L303)) — so the URL
   only carries _overrides_ relative to the selected report. (This is exactly the
   per-child override mechanism we'd want later.)

**Is React up to it?** Yes — but the right comparison is a state store, not a
router. React Router / TanStack Router solve path→component navigation, which this
app barely uses, and they don't give three-level precedence or per-property
memoized reactivity. The pieces that do:

- **The hard logic is already framework-agnostic** — precedence, parse/stringify,
  omit-default write-back are pure; only the `value`/`resolve`/`listenTo` wrapper
  is CanJS. Port the wrapper, keep the logic.
- **Fine-grained reactivity exists in React-land** via signals
  (`@preact/signals-react`, TanStack Store, or Jotai atoms with selectors). This
  is the piece vanilla `useState`+Context can't do well — likely the real source
  of the worry. The answer is a signals store, not a router.
- **URL sync is small and solved** — `nuqs`, TanStack Router search params, or a
  hand-rolled `URLSearchParams` ↔ store effect. Precedence sits _above_ it.
- **Incremental migration already works** — `useCanObservable` lets React read the
  CanJS store today. Keep the observable _contract_, swap the internals last —
  which is exactly spec 011's plan (routeData is the final keystone).

## 8. Sequencing analysis — does multi-report de-risk the rewrite?

The claim "build multi-report first, it de-risks the rewrite" is **partially**
true and worth stating precisely. The routeData rewrite has ~six risk buckets:

| #     | Risk in the rewrite                                                          | Multi-report de-risks it?                                                    |
| ----- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A** | New store gives **fine-grained memoization** (no perf regression / stale UI) | **Partially** — run N config+model graphs; failures are isolated and visible |
| **B** | Severing the **render pipeline** from the global singleton                   | **Yes, fully** — this is the work                                            |
| **C** | URL two-way sync (pushState ↔ params)                                       | **No**                                                                       |
| **D** | Three-level precedence + omit-default write-back                             | **No**                                                                       |
| **E** | The ~30 typed param definitions (the schema)                                 | **Yes, as a byproduct**                                                      |
| **F** | Rebinding all other consumers (ReportControls, login, …)                     | **No, neutral**                                                              |

**Genuinely de-risked:**

- **B — the biggest coupling.** The render pipeline reading global `routeData` is
  the single largest consumer in the rewrite. Approach A forces it to become an
  instantiable `ReportModel` fed from a non-global source. After multi-report,
  that's done; the rewrite doesn't re-touch it.
- **A — blast radius.** A big-bang routeData rewrite would surface any reactivity
  bug (lost memoization → slow; wrong tracking → stale) across the whole app at
  once. Multi-report exercises the same instantiable-store + memoized-getter
  pattern on N children, where that bug class is isolated and obvious.
- **E — the schema.** `ReportConfig` factors out the property set + parse/stringify
  that the rewritten routeData just wraps. Not re-derived.

**Not de-risked (the important correction):**

- **C and D — URL sync, three-level precedence, omit-default write-back.** v1
  children are ephemeral, seeded from stored `queryParams`, with no URL binding.
  So the exact "sophisticated routing" machinery is untouched by multi-report and
  still has to be proven at rewrite time (or when per-child URL overrides land).

**Caveat on A:** if `ReportConfig`/`ReportModel` are built in **CanJS** (fastest
for v1, since routeData is still CanJS), you prove "instantiable + decoupled +
memoized" but _not_ "a React signals store can do this." Proving the React-store
tech means building the store in signals now, at extra cost — separable from the
multi-report feature.

**Honest bottom line:** multi-report de-risks the _store + render-decoupling_ half
(B, A) and hands you the schema (E) — but not the _URL/precedence_ half (C, D).

## 9. Open question (blocking the rest of the design)

Which worry is actually driving the sequencing decision?

- If it's _"can we decouple rendering and keep fine-grained reactivity in an
  instantiable store?"_ → multi-report de-risks that directly; **build it now
  (Approach A).**
- If it's specifically _"can React reproduce our URL/precedence routing?"_ (C/D)
  → multi-report does **not** touch that; the thing that de-risks it is a
  standalone **spike** (port precedence + URL sync to a signals store and prove
  it), independent of multi-report.

Resolving this decides whether we (a) proceed with the multi-report design on
Approach A, (b) do the routeData rewrite first, or (c) spike the config store
before committing.
