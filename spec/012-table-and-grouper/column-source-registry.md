# Column-source registry — built-in fields, rollups, and load requirements

Design note for the Table report (`table2`). Consolidates the discussion around: why
adding/removing certain columns reloads issues, a registry pattern for built-in Jira
fields, "Project Key vs Project Name", de-duplicating the add-column list, keeping the
registry in sync with the always-loaded field consts, and how rolled-up values fit.

Status: **decisions locked (below); implementation in progress.** `table2` is beta and
unreleased (`onByDefault: false`), so persistence-schema changes need **no migration**.

## 0. Locked decisions

1. **sourceId namespaces** — adopt `builtin:<concept>:<facet>` and `rollup:<name>`;
   leave the existing `estimation:*` ids as-is (same computed leg, no churn).
2. **Identifiers are canonical as Jira field IDs.** Column identity + `requires` use
   field **ids** (not display names), because names aren't unique — two fields can share
   a name (see spec/015; `deriveFieldMaps` → `ambiguousFieldIds`, `mapIdsToNames` keeps
   ambiguous fields addressable by id). `getValue` for a raw field reads
   `fields[id] ?? fields[name]`. And `CORE_FIELDS` + normalize `defaults` are folded
   (mapped to ids) into the diffed `allFieldsToRequest` union, so a truthful
   core-backed `requires` is genuinely free at the refetch-trigger level.
3. **`claims` is explicit, per concept** (accessor-inference is insufficient — a facet
   like Project Key reads derived `projectKey` and never touches `fields.project`, yet
   the concept must still claim `project`).
4. **Split**: pure registry owns `requires`/`get`/`claims`; the React catalog owns
   `render`/`compare`/`filter`; `normalizedFieldSources.ts` is absorbed.
5. **Aggregation**: string-like values (incl. rolled-up status) default to the existing
   **`distinct`** reducer — already the default for `string`/`option`/`user`. No new
   categorical aggregator; a "Worst Status" severity reducer is an optional future add.

## 1. The core problem: one field is doing two independent jobs

A column's `source` in
[`columns.ts`](../../src/react/reports/TableReport/model/columns.ts) is a
`FieldSource { kind:'field', fieldKey }` or `ComputedSource`. Today that single
`fieldKey` drives **two unrelated concerns**:

1. **What must be loaded** — route-data's `tableColumnFields` in
   [`route-data.js`](../../src/canjs/routing/route-data/route-data.js) turns every
   `field:<key>` sourceId into a raw Jira field request.
2. **How to read the value** — `getValue`, which for "Project" actually reads the
   _normalized_ `projectKey` (derived from the issue key) via
   [`normalizedFieldSources.ts`](../../src/react/reports/TableReport/model/normalizedFieldSources.ts).

"Project" is a hybrid: it **reads** something always-present (`projectKey`, derived
from the issue key) but is **registered** as needing the raw `project` field. That
mismatch is why adding/removing it reloads every issue — we request a field nothing
consumes, which changes the requested field set and refetches.

> Already landed: `allFieldsToRequest` now diffs with `diff.list` so an _identical_
> field set no longer refetches (mirrors the `fieldsToRequest` pattern). That's the
> safety net. The registry below is the root fix: state real requirements so the set
> genuinely doesn't change.

## 2. Model: make "what to load" a first-class, declared property

Every column source declares **both**:

- `requires: string[]` — the field identifiers it needs requested (often `[]`).
- `getValue` — the accessor over the issue.

This yields a three-legged taxonomy — each leg is just a different `requires`:

| Leg | `requires` | reads | example |
|-----|-----------|-------|---------|
| **derived / intrinsic** | `[]` | value present on every raw issue (or derived from it) | Project Key (`i.projectKey` from `issue.key`), Issue Key, Summary\* |
| **normalized (base field)** | field already always-loaded | flattened normalized prop | Status (`i.status`), Due Date (`i.dueDate`), Story Points |
| **raw field** | `[fieldKey]` | `fields[name]` (scalar) or `fields[name]?.<prop>` (object) | a custom field; **Project Name** (`fields.project?.name`) |
| **computed / rollup** | `[]` | pipeline-computed objects on the rolled-up issue | Rolled-up Status (`i.rollupStatuses.rollup.status`), Rolled Up Days |

\*Summary technically needs the `summary` field, but it's always loaded (see §6), so it
declares `requires: ['summary']` and is free.

`requires: []` is reserved for values that need **no** field request _ever_ — intrinsic
issue properties and things derived purely from them, plus pipeline rollups.

## 3. Project Key vs Project Name (the motivating case)

Split the single hybrid "Project" into two explicit facets:

