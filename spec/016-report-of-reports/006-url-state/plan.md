# 016 — Report of Reports: URL state (refreshable, bookmarkable, shareable)

Every other report writes its settings to the URL as the user changes them, so the page can be
refreshed, bookmarked, or pasted to a colleague and come back as the same report. A
report-of-reports does not. This plan makes it.

## The problem

Two kinds of state are lost on reload today, and they're lost for different reasons.

### 1. The document tree lives in React state, not the URL

`ReportLayoutProvider` holds the tree in `useState`, seeded from the open saved report's `sections`
field (`src/react/services/report-layout/ReportLayoutProvider.tsx:47-72`). Nothing writes it to the
URL. So:

- Build a new document — add three reports, name two sections — then refresh: **everything is gone.**
  There is no `?report=` yet, so there is nothing to re-seed from. Every other report type survives
  this, because `jql`, `tableColumns`, `filterRows` and the rest are in the URL from the first
  keystroke.
- Open a saved document, add a report, send someone the URL: they get the document **as saved**. The
  URL is `?report=<id>` and carries nothing of the edit.
- Open a saved document, edit it, refresh by accident: back to as-saved.

The dirty flag already has to route around this. `useSelectedReport` computes a _second_, separate
dirty signal for documents because "the document tree lives outside the URL, so `paramsMatchReport`
can't see layout edits" (`useSelectedReport.ts:46-49`). That comment is the bug, written down.

### 2. A child's in-report edits are in-memory only

An embedded child gets its prop bag from its own `ChildReportConfig` rather than the global
`routeData` (`ChildReport.tsx:63-75`, `reportProps.ts:15-49`), and those props are `value.bind` —
two-way. When a report writes back, `childParam`'s `lastSet` listener resolves the new value into
memory and stops there:

```js
// ChildReportConfig.js:240-246
listenTo('queryParams', resolveFromParams);
// An edit made inside the child (a column sort, say) stays in memory. Children render as
// saved and never write to the page URL — that URL belongs to the composed document.
listenTo(lastSet, (newValue) => resolve(newValue));
```

That comment describes v1's deliberate scope, and this plan is what supersedes it. Concretely, today
**`TableReport` is the only report component that writes back** — `columnsObs`, `sortColumnObs`,
`sortDirObs` (`TableReport.tsx:800-806`) and `filtersObs` (`:935`). So: embed a Table in a document,
click a column header to re-sort it, refresh — the sort is gone. In the shell that same click is in
the URL before the render finishes.

### What "like other reports" means mechanically

`makeParamAndReportDataReducer` (`state-storage.js:221-311`) gives every other setting three
behaviours this plan has to reproduce:

1. **Precedence** — URL value, else the saved report's value, else the default (`:232-244`).
2. **Write-on-divergence** — a set writes the URL param only when it differs from the saved report's
   value, and _deletes_ it otherwise (`:300-304` → `updateUrlParam` at `:431-440`). This is what
   keeps an unmodified saved report's URL at a clean `?report=<id>`.
3. **Re-read on URL change** — back/forward and any external rewrite re-resolve the value (`:278`).

Behaviour 2 is the load-bearing one for us, because the dirty flag is derived from it:
`paramsMatchReport` reports "dirty" iff any param other than `settings` and `report` is left in the
URL (`useSelectedReports/utilities.ts:42-47`). Get the write rule right and the document's dirty flag
falls out for free — and `sectionsAreDirty` can go away.

## What exists to build on

| thing                                                                 | where                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Lossless parse/serialize for the tree, incl. unknown-node passthrough | `model/sections.ts:100-183` (`parseSections`, `toStoredSections`)                   |
| "Would these two trees store identically?"                            | `model/sections.ts:189-190` (`sameSections`) — already the guard against re-parsing |
| Write-a-param-unless-it-equals-a-baseline                             | `state-storage.js:431-440` (`updateUrlParam`)                                       |
| The URL observable React already subscribes to                        | `state-storage.js:18` (`pushStateObservable`), via `hooks/useQueryParams`           |
| One shared parser for a child's `queryParams`                         | `ChildReportConfig.js:83-199` (`CHILD_PARAMS`), exposed via `model/childParams.js`  |
| A place for per-node data that survives a save round trip             | `model/sections.ts:141-183` (`storedParams` merges unknown keys back in)            |
| Ordered, EOL-dated migration table over a param bag                   | `src/jira/reports/migrations/` (`types.ts`, `migrations.ts`, `url.ts`)              |
| Debounce, if URL writes prove chatty                                  | `react/hooks/useDebounce`                                                           |

