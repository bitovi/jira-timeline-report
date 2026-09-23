# 036 — Load all blockers recursively

The Sources tab has exactly one expansion option today: **Load all children of JQL specified issues**
(`loadChildren` + optional `childJQL`). It takes the issues the root JQL returned, batches their keys
40 at a time into `parent in (K1, …, K40) <childJQL>`, and recurses until a level comes back empty
([`makeDeepChildrenLoaderUsingNamedFields.ts:37-85`](../../src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts)).

This spec adds a sibling: **Load all blockers recursively of JQL specified issues**
(`loadBlockers` + optional `blockerJQL`), walking "is blocked by" links upstream. It ships behind a
Features-tab toggle.

The interesting half is not the fetching — it is that a **blocker graph is genuinely cyclic** where a
parent tree is not. Jira happily lets you record `A` is blocked by `B` is blocked by `C` is blocked by
`A`. §3 is the load-bearing section.

---

## Context

The app already computes `linkedBlockedBy`
([`linked-issue.ts:99-102`](../../src/jira/linked-issue/linked-issue.ts)) by **inverting the `blocks`
direction in memory** across the loaded result set:

```ts
issue.linkedBlocks = issueBlocks;
issue.linkedBlocks.forEach((blocker) => {
  blocker.linkedBlockedBy.push(issue);
});
```

Nothing ever reads the inward direction off the API. The consequence: **a blocker that the root JQL
did not return is invisible.** AutoScheduler's critical-path trace
([`critical-path-trace.ts`](../../src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts))
and its blocker arrows ([`svg-blockers.ts:98-99`](../../src/react/reports/AutoScheduler/svg-blockers.ts))
silently under-report whenever the thing holding up your work lives outside your JQL — which, for a
team-scoped JQL blocked by another team, is the common case.

This feature closes that gap by actually fetching the missing upstream issues.

---

## Decisions (locked with Arthur)

| Decision                        | Choice                                                                                 | Why                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Direction                       | **"is blocked by" only** — walk upstream                                               | The asked-for semantics; "what is holding this up" |
| Interaction with `loadChildren` | **Full closure** — children of blockers load, blockers of children load, to a fixpoint | §2 shows this falls out of composition for free    |
| `blockerJQL` filter             | **Yes**, mirroring `childJQL`                                                          | Consistency with the existing control              |
| Bounding                        | **Seen-set only** — no depth or issue cap                                              | Matches the children loader. §3                    |
| Rollout                         | **Features-tab toggle**, `onByDefault: false`                                          | §5                                                 |
| Flag scope                      | Gates the **UI control only**; a URL carrying `loadBlockers=true` still loads          | §5. Matches the flagged-off-report precedent       |
| Sample-data fixture             | **Out of scope**                                                                       | §8                                                 |

---

## 1. There is no discovery query — the link data is already in hand

`CORE_FIELDS` ([`core-fields.ts:8-20`](../../src/stateful-data/core-fields.ts)) already includes
`'Linked Issues'`, the display name of the `issuelinks` system field
([`bitovi-training-fields.json:948-961`](../../src/examples/bitovi-training-fields.json)). It is
folded into every request at
[`jira-data-requests.js:114`](../../src/stateful-data/jira-data-requests.js). **Every issue we fetch
already carries its links.**

So a blocker pass is: _read keys off the issues we have → fetch those keys → repeat_. We do not need
JQL's `linkedIssues()` function — which takes a single issue key and so would not batch anyway.

Direction, precisely: on issue `X`, a link entry carrying `inwardIssue: Y` reads "X **is blocked by**
Y" (`type.inward === 'is blocked by'`); an entry carrying `outwardIssue` reads "X **blocks** …". We
want the `inwardIssue` entries — exactly the ones `getBlockingKeys`
([`linked-issue.ts:69-77`](../../src/jira/linked-issue/linked-issue.ts)) discards.

```ts
function blockerKeysOf(issue: Issue): string[] {
  const links = issue.fields['Linked Issues'] ?? issue.fields.issuelinks ?? [];
  return links.filter((l) => l?.type?.name === 'Blocks' && l.inwardIssue).map((l) => l.inwardIssue.key);
}
```

Match on `type.name === 'Blocks'` rather than the `inward` description string, to stay consistent with
[`linked-issue.ts:73`](../../src/jira/linked-issue/linked-issue.ts) and
[`link-issues.ts:155`](../../src/react/reports/AutoScheduler/scheduler/link-issues.ts), which both key
off that name. If those ever move to a configurable link type, this moves with them.