```ts
{ id: 'builtin:project:key',  label: 'Project Key',  requires: [],          getValue: (i) => i.projectKey }
{ id: 'builtin:project:name', label: 'Project Name', requires: ['project'], getValue: (i) => i.fields?.project?.name }
```

- **Project Key** — always available, never triggers a load.
- **Project Name** — loads the `project` field once, then reads `.name` off the JSON.

Same shape generalizes to any built-in concept with an "identifier we always have" vs
"a property that requires loading the object" (Assignee key vs display name, etc.).

## 4. The registry

A **pure, React-free module** keyed by `sourceId`, importable from both the React
catalog and `route-data.js` (no Atlaskit pulled into routing):

```ts
// e.g. TableReport/model/builtinFieldRegistry.ts — no React imports
export const BUILTIN_COLUMNS = {
  'builtin:project:key':  { requires: [],          get: (i) => i.projectKey },
  'builtin:project:name': { requires: ['project'], get: (i) => i.fields?.project?.name, claims: ['project'] },
  'rollup:status':        { requires: [],          get: (i) => i.rollupStatuses?.rollup?.status },
  // ...
} satisfies Record<string, BuiltinColumnSource>;
```

- `sourceId` namespaces: `identity:*` (existing), `field:<key>` (generic custom
  fields), `builtin:<concept>:<facet>` (curated built-ins), `rollup:<name>` /
  `computed:<id>` (pipeline values). Distinct, persistable ids.
- The React catalog ([`buildColumnCatalog.ts`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts))
  layers `render`/`compare`/`filter`/`aggregate` on top (type registry +
  normalized renderers), so the pure module stays UI-free.

## 5. Set-difference: registry claims fields, generic generation subtracts them

Today there's one column per Jira field, so no duplicates. Once the registry splits a
concept into curated facets, the generic `fields.map(buildFieldColumn)` would _also_
emit a bare `field:project` "Project" column → duplicate. So the registry **claims**
fields and generic generation gets the **set-difference**:

```
catalog =
    identity columns
  + registry facet columns              // curated built-ins + rollups
  + rawFields.filter(f => !claimed(f))   // ← set-difference
  + estimation columns
```

- `claimed(f)` matches on **both** `f.key` and `f.name`, case-insensitive (Jira's
  `key` is `project` but `name` is `Project`; custom fields match by name).
- `claims` is **declared explicitly** per concept, not inferred from accessors — a
  facet like Project Key reads _no_ raw field yet the concept must still claim
  `project` so the bare "Project" disappears.

### Availability gating (same rule handles de-dup + "don't offer what we can't load")

The offered add-column list is:

> all derived/rollup facets (`requires: []`) unconditionally, **plus** every facet
> whose `requires ⊆ availableFieldKeys`, **plus** leftover raw fields not claimed.

So "Project Name" only appears if the tenant actually has a loadable `project` field;
"Project Key" always appears. One rule, both jobs.

## 6. Keeping the registry in sync with the always-loaded consts

There are **two** "always loaded" sources — this is the crux:

1. **`CORE_FIELDS`** in
   [`jira-data-requests.js`](../../src/stateful-data/jira-data-requests.js) — merged
   into _every_ request: `summary, Rank, Issue Type, Fix versions, Labels, Status,
   Sprint, Created, Parent, Team, Linked Issues`.
2. **`defaults`** in
   [`normalize.ts`](../../src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.ts)
   — flows through `fieldsToRequest`: `Start date, Due date, Story points, Story
   points median, Confidence, Story points confidence, Days estimate`.

So `i.status`/`i.parentKey`/`i.team`/`i.labels`/`i.rank` are free because of
**CORE_FIELDS**; `i.dueDate`/`i.storyPoints` because of **defaults**.

### Sync strategy: don't duplicate the list — state truthful `requires`

Rather than a facet asserting `requires: []` _because I know it's core_, declare its
**real** requirement and let the existing union + dedup make core/default ones free:

```
fieldsToLoad = unique( CORE_FIELDS ∪ normalizeDefaults ∪ ⋃ selectedColumn.requires )
```

- Status facet → `requires: ['Status']`; already in CORE_FIELDS → contributes nothing
  → (with the diff fix) no refetch.
- This **self-heals**: remove `Status` from `CORE_FIELDS` and the Status column keeps
  working — it just starts contributing `Status` itself. Nothing to hand-sync.

### Canonical space = Jira field IDs (locked)

For "already loaded ⇒ free" to hold, everything must be compared in **one** identifier
space, and that space is **field ids** (decision §0.2). Names can't be canonical because
they aren't unique — two fields can share a display name — and the id is the only
unambiguous handle (spec/015: ambiguous fields are kept addressable by id in
`issue.fields`).