## What doesn't exist

- **No `stringify` for a child param.** `CHILD_PARAMS` specs are `{ parse, defaultRaw }` only
  (`ChildReportConfig.js:59-67`), because a child has only ever _read_ its config. Capturing a
  child's edit back into a query string needs the inverse. Good news: **route-data already has one
  for every key**, since it round-trips all of them through the URL today — so Phase 2 is a port,
  not a design job. See the table in Phase 2.
- **No upward signal from a child config.** `childParam`'s `lastSet` listener resolves and returns;
  nothing outside the config learns that a value changed.
- **No node identity that survives a session.** `sections.ts:61-67` says so explicitly, and adds:
  "When a cross-session anchor is needed (a comment on a section, a deep link to one), persist it
  then." This plan deliberately does **not** need one — see Decisions.

## Decisions

- **One new URL param, `sections`, holding the JSON document.** Same name as the stored field so the
  two forms are obviously the same thing. Its value is exactly `toStoredSections(tree)` — the shape
  already saved to Jira, not a second schema.
- **The React provider owns the tree; the URL is its mirror.** `ReportLayoutProvider` keeps the live
  tree and gains URL read/write, rather than the tree moving into a `routeData` prop. Three reasons:
  the tree's only consumers are React (the document body and `SaveReports`); `route-data.js` is the
  last thing the React rewrite still has to delete (spec/011), so new props there move backwards; and
  keeping the in-memory tree authoritative is what protects node identity (below).
- **Never re-parse a tree we just wrote.** A re-parse mints new node ids (`sections.ts:67`), every
  `ChildReport` remounts, and a remounted child refetches from Jira. The provider must ignore the
  `pushStateObservable` tick caused by its own write. `sameSections` is the comparison; the existing
  effect at `ReportLayoutProvider.tsx:67-71` already uses this trick against the saved tree.
- **Per-child overrides ride on the node, as a query-string fragment.** A `saved-report` node gains
  an optional `params.overrides` — a `URLSearchParams`-shaped string of _only_ the keys that differ
  from the child's own saved `queryParams`. Two consequences, both good:
  - The child's effective configuration is `merge(report.queryParams, node.params.overrides)`, a
    string, which `ChildReportConfig` and `parseChildQuery` already know how to read. No new parser.
  - Overrides travel with the node through reorder and delete, and through
    `toStoredSections`/`parseSections` — so "Save report" persists a tweaked child with no change to
    the save path or the storage layer.
- **Therefore node ids stay in-memory-only.** Because an override is attached to its node rather than
  keyed by it, nothing needs a cross-session anchor. The stored document stays as readable as it is
  today.
- **A query fragment, not a JSON bag of JS values.** The alternative — `"overrides": {"tableSortDir":
"desc"}`, live JS values, no `stringify` needed at all — was rejected. It would give
  `ChildReportConfig` a _second_ input path layered over the parsed `queryParams`, and would force
  `parseChildQuery` (shared with the dedupe grouping) to understand both forms. Two readers that can
  disagree about a child's configuration is precisely the failure `childQueryGroups` exists to
  prevent: nothing throws, nothing renders wrong, the group just splits and costs a fetch
  (`childQueryGroups.ts:57-71`). The cost of that choice is the `stringify` work in Phase 2, which is
  a port of code that already exists.
- **Plain JSON, not a compact encoding — until measured.** Every JSON param in this app is stored
  plainly (`filterRows`, `tableColumns`, `tableFilters`), and a debuggable URL is worth real bytes.
  Sizes are bounded and known — see Size below — with an explicit rule for when to revisit.