---

## 2. Full closure falls out of composition

The children loader is a decorator: `makeDeep(rootMethod) → rootMethod'`
([`index.ts:124-152`](../../src/jira-oidc-helpers/index.ts)). Give the blocker loader the same shape
and the four UI states become four compositions:

| `loadChildren` | `loadBlockers` | loader                                     |
| -------------- | -------------- | ------------------------------------------ |
| ✗              | ✗              | `flat`                                     |
| ✓              | ✗              | `makeDeepChildren(flat)`                   |
| ✗              | ✓              | `makeDeepBlockers(flat)`                   |
| ✓              | ✓              | `makeDeepBlockers(makeDeepChildren(flat))` |

In the last row every blocker batch is fetched **through** the children loader, so blockers' children
load automatically; and blocker extraction runs over everything returned, children included, so
children's blockers load automatically. The fixpoint is the nesting — no bespoke alternating loop.

Both candidate inner loaders are the `…UsingNamedFields` variants, so the blocker loader receives
issues keyed by display name and reads `fields['Linked Issues']` directly. It needs no
`fieldsRequest` of its own, and no `mapIdsToNames` round trip.

---

## 3. Cycles

`A` blocked by `B` blocked by `C` blocked by `A` must terminate, and must not re-fetch. The mechanism
is a `Set<string>` on `progress.data`, mirroring `keysWhoseChildrenWeAreAlreadyLoading`
([`makeDeepChildrenLoaderUsingNamedFields.ts:11-18`](../../src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts))
but as a **separate set** — "already expanded for children" and "already requested as a blocker" are
different questions and conflating them would suppress legitimate fetches.

The invariant is **"every key we already have, or have already asked for."** Three rules maintain it:

1. **Seed with the root issues' keys** before the first round, so the cycle's entry point is never
   re-fetched. In the composed case the root call returns the whole child cascade too, so all of
   those keys seed as well.
2. **Add candidates at filter time, before the fetch is issued** — not after it resolves. A key
   filtered out by `blockerJQL`, deleted, or not visible to the user returns no issue. If we only
   recorded what came back, that key would be re-requested every round, forever. This rule is what
   makes the loop terminate in the presence of unresolvable links.
3. **Add every returned issue's key**, not only the ones we asked for. Each round's fetch goes through
   the inner loader, which also returns each blocker's descendants. Those were never "requested" as
   blockers, so without this rule a child that later turns up as somebody's blocker is fetched a
   second time. Not an infinite loop — it enters the set on that pass — but a wasted round-trip and a
   weaker invariant.

**Termination.** Each round's candidates are `blockerKeys(frontier) \ seen`, deduped, and every
candidate enters `seen` before any request goes out. `seen` grows monotonically over a finite universe
of issue keys, so the loop stops the first round it is empty.

Worked cases:

| graph                   | trace                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `A → B → C → A`         | r1 seen `{A}`, fetch `{B}` · r2 fetch `{C}` · r3 candidate `{A}` ∈ seen → stop |
| self-link `A → A`       | r1 candidate `{A}` ∈ seen → stop immediately                                   |
| 2-cycle `A ⇄ B`         | r1 fetch `{B}` · r2 candidate `{A}` ∈ seen → stop                              |
| diamond `A → {B,C} → D` | r1 fetch `{B,C}` · r2 `D` deduped within the round, fetched once · r3 stop     |

What is **not** bounded: total breadth. A cycle cannot hang the load, but a densely-linked instance
can still pull in a large connected component. That is the accepted trade (see Decisions), and it is
the same posture the children loader already takes.

---

## 4. The loader

New file `src/jira-oidc-helpers/makeDeepBlockersLoaderUsingNamedFields.ts`, structured after its
children counterpart. Reuses [`chunkArray`](../../src/utils/array/chunk-array.ts) and
[`uniqueKeys`](../../src/utils/array/unique.ts).

