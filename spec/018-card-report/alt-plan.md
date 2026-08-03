# Cards report — alternate plan with inline children (2026-08-02)

**Alternative to the original plan's Phases 3–4.** This approach combines Cards promotion with
inline (unsaved) children in report-of-reports and a single lossless migration that converts legacy
secondary-slot configs directly into documents. The slot is deleted immediately rather than kept for
a release.

**Key difference from the original plan:** the original keeps the legacy slot through Phases 3 and 4,
deleting it only after `cardsReport` and `reportOfReports` graduate to `onByDefault: true`. This plan
eliminates the slot by migrating every secondary-slot config into a report-of-reports document with
inline children, so the slot is dead code the moment the migration runs.

> **Rationale:** Cards was always an unsupported feature (behind `onByDefault: false`). A lossless
> automatic migration to report-of-reports is a better user experience than a deprecation notice plus
> a release delay, and it lets us delete the slot immediately with no grace period.

> **Reviewed and revised 2026-08-02.** The first draft of this plan had five defects that would have
> shipped broken; the decisions below were taken in response and are folded into the sections that
> follow. Where this plan and the original disagree on something the original ratified, it says so.

---

## Decisions (ratified 2026-08-02)

| Question                                                | Decision                                                                                                                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What happens to the legacy `secondary*` keys?           | **Deleted by the migration**, at both the URL and the record level. Keeping them as "insurance" would leave `applies` permanently true — see [§ Idempotency](#idempotency).                                            |
| Where does a migrated document live?                    | **The record's own `sections` field** for a saved report; **the `sections` URL param** for a link. One transform, two destinations — see [§ Two destinations](#two-destinations). `ReportLayoutProvider` is untouched. |
| How are the two children's params built?                | **Copy the whole bag, then override.** Route data defines ~60 settings; an allow-list guarantees silent drops.                                                                                                         |
| Does the write-back ship immediately?                   | **Yes**, with the older-client cost stated rather than denied — see [§ Accepted costs](#accepted-costs).                                                                                                               |
| Does route data drop the three `secondary*` params now? | **Yes**, in the same phase as the slot deletion. Nothing can reach route data carrying them once the boot rewrite and the record migration both strip them.                                                            |
| How is an edit inside an inline child recorded?         | **Written straight into the node's `params`.** An inline child is its own baseline, so the `overrides` mechanism has nothing to diff against.                                                                          |

---

## Why inline children unlock this

The original plan notes (§ Migration policy) that a one-record-in-one-record-out migration cannot
preserve both a Gantt and a Cards report — you can only change `primaryReportType`, not split one
record into three. But **if report-of-reports supports unsaved (inline) children**, a migration can
emit a document tree with two inline children, each carrying its own full config:

```json
{
  "type": "report-of-reports",
  "sections": [
    { "type": "inline-child", "params": { "jql": "...", "primaryReportType": "start-due", "filterRows": "[...]" } },
    {
      "type": "inline-child",
      "params": { "jql": "...", "primaryReportType": "cards", "cardsMode": "breakdown", "filterRows": "[...]" }
    }
  ]
}
```

Both reports, both configs, one saved record, no new records created.

---

## Current state (verified 2026-08-02)

- Phases A and B of the migrations sub-plan are implemented and committed (`src/jira/reports/migrations/`):
  the ordered table, all three consumers, and the EOL test.
- Phase C of that sub-plan (additive `secondaryReportType` → `cardsMode` entries) is **not needed
  here** — we migrate straight to a document instead.
- The unsupported-report-type guard (`unsupportedReportType.ts`, the `ReportMessages.tsx` message) is
  in place, in both the shell and `ChildReport`.
- `ReportOfReports` supports saved-report children, section nodes, inline-value nodes and an unknown
  placeholder. Inline children are a fourth node type in the same model.
- `Report.sections?: StoredNode[]` already exists on the record (`src/jira/reports/fetcher.ts`), and
  `SaveReports` already round-trips it.

---

## Architecture

### The inline child node type

Add to `src/react/reports/ReportOfReports/model/sections.ts`:

```typescript
export type InlineChildNode = {
  id: string;
  type: 'inline-child';
  /** A complete report config, as a `URLSearchParams`-shaped fragment. */
  params: { query: string };
} & WithRaw;
```

**Unlike `InlineReportNode`** (which holds an expression like `(issue = ABC-1).summary`), an inline
child is a whole report. Storing its config as one query string rather than a nested object is
deliberate: that is the shape `ChildReportConfig`, `parseChildQuery` and `mergeChildQuery` already
read, so nothing downstream needs a second encoding, and a node's config can be pasted to and from a
URL.

**No `overrides` key.** The `overrides` mechanism exists because a saved-report child has a saved
baseline to diff against, so a setting returned to its original value clears itself. An inline child
_is_ its own baseline. An edit writes straight into `params.query` via a new `setInlineChildQuery`
alongside `setNodeOverride` — which returns non-`saved-report` nodes untouched and must keep doing so.

**Serialization is not free.** `toStoredSections` dispatches on `unknown` / `section` /
`inline-report` and **falls through to the saved-report branch for anything else**, so an
unhandled inline child serializes as `{ type: 'saved-report', params: { reportId: undefined } }` and
is destroyed on the first save. `WithRaw` does not rescue this: it preserves unrecognized _keys on a
recognized type_; an unrecognized _type_ is `UnknownNode`'s job, and a node this client just created
has no `raw` at all. Both `parseNode` and `toStoredSections` need an explicit branch.

<a id="two-destinations"></a>

### The migration, and its two destinations

**One entry in `src/jira/reports/migrations/migrations.ts`:**

```typescript
{
  id: 'secondary-report-to-inline-document',
  addedOn: '2026-08-02',
  onDrop: 'lossy',
  describe: 'converts a legacy secondary-slot config into a report-of-reports document with inline children',
  applies: (params) => ['status', 'breakdown'].includes(params.get('secondaryReportType') ?? ''),
  migrate: (params) => {
    const mode = params.get('secondaryReportType');

    // Copy the whole bag into both children, minus the keys that describe the *page* rather than a
    // report. Frozen by hand rather than imported from SHELL_ONLY_PARAM_KEYS: a migration must mean
    // the same thing in twelve months as it does today, and importing a live list would let a future
    // edit retroactively change what this transform does. (It would also point src/jira at src/react.)
    const PAGE_KEYS = ['showSettings', 'report', 'fullscreen', 'openAutoSchedulerModal', 'sections'];
    const shared = new URLSearchParams(params);
    [...PAGE_KEYS, 'secondaryReportType', 'secondaryFilterRows', 'secondaryChildFilterRows'].forEach((key) =>
      shared.delete(key),
    );

    const primary = new URLSearchParams(shared);
    primary.set('primaryReportType', params.get('primaryReportType') ?? 'start-due');

    const cards = new URLSearchParams(shared);
    cards.set('primaryReportType', 'cards');
    cards.set('cardsMode', mode as string);
    // A card shows today iff it passes BOTH lists — the vm narrows on `filterRows` and the cards get
    // `secondaryFilterRows` as their own. `matchesAllFilterRows` requires every row to match, so
    // concatenating is lossless for the cards. This is the original plan's D4 argument, applied where
    // D4 says it belongs: an explicit conversion to Cards, never a blind param rewrite.
    setJson(cards, 'filterRows', [...json(params, 'filterRows'), ...json(params, 'secondaryFilterRows')]);
    setJson(cards, 'cardsChildFilterRows', json(params, 'secondaryChildFilterRows'));
    cards.delete('secondaryChildFilterRows');

    params.set('primaryReportType', 'report-of-reports');
    params.set('sections', JSON.stringify([inlineChildStored(primary), inlineChildStored(cards)]));
    params.delete('secondaryReportType');
    params.delete('secondaryFilterRows');
    params.delete('secondaryChildFilterRows');
  },
}
```

The transform has **one form**. Where its output lands depends on the consumer:

- **A URL** (`migrateUrlParams`, at boot). `sections` is already a real URL param that
  `ReportLayoutProvider` reads _first_, so the query-param form is the finished result. A bookmark,
  deep link or sample link works with no further wiring.
- **A saved record** (`migrateReport`, at read time). The record-level layer **lifts** the `sections`
  key out of the migrated params and onto the record's own `sections` field:

  ```typescript
  // in migrateReport, after the params pass
  const raw = params.get('sections');

  if (raw && !report.sections?.length) {
    params.delete('sections');
    return { report: { ...report, queryParams: params.toString(), sections: JSON.parse(raw) }, changed, applied };
  }
  ```

  Guarded on the record having no document already, so a lift can never clobber one. For this entry
  that cannot happen — a legacy secondary-slot record is a Gantt or a Scatter, never a document — but
  the guard is what makes the lift safe for any later entry that uses it.

**Why the lift, rather than a fallback in the provider.** `ReportLayoutProvider` reads the saved tree
in four places (the lazy initializer, the URL-change listener, the `savedKey` re-seed effect, and
`resetSections`), plus `sectionsBaseline` in `documentParam.ts` computes the baseline `updateUrlParam`
compares against. A `queryParams['sections']` fallback has to be added to **all five** or the document
silently blanks: the re-seed effect fires on mount, sees no URL param so doesn't bail, computes the
saved tree as empty, finds that differs from what's on screen, and adopts the empty tree. Putting the
document in the field the provider already reads deletes that entire class of bug, and the save path
already writes that field.

<a id="idempotency"></a>

### Idempotency

`applies` reads `secondaryReportType`; `migrate` deletes it. So `applies` is false on the next pass,
which is the postcondition `migrateQueryParams` checks and warns about. This matters more than it
looks: the write layer keys off `changed`, and `persistMigrations` overwrites the **site-wide**
saved-reports blob wholesale. An entry that always applies rewrites shared storage once per session,
forever.

Deleting the keys costs nothing. Once the document exists it carries everything the legacy keys said,
so they are not insurance — they are just a permanently-true trigger.

### Cards as a primary report type

**`configuration/reports.ts`:**

```typescript
{ key: 'cards', name: 'Cards', featureSubtitle: 'Status and work-breakdown cards, one per issue', featureFlag: 'cardsReport', onByDefault: false }
```

This entry alone creates the `cardsReport` feature flag (`configuration/features.ts` derives flags
from the non-default reports) and _forces_ both registry entries — `registry.test.ts` asserts
`reportComponents` keys exactly equal the config's keys, and `embeddableReportComponents` equals that
set minus `report-of-reports`.

**`registry.ts`:** `cards: WorkBreakdown` inside `embeddableReportComponents`. `shellRegistry.ts`
spreads it and needs no edit.

**`route-data.js`:** add `cardsMode` (default `'status'`, values `'status' | 'breakdown'`) and
`cardsChildFilterRows` (default `[]`, JSON), using the same
`saveJSONToUrlButAlsoLookAtReport_DataWrapper` helpers as their `secondary*` counterparts. Add both to
`CHILD_PARAMS` in `ChildReportConfig.js` so children carry them and the drift test passes.

**`reportProps.ts`:** `propsFor` gains `planningIssuesObs`, `cardsModeObs`, `cardsChildFilterRowsObs`.
`filterRowsObs` is **not** wired — the vm already filtered (original plan D4).

> `reportProps.test.ts` pins the key set to the list captured at extraction time, and its comment
> explicitly says not to edit it to match a failing `propsFor` — that provenance is the whole point of
> the test. Add a separate, dated `POST_EXTRACTION_ADDITIONS` list and assert
> `keys === [...AT_EXTRACTION, ...ADDITIONS]`.

**`WorkBreakdown.tsx`:** read the mode from `cardsModeObs`. It needs the legacy `secondaryReportTypeObs`
prop **only if Phase 1 and Phase 3 ship in different releases** — see the note under
[§ Phases](#phases).

**Controls:** a `CardsViewSettings` (mode select + `StatusesShownAsPlanning`) wired into
`ViewSettings.tsx`'s local report list, its `viewSettingsMap`, and its `primaryReportType !==` guard
(currently four-way, becomes five). `Filters.tsx` shows the child-filter section when
`primaryReportType === 'cards'`. `ReportControls.tsx` needs no new branch — its default branch is
right for Cards. `PRINTABLE_REPORT_TYPES` in `PrintReportButton.tsx` gains `'cards'`; cards now live in
`#react-report-container`, so `--print-scale` applies to them for the first time — verify a wide board
against `src/css/print.css`.

**Watch for** (inherited from the original plan, still open):

- `ReportArea.tsx` shows `EmptyResultMessage` when `primaryIssuesCount === 0`. A board whose issues are
  all in planning statuses has zero primaries but a non-empty Planning card, and would render "empty".
- `timeline-report-view-model.js` — with `primaryReportType === 'cards'`, `hideUnknownInitiatives`
  falls back to the `startBeforeDue` rule. Cards show no timeline, so hiding date-less issues is
  arguably wrong.
- `ReportFooter.tsx` has no entry for `cards`; confirm the status key isn't wanted.

### ChildReport and inline children

`ChildReportProps.report` becomes optional, and the component takes the node's query instead when it
is absent:

```typescript
const savedQuery = report?.queryParams ?? inlineQuery;
```

Everything downstream is unchanged: `ChildReportConfig`, `TimelineReportViewModel`, `propsFor` and the
report component itself cannot tell the difference — an inline child is just another source of
`queryParams`. Three details:

- The name shown on the node's row comes from the child's report type, not a saved report's name.
  `MissingReportNote` and the `data-report-name` testid branch on `report` being present.
- `unsupportedReportType` is called with the node's query rather than a saved record, so a child saved
  as a dead report type still reports itself properly.
- `React.memo` on `ChildReport` is load-bearing (a document re-renders on every hover). Pass the node's
  query string, which is stable by value; do **not** synthesize a pseudo-report object in the parent,
  which would be a fresh reference every render and defeat the memo.

### Everything else the node type touches

Adding a fourth node type is not three files:

| File                                         | Change                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `model/sections.ts`                          | type, factory, `parseNode` branch, `toStoredSections` branch, `setInlineChildQuery`                        |
| `ReportOfReports.tsx`                        | `LayoutNodeView` dispatch branch + an `InlineChildView`                                                    |
| `model/childQueryGroups.ts`                  | `collectSavedReports` only collects saved-report nodes, so inline children are invisible to request-dedupe |
| `components/ChildReport.tsx`                 | optional `report`, inline query prop                                                                       |
| `components/NodeControls`, `DocumentEditing` | a label for the new node type                                                                              |

The dedupe walker matters more than it looks: this migration produces exactly the case that module
exists for — two children over one JQL. In practice a Gantt and a card board contribute no table
columns, so their requests are already byte-identical and the `getRawIssues` singleflight collapses
them. It stops being free the moment a document mixes an inline child with a Table.

### Delete the slot

In the same phase, and now including its outward-facing half:

**Internal:** remove `showSecondaryReport.ts` + test; `secondaryPropsFor` from `reportProps.ts`; the
bare `export { WorkBreakdown }` from `registry.ts`; `<WorkBreakdown>`, `secondaryProps`, `showSecondary`
and `#react-secondary-report-container` from `TimelineReport.tsx`; `SecondaryReportType/` and its use in
`GanttViewSettings.tsx` and `ScatterPlotViewSettings.tsx` (keeping `StatusesShownAsPlanning`, which
feeds the vm's planning filter for every report); the two secondary sections in `Filters.tsx` and the
`useSecondaryFilterRows/` and `useSecondaryChildFilterRows/` hook directories; the legacy props and
mode mapping in `WorkBreakdown/{WorkBreakdown.tsx,types.ts}` and their test and stories.

**Route data:** remove `secondaryReportType`, `secondaryFilterRows` and `secondaryChildFilterRows`,
**and** their entries in `SHELL_ONLY_PARAM_KEYS`. These move together: the drift test
(`ChildReportConfig.test.js`) fails the build if a route-data param is in no bucket, so removing them
from the bucket while leaving them in route data is not a legal intermediate state. Removing them is
safe because nothing can reach route data carrying them — the boot rewrite strips them from any URL
before `route.start()`, and the record migration strips them from stored data at read time.

**Outward-facing:**

- `configuration/features.ts` — retire the now-orphaned `secondaryReport` flag, and add the original
  plan's **D6 alias** in `jira/features/fetcher.ts`'s `getFeatures`, mapping a saved
  `secondaryReport: true` onto `cardsReport`. Without it, `Features.tsx`'s `removePreviousFeatures`
  silently drops the unknown key and everyone who opted in is reset. Update `Features.test.tsx`.
- `SampleDataNotice.tsx` — rewrite the two sample links that carry `secondaryReportType`. Doing this
  rather than letting the boot rewrite handle them keeps anonymous visitors off the document path
  entirely (`ReportOfReports` calls `useAllReports`, a suspense query against storage, which those
  links have no reason to need).
- `scripts/atlassian-connect/index.ts` — drop `secondaryReportType` from the deep-link template and add
  `cardsMode`. **This regenerates the published `atlassian-connect.json` and needs a coordinated
  descriptor deploy.**
- `playwright/unauthenticated/sample-reports-navigation.spec.ts` — retarget the URL and container
  assertions from `#react-secondary-report-container` at `#react-report-container`.
- Comment-only cleanups in `src/examples/bitovi-training.js` and `public/examples/bitovi-training.js`.

**No deprecation warning.** The slot never existed in a supported config, and the migration is silent
and automatic.

<a id="phases"></a>

## Phases

> **Sequencing note.** If Phase 1 and Phase 3 land in the same release, `WorkBreakdown.tsx` never needs
> to accept the legacy `secondaryReportTypeObs` at all — the dual-prop branch exists only to keep
> `secondaryPropsFor` working in the window between them. Squashing them is the smaller diff; keeping
> them apart makes the behavioural change reviewable on its own. Decide before starting Phase 1.

### Phase 1 — Cards as a primary report type

Additive. The slot still exists and renders.

- `configuration/reports.ts` — the Cards entry (this creates the `cardsReport` flag).
- `registry.ts` — `cards: WorkBreakdown`.
- `route-data.js` — `cardsMode`, `cardsChildFilterRows`; both into `CHILD_PARAMS`.
- `reportProps.ts` — the three new props; `reportProps.test.ts` — the dated additions list.
- `WorkBreakdown.tsx` — read the mode from `cardsModeObs`.
- `ViewSettings.tsx` (list, map, guard), `Filters.tsx`, `PrintReportButton.tsx`.

**Exit:** Cards appears in the dropdown behind its flag, renders standalone with a working mode select
and child filters, and works as a saved-report child in a document. Every legacy `secondaryReportType`
URL renders exactly as before.

### Phase 1.5 — Inline children

- `sections.ts` — type, factory, parser branch, serializer branch, `setInlineChildQuery`.
- `ReportOfReports.tsx` — dispatch branch and view.
- `ChildReport.tsx` — optional `report`, inline query.
- `childQueryGroups.ts` — collect inline children.
- `NodeControls` / `DocumentEditing` — labelling.

**Tests:** parse/serialize round trip **including a save after an edit** (the failure mode is a node
silently becoming a broken saved-report reference); render an inline child with a full config; edit
one; add, delete, reorder; a document mixing inline children with saved-report children groups
correctly for dedupe.

### Phase 2 — The migration

- `migrations.ts` — the entry.
- `migrations/index.ts` — the `sections` lift in `migrateReport`, guarded on the record having no
  document.

**Tests:** applies for `status` and `breakdown` only, not for `none` or absent; **`applies` is false
after `migrate`** (the postcondition the whole write layer rests on); the input params are not mutated;
both children carry every non-page param from the original; the cards child's `filterRows` is the
concatenation of both legacy lists; the lift moves `sections` onto the record and out of
`queryParams`; the lift is skipped when the record already has a document; the URL consumer leaves
`sections` in the query string; the EOL test sees the new entry.

**Exit:** every URL, saved report, deep link and sample link carrying
`secondaryReportType=status|breakdown` renders as a document with two inline children, from the moment
the migration runs.

### Phase 3 — Delete the slot

Everything in [§ Delete the slot](#delete-the-slot), internal and outward-facing, plus the route-data
removal.

**Exit:** no UI path creates a secondary-slot config, no code reads one, and legacy configs render as
documents.

---

<a id="accepted-costs"></a>

## Accepted costs

These are consequences of deleting the grace period, taken deliberately.

**Colleagues on a cached bundle see placeholder rows.** `persistMigrations` overwrites the
saved-reports blob shared by the whole Jira site. The moment one person on the new build loads the app,
anyone still running an older bundle parses `type: 'inline-child'` as an `UnknownNode` and gets two
"Unsupported content (inline-child)" rows where their Gantt and card board used to be — and since the
migration deletes the legacy keys, their old slot has nothing left to render from either. It resolves
on reload.

It is a display failure, not a data one: an older client's `parseSections` keeps each original node in
`params.raw`, and `toStoredSections` writes it back untouched, so even a save from that older client
preserves the document intact.

**A legacy report embedded in a document starts refusing to render.** Any `saved-report` node pointing
at a record this migration flips now shows "A Report of Reports cannot be embedded inside another one"
(`ChildReport.tsx`). Rare — `reportOfReports` is `onByDefault: false` — but silent.

**Migrated links get long.** The boot rewrite stamps the full document JSON, URL-encoded, into
bookmarks and deep links, on top of the params already there. A config with large `filterRows` or
`statusesToShow` lists can produce a URL long enough to matter to a proxy. Rewriting our own sample
links by hand (above) removes the most-trafficked case.

**Migrated documents are view-only.** Users cannot author an inline child from the UI, and there is no
panel for editing one in place — the node's config is reachable only by hand-editing the `sections`
param. Acceptable for an unsupported feature; see the open questions.

---

## What doesn't happen in this plan

- **No Phase 3.5 (split into report-of-reports button).** The migration does it for everyone,
  automatically.
- **No release delay.** The slot goes the moment the migration lands.
- **No flag graduation.** `cardsReport` and `reportOfReports` both stay `onByDefault: false`. Users
  without the flags cannot author new Cards or documents, but they can still _view_ migrated records —
  `SelectReportType` resolves the current report against the full `REPORTS` list, not the filtered
  dropdown, specifically so a URL can select a flag-hidden report.
- **No Phase 5 rename.** `WorkBreakdown/` stays as-is internally even though the report is
  user-visibly "Cards".

---

## Trade-offs vs the original plan

| Aspect                     | Original Plan                                             | This Plan                                              |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Slot lifecycle             | Phases 3–4: a release delay plus a deprecation notice     | Deleted immediately                                    |
| Migration fidelity         | Params only; the two-reports-in-one-URL case is unfixable | Lossless — both reports, both configs                  |
| What the user does         | Reads a notice, rebuilds by hand                          | Nothing                                                |
| Control after migration    | View-only                                                 | View-only (same outcome)                               |
| Complexity                 | Two rendering paths for one release                       | A fourth node type, plus a record-level migration lift |
| Blast radius               | Contained; nothing shared is rewritten                    | Site-wide storage rewritten; older clients degrade     |
| Blocked on flag graduation | Yes (Phase 4)                                             | No                                                     |

---

## End of life

`onDrop: 'lossy'` — the report still renders as itself; only a setting could revert. After 12 months
(the EOL policy in the migrations sub-plan) the entry can be deleted:

- Stored records have already converged: their document is in the `sections` field and their report
  type is `report-of-reports`, so nothing needs the entry to render.
- A config that never converged — an un-opened bookmark, a deep link, an anonymous session — loses its
  card board and keeps its timeline, which is the outcome the original plan's § Migration policy signed
  up for anyway.
- The `secondary*` params are already gone from route data by then, so there is nothing to remove.

---

## Open questions

1. **`inline-child` vs `inline-report` is a confusable pair.** One holds a whole report config, the
   other a single field expression, and the names don't say which. Worth renaming one before this
   ships — `inline-report` → `inline-value` matches what its component is already called
   (`InlineValue`), and is a cheap rename while the schema has few writers.
2. **Should `cardsMode` default to `status`?** Migrated records carry their old mode explicitly, so
   this only affects a Cards report created from the dropdown. Recommend `status`.
3. **Per-child editing.** Out of scope here. A "cards view settings" panel inside the `ChildReport` is
   the obvious Phase N if demand appears.
4. **Should the empty-result gate count planning-only boards as non-empty?** Inherited unanswered from
   the original plan.