- **Out of scope:** collapse state (`DocumentEditing.tsx:67-73` deliberately doesn't persist it, and
  that stays true); the shell's `selfManagesData` special-casing (`ReportArea.tsx:70`) and the
  document's cut-down control strip (`ReportControls.tsx:218-226`); nesting documents.

## Design

### The param

```
?report=abc123&sections=[{"type":"section","params":{"title":"Q3"},"children":[…]},…]
```

Written only when the tree differs from what the open report has saved, deleted the moment it
matches again — `updateUrlParam(SECTIONS_PARAM, json, savedJson)` does exactly this. For a document
with no `?report=` (a brand-new one), the baseline is `[]`, so any non-empty tree writes.

Resolution order, mirroring `makeParamAndReportDataReducer`:

| URL `sections` | open report's `sections` | tree                         |
| -------------- | ------------------------ | ---------------------------- |
| present        | anything                 | parsed from the URL          |
| absent         | present                  | parsed from the saved report |
| absent         | absent                   | `[]`                         |

### Per-child overrides

```jsonc
{
  "type": "saved-report",
  "params": {
    "reportId": "abc-123",
    // only what differs from that report's own queryParams
    "overrides": "tableSortColumn=summary&tableSortDir=desc",
  },
}
```

An override key is dropped from the fragment when its value returns to the saved report's value, for
the same reason the param itself is — so a sort toggled there and back leaves no trace.

### Size

Measured on a representative document (one section holding two reports, plus a top-level report and
an inline value; uuid report ids):

| form                             | raw   | URL-encoded |
| -------------------------------- | ----- | ----------- |
| `toStoredSections` JSON, 4 nodes | 396 B | 606 B       |
| same, tuple-compacted            | 190 B | 284 B       |

Roughly **150 encoded bytes per node**, plus overrides (a `tableColumns` override is the big one —
a few hundred bytes on its own). A ten-child document lands near 1.5 KB; with Table overrides on
several children, 3–4 KB.

That is comfortable in a browser but _not_ free in the Connect host, where `syncRouters` mirrors the
whole search string into the Jira container URL on every `pushState`
(`src/routing/index.plugin.ts:22-33`), prefixed `ac.<appKey>.<key>`. **Decision rule:** if a real
document's URL exceeds ~4 KB, or the Connect container URL misbehaves, switch the encoding to the
tuple form (`[["s","Q3",[["r",id],…]],…]`, ~47% of plain JSON) behind the same
`encodeSections`/`decodeSections` pair, and add a migration-table entry to read the old form. Do not
reach for `CompressionStream` — it's async, and the param write is synchronous.

### History entries

Structural edits push (`updateUrlParam` → `pushStateObservable.value = …`), so Back undoes an add or
a move — a genuine improvement. Per-child overrides are the risk: a Table column drag can fire many
writes, which is exactly why `compareTo` and `timeInStatusReorder` are in
`replaceStateKeys` (`state-storage.js:19-20`). Both live in one param, so it's all-or-nothing.
**Recommendation:** keep pushState, and debounce the provider's write (~300 ms, `useDebounce`) when
Phase 2 lands. Revisit `replaceStateKeys` only if debouncing isn't enough.

## Phases

### Phase 0 — `documentParam.ts` (pure, unwired)

New `src/react/reports/ReportOfReports/model/documentParam.ts`:

- `SECTIONS_PARAM = 'sections'`
- `encodeSections(nodes: LayoutNode[]): string` — `JSON.stringify(toStoredSections(nodes))`
- `decodeSections(raw: string | null): LayoutNode[] | null` — `null` when the param is absent;
  tolerant otherwise (bad JSON → `[]`, never a throw, matching `parseSections`'s contract at
  `sections.ts:128-133`)
- `sectionsBaseline(savedReport): string` — the encoded stored tree of the open report, or `"[]"`