```
makeDeepBlockersLoaderUsingNamedFields(config) → (rootMethod) → async (params, progress) => {
  ensure progress.data exists            // the flat rootMethod never creates it
  progress.data.expandsBlockers = true
  const rootIssues = await rootMethod(params, progress)
  const seen = progress.data.keysAlreadyRequestedAsBlockers   // seeded with rootIssues keys — rule 1
  let frontier = rootIssues, all = [...rootIssues]
  while (frontier.length) {
    const candidates = unique(frontier.flatMap(blockerKeysOf)).filter(k => !seen.has(k))
    candidates.forEach(k => seen.add(k))       // BEFORE the fetch — rule 2
    if (!candidates.length) break
    const fetched = (await Promise.all(
      chunkArray(candidates, 40).map(batch => fetchBlockerBatch(batch, params, progress))
    )).flat()
    fetched.forEach(i => seen.add(i.key))      // descendants we never asked for — rule 3
    all.push(...fetched); frontier = fetched
  }
  return uniqueKeys(all)
}
```

`fetchBlockerBatch` builds `key in (${keys.join(', ')}) ${params.blockerJQL || ''}` and calls
`rootMethod({ ...params, jql, skipApproximateCount: true }, progress)` — same `skipApproximateCount`
rationale as the child batches
([`makeDeepChildrenLoaderUsingNamedFields.ts:41-43`](../../src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts)).

**One resilience measure, worth the ~15 lines.** Unlike `parent in (…)`, JQL `key in (…)` _errors_ on
a key that does not resolve — a deleted issue, a stale link — which would take down the whole 40-key
batch. On a rejected batch, bisect once and retry the halves, dropping a half that still fails at
size 1. Cover it with a test.

`uniqueKeys` keeps the **first** occurrence, so an issue reachable both as a child and as a blocker
keeps whichever copy was fetched first. Harmless: both fetches request the same field set.

### Types

- [`src/jira-oidc-helpers/types.ts`](../../src/jira-oidc-helpers/types.ts) — add to `ProgressData`:
  `keysAlreadyRequestedAsBlockers: Set<string>`, plus `expandsChildren?: boolean` /
  `expandsBlockers?: boolean` (§6). Add `blockerJQL?: string` to `Params`.
- [`src/jira/shared/types.ts:64-68`](../../src/jira/shared/types.ts) — **`IssueLink` has no
  `inwardIssue`.** Add `inwardIssue?: { id; key; fields: { summary } }` and make `outwardIssue`
  optional. This breaks narrowing in the two existing readers
  ([`linked-issue.ts:73-75`](../../src/jira/linked-issue/linked-issue.ts),
  [`link-issues.ts:155-160`](../../src/react/reports/AutoScheduler/scheduler/link-issues.ts)), which
  do `.filter(l => … && l.outwardIssue)` then `.map(l => l.outwardIssue.key)` — TS does not narrow
  through `filter`. Convert both to `flatMap(l => l.outwardIssue ? [l.outwardIssue.key] : [])`. The
  two functions are byte-for-byte duplicates; extracting one shared helper here is a reasonable bonus.

---

## 5. The feature toggle

Append one entry to `nonReportsFeatures` in
[`src/configuration/features.ts:10-30`](../../src/configuration/features.ts) — for a non-report flag
that is the **entire** plumbing change. `FeatureFlags` is `typeof defaultFeatures`, a derived
`Record<string, boolean>` ([`fetcher.ts:4-11`](../../src/jira/features/fetcher.ts)), so there is no
hand-maintained union to extend, and `Features.tsx:38-53` renders the list generically.

```ts
// Gates the Sources tab's "Load all blockers recursively" checkbox. The loader itself always
// ships; a URL that already carries `loadBlockers=true` keeps working with the flag off, the
// same way a flagged-off report still renders when the URL names it.
// See spec/036-load-blockers-recursiveley.
{
  name: 'Recursive Blockers',
  subtitle: 'Load the work items blocking your JQL results, transitively.',
  featureFlag: 'recursiveBlockers',
  onByDefault: false,
},
```

Flag name is `recursiveBlockers`, deliberately **not** `loadBlockers` — the latter is the route-data
param, and two different things sharing a name across two stores would be a trap.

**Read site.** In [`IssueSource.tsx`](../../src/react/SettingsSidebar/components/IssueSource/IssueSource.tsx),
`const { features } = useAsyncFeatures();` and render `<LoadBlockers />` only when
`features?.recursiveBlockers`. Use the **non-suspense** `useAsyncFeatures`
([`useFeatures.ts:18`](../../src/react/services/features/useFeatures.ts)), matching
[`SettingsSidebar.tsx:26`](../../src/react/SettingsSidebar/SettingsSidebar.tsx) — which also confirms
this subtree already has the `StorageProvider` ancestor `useStorage()` requires. Verify that at
implementation time rather than assuming it.