Two consequences:

1. `requires` and column identity are **ids**; `getValue` reads `fields[id] ?? fields[name]`.
2. `CORE_FIELDS` (names) and normalize `defaults` (names) are mapped to ids via the
   `nameMap` route-data already has, and **folded into the diffed `allFieldsToRequest`
   union**: `unique(CORE_FIELDS ∪ defaults ∪ urlFields ∪ columnRequires)`, all ids.
   Previously `CORE_FIELDS` was unioned _downstream_ in `getRawIssues`, invisible to the
   refetch trigger — so a core-backed column (e.g. Status) still looked like a new entry
   and refetched. Folding it in makes a truthful `requires:['status']` a genuine no-op.

### Belt-and-suspenders: a CI guard test

Export `CORE_FIELDS` and `defaults` as named consts; a unit test asserts the invariant:

> every facet with `requires: []` reads either `issue.key` (intrinsic), a pipeline
> rollup, or a value covered by `CORE_FIELDS ∪ defaults`; and every non-empty
> `requires` names a field that exists in the catalog.

Catches drift the moment either const is edited, without coupling the pipeline to the
registry.

## 7. Rolled-up / computed columns

Rolled-up values are the **computed leg** and already work: the Estimation columns read
`issue.completionRollup.totalWorkingDays` via `source: { kind: 'computed' }`. Rolled-up
status is just another one:

```ts
{ id: 'rollup:status', label: 'Rolled-up Status', requires: [],
  getValue: (i) => i.rollupStatuses?.rollup?.status }
```

Always present on the fully rolled-up set (`allIssuesOrReleases`, which the report
already prefers) — no fetch.

- **Dropdown:** register alongside the Estimation group (a `rollup:` section).
- **Group _by_ it:** works out of the box — `getValue` returns a scalar status string.
  Add `filter: { kind: 'select' }`, a `compare` ordering by status **severity** (not
  alphabetical), and reuse `statusRender` (lozenge) so headers look/sort right.

### Aggregation: reuse `distinct` (no new abstraction)

When a rollup status is a **measure inside a group**, it aggregates with the existing
**`distinct`** reducer — already the default for `string`/`option`/`user` types
([`aggregations.ts`](../../src/react/reports/TableReport/model/aggregations.ts);
`defaultAggregationForType('string') === 'distinct'`). A grouped cell shows the distinct
set (e.g. "ontrack, blocked, complete"). So rollup columns need **zero** aggregation
work — just declare their type / `defaultAggregate: 'distinct'`. A single-value "Worst
Status" severity reducer is an optional, non-default future add.

### Nuance: level-sensitivity

A leaf's `rollupStatuses.rollup.status` is its own status; a parent's is the aggregate.
Grouping the flat set by it is meaningful per-row, but "rolled-up" only differs from
"status" on parent rows — keep the label honest.

## 8. Route-data change

Replace the `field:`-prefix parsing in `tableColumnFields` with a `requires`-driven
union sourced from the pure registry:

```js
// route-data.js — requirement comes from declared `requires`, not the sourceId shape
get tableColumnFields() {
  return (this.tableColumns || [])
    .flatMap((entry) => requiredFieldsFor(entry?.sourceId)); // [] for derived/rollup → no reload
}
```

`requiredFieldsFor` consults the pure registry (and passes `field:<key>` custom fields
straight through as `[key]`). Combined with the landed `allFieldsToRequest` diff, this
makes Project Key / rollups zero-cost and Project Name a one-time load.

## 9. Decisions (all locked — see §0)

All five open questions are resolved in §0: `builtin:`/`rollup:` namespaces; ids
canonical with CORE_FIELDS/defaults folded into the union; explicit per-concept
`claims`; pure-registry / React-catalog split absorbing `normalizedFieldSources.ts`;
and `distinct` as the default string aggregation (no new reducer).

## 10. Suggested implementation order

1. Pure `builtinFieldRegistry.ts` (`requires`/`get`/`claims`), no React.
2. `tableColumnFields` → `requires`-driven; canonicalize identifier space; keep the
   `allFieldsToRequest` diff. Guard test for the sync invariant (§6).
3. `buildColumnCatalog` consumes the registry: emit facets, subtract `claims`, gate by
   `requires ⊆ availableFieldKeys`. Split Project into Key/Name.
4. Add `rollup:status` (+ other rollups); wire `statusRender` + severity `compare` +
   select filter.
5. Categorical status aggregator; set as rollup status `defaultAggregate`.