**Tests** (`documentParam.test.ts`): round-trips a tree with all four node types; an unknown node and
an unknown key on a known node survive encode→decode→encode byte-identically (the guarantee
`toStoredSections` already makes — this pins that the URL doesn't erode it); malformed JSON yields
`[]`; absent yields `null`.

### Phase 1 — the document tree in the URL

`ReportLayoutProvider` gains the URL as a source and a sink.

1. Seed from `decodeSections(new URLSearchParams(window.location.search).get(SECTIONS_PARAM))` first,
   falling back to the saved report — in the lazy `useState` initializer, so there is no flash of the
   as-saved document (`ReportLayoutProvider.tsx:48`).
2. `setSections(next)` writes through: `updateUrlParam(SECTIONS_PARAM, encodeSections(next),
sectionsBaseline(savedReport))`, then sets React state. State is set from the caller's tree, never
   from a re-parse — this is what keeps node ids, and therefore child mounts, stable.
3. Subscribe to `pushStateObservable`. On a tick, decode the param; if it `sameSections` the current
   tree, **do nothing** (that was our own write). Otherwise adopt it — back/forward, and
   `resetChanges`, land here.
4. The existing saved-report effect (`:56-72`) narrows: it re-seeds only when the URL param is absent,
   so an open document with edits in the URL isn't stomped by a `reportsData` refetch.
5. `resetSections` stays as the provider's own reset but is now redundant with the URL clear in
   `SaveReports.resetChanges` (`SaveReports.tsx:106-115`), which already sets `?report=<id>`. Keep
   the call — it makes the reset synchronous and independent of tick ordering — and note why.
6. Drop `sectionsAreDirty` from `useSelectedReport` (`useSelectedReport.ts:46-49, 80`). A divergent
   tree is now a URL param, so `paramsAreDirty` sees it. Keep the `sections` argument only if the
   hook's other callers need it; otherwise delete it and simplify `SaveReports.tsx:36-43`.

**Tests**

- `ReportLayoutProvider.test.tsx`: seeds from the URL param over the saved report; writes the param on
  edit; **deletes** the param when an edit restores the saved tree; adopts an external URL change;
  ignores its own write (assert node ids are unchanged after a set — this is the remount guard);
  an absent param still seeds from the saved report (every existing test in this file must still pass).
- `useSelectedReport.test.tsx`: a document with a `sections` param reads dirty; `?report=<id>` alone
  reads clean.
- One integration test in `ReportOfReports.test.tsx`: render with a `sections` param and no saved
  report → the document renders those children (the "new unsaved document survives refresh" case).

### Phase 2 — per-child configuration overrides

1. **`CHILD_PARAMS` gains `stringify`** (`ChildReportConfig.js:59-67`), the inverse of each `parse`.
   Almost all of it is a port — route-data round-trips every one of these keys through the URL today,
   so the converter already exists and is the thing to copy:

   | child param spec                    | port from                                                      |
   | ----------------------------------- | -------------------------------------------------------------- |
   | `string()`, `isoDate()`, `number()` | `'' + x` (`route-data.js:225`, `:1056`, `:1066`)               |
   | `boolean()`                         | `booleanParsing.stringify` (`route-data.js:72-77`)             |
   | `list()`                            | `value.join(',')` (`state-storage.js:319-325`)                 |
   | `json()`                            | `JSON.stringify` (the `JSON` converter, e.g. `:933`)           |
   | `uncertaintyWeight`                 | `route-data.js:199-201`                                        |
   | `selectedStartDate`                 | `route-data.js:211-217` (`toISOString()`, `nowUTC()` fallback) |
   | `timingCalculations`                | `route-data.js:533-537`                                        |
   | `timeInStatusReorder`               | `route-data.js:1091`                                           |
   | `primaryReportType`                 | `route-data.js:595`                                            |
   | `compareTo`                         | `route-data.js:260-266` — **read the warnings below first**    |

   Four rules the port must follow, and one line not to copy:

   - **Canonicalization is the load-bearing property, not the conversion.** An override is written
     only when it differs from the child's saved value, and that comparison is on _strings_. So every
     spec must satisfy `stringify(parse(raw)) === raw` for any `raw` a saved report can hold.
     Otherwise the first write to _any_ key on a child manufactures a phantom override for every other
     key — and a document that is permanently dirty. Where a spec can't satisfy it, compare parsed
     values instead of strings for that key.
   - **`timingCalculations` round-trips through an object**, so `{Epic: …, Story: …}` re-emits in
     insertion order, which needn't match the saved string's order. Canonicalize the key order (sort
     it) or compare parsed.
   - **`undefined` means "remove the key", never the string `"undefined"`.** `asBoolean` returns
     `undefined` for an unrecognized value by design (`ChildReportConfig.js:42`), and
     `timeInStatusReorder` returns it deliberately. `route-data.js:1091` sets the precedent:
     `value ? JSON.stringify(value) : ''`.
   - **`list()` inherits a known comma bug.** `join(',')` carries its source's own unfixed caveat —
     "we probably need to escape things with `,`" (`state-storage.js:322`) — so a status name
     containing a comma round-trips as two values. Pre-existing and shared with every list param in
     the app; don't fix it here, but don't let the canonicalization test fail mysteriously on it.
   - **Do not port `compareTo`'s `Date` branch.** `route-data.js:262-263` reads
     `if (number instanceof Date) { return date.toISOString()… }` — there is no `date` in that scope
     and no such import, so the branch throws a `ReferenceError`. It's dead today (the value is always
     a number by then). Drop it rather than reproduce it.

   **`compareTo` is the one genuinely unsafe key.** `parse` collapses `compareTo=2026-06-01` into "how
   many seconds ago is that", computed against `new Date()` (`route-data.js:252-255`), so the date
   string is unrecoverable. A round trip silently rewrites a _fixed date_ as a _relative offset that
   drifts every day_, and `compareToType` (`:270-283`) reads the raw URL to decide which of the two a
   user sees. Consequence: never emit a `compareTo` override the user didn't ask for — which the
   canonicalization rule already implies, since `stringify(parse('2026-06-01')) !== '2026-06-01'`.
   Simplest safe treatment: exclude `compareTo` from the override mechanism in this phase and record
   why.

   **A gap this table doesn't cover.** `AD_HOC_CHILD_PARAM_KEYS` — `selectedIssueType` and
   `toIssueType` (`ChildReportConfig.js:208`) — are settable through `lastSet`
   (`:457`, `:507`) but are not in `CHILD_PARAMS`, so a `stringify` table over that object won't
   capture them. Nothing writes them from inside a report today (`SelectIssueType` is shell chrome,
   and `ReportControls.tsx:218-226` hides it for a document), but they self-heal against the returned
   hierarchy rather than simply parsing, so they need a deliberate decision rather than a default.
   Either handle them or assert they're unwritable — don't leave it silent.

   Extend the existing drift test so a `CHILD_PARAMS` spec with no `stringify` fails the build,
   exactly as a route-data param with no `CHILD_PARAMS` entry does today.

   **If this phase has to be smaller:** port `stringify` for only the four keys `TableReport` actually
   writes (`tableColumns`, `tableSortColumn`, `tableSortDir`, `tableFilters` — `TableReport.tsx:800-806`,
   `:935`), and have the emit path `console.error` and drop the override for a key with no `stringify`.
   That trades a build-time guarantee for a runtime one. It's defensible only because _any_ key can
   become writable the moment someone binds a new control — which is exactly why the full table is
   preferred.