**Scope of the gate.** The flag hides the control; it does not gate `getRawIssues`. Feature flags live
in app storage, not route data ([`route-data.js`](../../src/canjs/routing/route-data/route-data.js)
has no `features` prop), so reaching them from the CanJS request layer would mean a module-level
global seeded at bootstrap. The precedent runs the other way:
[`SelectReportType.tsx:43-46`](../../src/react/ReportControls/components/SelectReportType/SelectReportType.tsx)
documents that a flagged-off report still renders if the URL names it. Same posture here — and it
lets the team dogfood by URL before flipping the toggle on.

Note flags are **per install, not per user** (a Connect app property, or the shared configuration
issue), and `useUpdateFeatures` does a full `window.location.reload()` on write.

---

## 6. Wiring `loadBlockers` / `blockerJQL`

Mirrors `loadChildren` / `childJQL` exactly. In dependency order:

| File                                                                                                       | Change                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`route-data.js:241`](../../src/canjs/routing/route-data/route-data.js)                                    | `loadBlockers: saveJSONToUrlButAlsoLookAtReport_DataWrapper('loadBlockers', false, Boolean, booleanParsing)` + `blockerJQL` mirroring `childJQL:242`                                   |
| `route-data.js:300-313`                                                                                    | add both to the `rawIssuesRequestData` bag                                                                                                                                             |
| [`route-data/types.ts:11,14`](../../src/canjs/routing/route-data/types.ts)                                 | `loadBlockers: boolean; blockerJQL: string;`                                                                                                                                           |
| [`state-helpers.js:29,39-42`](../../src/canjs/controls/timeline-configuration/state-helpers.js)            | destructure the observables, pass `.value`                                                                                                                                             |
| [`jira-data-requests.js:100,120-133,145`](../../src/stateful-data/jira-data-requests.js)                   | destructure; `blockerJQL: blockerJQL ? ' and ' + blockerJQL : ''` (same `' and '` convention as `:122`); replace the binary loader ternary with the §2 table; extend the cache-key bag |
| [`raw-issues-cache-key.ts:17-22,36-38,63-73`](../../src/stateful-data/raw-issues-cache-key.ts)             | add to `QueryKeyInput`, append to the `queryKeyOf` positional tuple                                                                                                                    |
| [`ChildReportConfig.js:114,482-496`](../../src/react/reports/ReportOfReports/model/ChildReportConfig.js)   | `CHILD_PARAMS` entries (`boolean()` / `string()`) + the child's `rawIssuesRequestData`                                                                                                 |
| [`childParams.js:25,30-35`](../../src/react/reports/ReportOfReports/model/childParams.js)                  | `parseChildQuery` + its JSDoc return type                                                                                                                                              |
| [`childQueryGroups.ts:101-102,136-138`](../../src/react/reports/ReportOfReports/model/childQueryGroups.ts) | **both** `queryKeyOf` call-sites — missing one silently splits dedupe from the request cache                                                                                           |
| [`jira-oidc-helpers/index.ts:124-152`](../../src/jira-oidc-helpers/index.ts)                               | build `makeBlockers` and register the two composed helpers **after** `makeFieldsRequest`, matching the existing re-bind block                                                          |

Verified **not** needed: [`migrations.ts`](../../src/jira/reports/migrations/migrations.ts) (an absent
param resolves to its default via `makeParamAndReportDataReducer`, and
`secondary-report-to-inline-document` carries non-page params wholesale),
[`raw-issues-cache.ts`](../../src/stateful-data/raw-issues-cache.ts) (keyed on the opaque string),
[`storedQueryParams.ts`](../../src/react/SaveReports/storedQueryParams.ts) (`routeData.serialize()` is
generic).

[`scripts/atlassian-connect/index.ts:105`](../../scripts/atlassian-connect/index.ts) — **skip.**
`childJQL` is already absent from the deeplink param list, so the precedent is that not every route
param earns a Connect slot, and adding one needs a coordinated descriptor redeploy.

[`buildExploreUrl.ts:11-12`](../../src/react/reports/WorkBreakdown/helpers/buildExploreUrl.ts) and its
un-extracted duplicate in
[`IssueTooltip.tsx:15-16`](../../src/react/reports/GanttReport/GanttGrid/components/IssueTooltip/IssueTooltip.tsx)
build a focused single-issue explore URL from the _current_ URL, so they would inherit
`loadBlockers=true`. Set `loadBlockers=false` and `blockerJQL=''` explicitly in both, mirroring how
they already reset `childJQL`.

### UI

New `src/react/SettingsSidebar/components/IssueSource/components/LoadBlockers/{LoadBlockers.tsx,index.ts}`,
copied from
[`LoadChildren.tsx`](../../src/react/SettingsSidebar/components/IssueSource/components/LoadChildren/LoadChildren.tsx)
(Atlaskit `Checkbox` + `Label` + `JqlEditor`, sub-field revealed when checked). Label: **"Load all
blockers recursively of JQL specified issues"**; caption: "Optional blocker JQL filters". Do not copy
the unused `Accordion` import at `LoadChildren.tsx:8`.

- `IssueSource.tsx:46-51` — render between `<LoadChildren />` and `<ExcludedStatusSelect />`, gated per §5.
- [`useJQL.ts`](../../src/react/SettingsSidebar/components/IssueSource/hooks/useJQL/useJQL.ts) — four
  edits mirroring `loadChildren`: seed (`:10`), `useState` (`:15`), `routeData.assign` (`:23-30`),
  `applyButtonEnabled` (`:46-48`). Note `loadChildren` is a separate top-level `||` arm **not** gated
  on `!!jql`; `loadBlockers` should match that arm.

### Progress display

Deliberately **do not** add a third `LoadProgressPhase`. `phase === 'children'` is load-bearing in
three places ([`LoadingProgress.tsx:90,97`](../../src/react/TimelineReport/components/LoadingProgress/LoadingProgress.tsx),
[`LoadingProgressContainer.tsx:60`](../../src/react/TimelineReport/components/LoadingProgress/LoadingProgressContainer.tsx))
and the union is hardcoded in three separate files rather than imported — a sequential third phase
makes the primary step un-complete mid-load.

Instead, blocker fetching reuses the `'children'` phase as the generic "expansion" phase, and the two
new `expandsChildren` / `expandsBlockers` booleans ride the unconditional shallow spread at
[`state-helpers.js:46-48`](../../src/canjs/controls/timeline-configuration/state-helpers.js) for free.
Add one `useMemo` / `value.from` / `useCanObservable` triple each in
[`useReportLoadingState.ts:54-94`](../../src/react/TimelineReport/hooks/useReportLoadingState.ts).
Their only job is the step label: "Loading children", "Loading blockers", or "Loading children and
blockers".

**Phase-reset fix.** Under full closure the children loader is invoked once per blocker round, and its
entry block
([`makeDeepChildrenLoaderUsingNamedFields.ts:106-119`](../../src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts))
resets `phase = 'primary'`, overwrites `parentsToProcess` and zeroes `parentsProcessed` on **every**
call. Make it first-pass-only and accumulative:

```ts
const firstPass = progress.data?.phase !== 'children';
if (progress.data && firstPass) progress.data.phase = 'primary';
const parentIssues = await rootMethod(newParams, progress);
if (progress.data) {
  progress.data.phase = 'children';
  progress.data.parentsToProcess = (progress.data.parentsToProcess || 0) + parentIssues.length;
  if (firstPass) progress.data.parentsProcessed = 0;
  progress(progress.data);
}
```

The blocker loader accumulates the same way, per batch. The projection at
`LoadingProgressContainer.tsx:77-91` is already monotonic and tolerant of a growing denominator, so
the bar stays sane with no further change.

---

## 7. Tests

New `src/jira-oidc-helpers/makeDeepBlockersLoaderUsingNamedFields.test.ts`. Cycle coverage is the
heart of it — one case per rule in §3, each asserting both that the loop **terminates** and that every
key was requested **exactly once**. Assert on the recorded JQL strings, not just the returned set, so
a duplicate fetch fails the test:

- `A → B → C → A`; self-link `A → A`; 2-cycle `A ⇄ B`; diamond `A → {B,C} → D`.
- **Cycle that closes through a child** — `A` blocked by `B`, and `B`'s child is already `A`'s child.
  Exercises rule 3, where the closing key arrived as a descendant rather than a requested blocker.
- A blocker key returning **no issue** (filtered by `blockerJQL` / not visible) is not re-requested on
  later rounds — rule 2.