2. **`ChildReportConfig` emits changes.** A new non-enumerable `onParamChange` prop, called from
   `childParam`'s `lastSet` listener with `(key, stringify(value))`. Default no-op, so nothing outside
   a document changes behaviour.
3. **`ChildReport` records them.** It knows its node; it calls a new
   `setNodeOverrideAt(sections, path, key, serialized)` in `model/sections.ts`, which folds the key
   into `params.overrides` — or removes it when the value equals the child's saved value — and returns
   the same tree reference when nothing changed (the contract `setSectionTitleAt` already keeps,
   `sections.ts:264-267`). That flows into `setSections`, and Phase 1 puts it in the URL.
4. **`ChildReport` reads them.** `effectiveQueryParams(report.queryParams, node.params.overrides)` —
   a merge of two query strings — replaces `report.queryParams` at `ChildReport.tsx:70`. The `useMemo`
   deps become the merged string, which is already referentially stable per render if memoized at
   the node level.

**Tests**

- `ChildReportConfig.test.js`: **both** round trips, per key. `parse(stringify(v))` deep-equals `v`
  (the conversion is right) _and_ `stringify(parse(raw)) === raw` for a realistic saved `raw` (the
  canonicalization above — this is the one that catches phantom overrides). Table-drive it over
  `CHILD_PARAMS` so a new spec can't skip it, with a named, commented exception list for any key that
  legitimately can't satisfy the second law. `onParamChange` fires on a set and not on a `queryParams`
  resolve.
- `sections.test.ts`: `setNodeOverrideAt` adds, updates, removes-on-return-to-saved, returns the same
  reference on a no-op, and survives a store/parse round trip.
- `ChildReport.test.tsx`: a node with `overrides` renders the overridden config, with the underlying
  saved report untouched.
- An integration test: mount a document with a Table child, drive a sort write, assert the `sections`
  param now carries `tableSortDir` for that node and that no other node changed.

### Phase 3 — make the rest of the app read _effective_ params

Anything that reads a child's configuration from `report.queryParams` must read the merged string, or
it will silently disagree with what the child renders.

1. **Request dedupe** — `childQueryGroups` groups by `parseChildQuery(report.queryParams)`
   (`childQueryGroups.ts:79`) and `overrideFor` looks up by the same (`:110-114`). Both take effective
   params. An override that changes `jql`, `childJQL`, `loadChildren` or `tableColumns` moves a child
   between groups; getting this wrong doesn't throw and doesn't render wrong — it just splits a group
   and costs a fetch, which is the failure mode that module was written to prevent
   (spec/016-report-of-reports/005-optimize/001-request-dedupe).
2. **`collectSavedReports`** currently returns `Report` records; it needs to return
   `{ report, overrides }` pairs (or effective query strings) so the grouping sees them.
3. **Saving** needs no change: overrides are node params, so `toStoredSections` carries them into
   `report.sections` already (`SaveReports.tsx:88`, `useSelectedReport.ts:64`). Add a test that pins
   it rather than assuming it.
4. **`storedQueryParams`** needs no change either — the document lives in `sections`, not in the
   report's `queryParams`, so a report-of-reports still stores just its report type
   (`storedQueryParams.ts:14-15`).

## Risks

- **Accidental remounts.** The single thing most likely to go wrong. A re-parse anywhere in the write
  path mints new ids → every `ChildReport` remounts → a full refetch cascade per keystroke. Mitigated
  by the "ignore our own tick" guard (Phase 1.3) and pinned by the id-stability test. The 30 s
  singleflight/TTL from 005 softens the damage but must not be leaned on.
- **Phantom overrides from a non-canonical `stringify`.** The second-most likely thing to go wrong,
  and it presents as "this document is always dirty" rather than as a broken report, so it's easy to
  ship. Guarded by the `stringify(parse(raw)) === raw` test in Phase 2; `compareTo` is the key that
  cannot satisfy it.
- **URL growth in Connect.** Bounded and measured above, with a named fallback and a decision rule.
- **`paramsMatchReport` is coarse.** It treats _any_ leftover param as dirty (`utilities.ts:47`, with
  the real comparison commented out just below it). That works in our favour here, but it means a
  `sections` param that fails to delete itself leaves a document permanently dirty. The
  "deletes the param when the tree returns to saved" test is what guards it.
- **Two writers, one param.** Structural edits and per-child overrides both write `sections`. They go
  through one `setSections`, so there's no interleaving hazard — but a future writer that bypasses the
  provider would reintroduce one.

## Open questions

- **Should the document param be shared-link-safe on its own?** A `sections` param references saved
  reports by id; a recipient without access to those reports sees `MissingReportNote` for each. That's
  correct behaviour, but if "send someone this document" is a real goal, it may want its own design.
- **Inline-value expressions** already live in the tree, so they come along for free — but they
  resolve against Jira per render (`useInlineExpression`). Nothing here changes that; worth a look if
  a document in a URL turns out to fire a burst of expression lookups on load.

## Verifying

```
npm test           # vitest, whole suite
npm run typecheck  # tsc
```

Manual, per phase: build an unsaved document → refresh → it's still there. Open a saved document →
edit → the URL grows a `sections` param and "Save report" appears → Reset changes → the param is gone
and the button with it. Sort a Table child → refresh → the sort survives.