- Root keys seeded: a root that is also somebody's blocker is not re-fetched — rule 1.
- Batching at 40; `blockerJQL` appended at every level; `skipApproximateCount` set.
- Bisect-on-error isolates one bad key without losing the rest of the batch.
- **Composed** with the children loader: children of blockers and blockers of children both load, and
  the cascade reaches a fixpoint.

Existing suites to extend — the first two **fail the build the moment the route-data prop is added**,
by design:

- [`ChildReportConfig.test.js:482-484`](../../src/react/reports/ReportOfReports/model/ChildReportConfig.test.js)
  (`SAVED_RAW` needs an entry per `CHILD_PARAMS` key) and `:618-632` (every route-data prop must be
  accounted for).
- [`raw-issues-cache-key.test.ts:56-63,76-83`](../../src/stateful-data/raw-issues-cache-key.test.ts) —
  add `loadBlockers` / `blockerJQL` rows to the `it.each` tables.
- [`jira-data-requests.test.js:107-121`](../../src/stateful-data/jira-data-requests.test.js) — extend
  the loader-switch assertions to all four cells of the §2 table.
- `childParams.test.js:34-57`, `childQueryGroups.test.ts:66-75`, `state-helpers.test.js:37-62,154-156`.
- [`IssueSource.test.tsx`](../../src/react/SettingsSidebar/components/IssueSource/IssueSource.test.tsx)
  — cover both flag states. Note its `vi.mock('./hooks/useJQL')` at `:31-43` is **already out of sync**
  (returns `childJQL`/`setChildJQL` while the component destructures `childJql`/`setChildJql`); use
  the real names for the new keys.
- New `LoadBlockers.test.tsx` modeled on `LoadChildren.test.tsx`.
- [`Features.test.tsx:9-17`](../../src/react/SettingsSidebar/components/Features/Features.test.tsx) —
  the expected-titles list is partial and stale, but add "Recursive Blockers" for consistency.
- [`reports.test.ts:8-11`](../../src/configuration/reports.test.ts) guards report-flag uniqueness only;
  it does **not** check `nonReportsFeatures` for collisions with report flags. `recursiveBlockers`
  collides with nothing today — confirm by grep.

---

## 8. Out of scope

[`src/examples/bitovi-training.json`](../../src/examples/bitovi-training.json) (and its `public/` copy)
contains **no link data at all** across its 53 issues, so the logged-out sample path exercises none of
this. That path already ignores `loadChildren` too
([`jira-data-requests.js:105-108`](../../src/stateful-data/jira-data-requests.js) returns the fixture
wholesale), so blockers are consistent with existing behavior. Authoring fixture links — including a
deliberate cycle — is a worthwhile follow-up if we want the logged-out demo to show blocker arrows.

---

## Verification

1. `npx vitest run src/jira-oidc-helpers src/stateful-data src/react/SettingsSidebar src/react/reports/ReportOfReports/model src/configuration` — the new loader suite plus every drift guard.
2. `npx tsc --noEmit` — confirms the `IssueLink` change and its two downstream readers.
3. Full `npx vitest run` plus the project lint/format task.
4. Run the app against a real Jira (the `launch-dev` agent handles Node, `.env`, credentials):
   - **Flag off** — the Sources tab shows no blocker checkbox. Hand-edit the URL to `loadBlockers=true`
     and confirm it still loads (the documented §5 behavior).
   - Turn the toggle on in **Features**; confirm the page reloads and the checkbox appears.
   - Root JQL returning one issue with a known blocker chain, **blockers on, children off** — the
     chain appears, and the network tab shows `key in (…)` batches, one round per level.
   - **Create a real cycle in Jira** (`A` is blocked by `B`, `B` is blocked by `A`) and confirm the
     load terminates with each issue requested once.
   - **Both checkboxes on** — children of blockers and blockers of children both arrive; the stepper
     reads "Loading children and blockers" and the primary step does not revert to active.
   - `blockerJQL` set to something exclusionary — excluded blockers are absent and the load still
     terminates.
   - Open AutoScheduler on the result: `linkedBlockedBy` arrows now include the newly-fetched upstream
     issues. This is the payoff described in Context.
5. Reload from the URL and confirm `loadBlockers` / `blockerJQL` round-trip; save a report and confirm
   they persist; add it as a child in a Report-of-Reports and confirm the child inherits them and that
   two children with identical queries still share one fetch.
