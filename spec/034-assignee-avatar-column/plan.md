# 034 — "Assignee & Avatar", a synthetic Table column

The Table report's default column, **Icon & Summary**, is _synthetic_: Jira has no such field. It
composes two real Jira values — the issue-type icon and the summary — into one cell
([`fieldTypeRegistry.ts:237-271`](../../src/react/reports/TableReport/model/fieldTypeRegistry.ts)).
This spec applies the same trick to the assignee: a **profile picture beside the person's name**.

The rendering is the easy half. The half worth writing down is the **field-request wiring** — copying
the Icon & Summary pattern verbatim produces a column that passes every unit test and renders blank
in the real app.

> **Numbering.** `034` was previously reserved by
> [`spec/030-inline-custom-field-report/plan.md`](../030-inline-custom-field-report/plan.md) §
> _Explicitly deferred to a future `spec/034-*/plan.md`_ (the rollback / "as of a past date" work,
> already renumbered `031` → `032` → `034`). Arthur assigned `034` to this column instead, so that
> deferred work moves to `035`; 030's forward reference still needs repointing, exactly as commit
> `6f2540c1` did when 033 took its number.

---

## Context

Assignee reaches the table today only as a bare generic column. It is unclaimed by
[`BUILTIN_CONCEPTS`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts), so it falls
through to the generic loop and is built by `buildFieldColumn`
([`buildColumnCatalog.ts:58-86`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts)) as
`field:assignee` in the **Fields** group, rendered as plain text through `fieldValueText` →
`displayName`.

The raw value is the Jira user object, verbatim, under the **display-name** key
`issue.fields['Assignee']` — documented at
[`fieldValueText.ts:4`](../../src/react/reports/TableReport/model/fieldValueText.ts) and fixtured at
[`fieldValueText.test.ts:18-27`](../../src/react/reports/TableReport/model/fieldValueText.test.ts):

```ts
{ self: '…/rest/api/3/user?accountId=abc', accountId: 'abc',
  displayName: 'Arthur Pankiewicz', emailAddress: '…',
  avatarUrls: { '48x48': 'https://…/avatar.png' }, active: true }
```

**Nothing in `src/` reads `avatarUrls` today.** The only `avatarUrl` in the codebase is
`Team.avatarUrl` ([`src/jira/shared/types.ts:59`](../../src/jira/shared/types.ts)), and it is never
rendered. `@atlaskit/avatar` is **not** a dependency.

---

## Decisions (locked with Arthur)

| Decision                            | Choice                                                                                                                 | Why                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Registration                        | A curated **`Common`** facet with `requires: ['Assignee']` — _not_ an `identity:*` column, and no `CORE_FIELDS` change | §1. It is the only route that makes the field actually load without slowing every other report down |
| The existing bare `Assignee` column | **Keep both.** The concept claims nothing, so `field:assignee` stays untouched under **Fields**                        | Saved reports already using it keep working                                                         |
| Cell rendering                      | 16px **round** avatar + display name, matching Icon & Summary's metrics                                                | Visual parity; the two columns line up                                                              |
| Unassigned                          | **Blank cell**                                                                                                         | Consistent with every other null value in the table                                                 |

---

## 1. Why this is a `Common` facet and not an `identity:*` column

This is the load-bearing section. The obvious implementation — a fifth identity column beside
`treeSummaryColumn`, `issueKeyColumn`, `summaryColumn`, `issueTypeColumn` — is **wrong**, and wrong
in a way unit tests do not catch.

The app does not download every Jira field. It downloads `CORE_FIELDS` plus whatever the _shown
columns_ declare they need:

1. [`route-data.js:416-422`](../../src/canjs/routing/route-data/route-data.js) — `tableColumnFields`
   maps each shown column's `sourceId` through `requiredFieldsFor`.
2. `requiredFieldsFor` ([`builtinFieldRegistry.ts:267-272`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts)):
   a `builtin:*` facet → its declared `requires`; `field:<id>` → that id; **`identity:*` → `[]`**.
3. [`route-data.js:436-461`](../../src/canjs/routing/route-data/route-data.js) — `allFieldsToRequest`
   unions that with `fieldsToRequest`, gated by `sameRequestedFields(…, CORE_FIELDS, …)` so a column
   whose field is already core triggers no refetch.
4. [`jira-data-requests.js:114`](../../src/stateful-data/jira-data-requests.js) —
   `fieldsToLoad = [...new Set([...fields, ...CORE_FIELDS])]`.

`CORE_FIELDS` ([`core-fields.ts:8-20`](../../src/stateful-data/core-fields.ts)) is
`summary, Rank, Issue Type, Fix versions, Labels, Status, Sprint, Created, Parent, Team, Linked
Issues`. **`Assignee` is not in it.**

Icon & Summary gets away with declaring nothing because summary and Issue Type are always loaded. An
`identity:assigneeAvatar` column would declare nothing, request nothing, and render an empty cell for
every row — while its unit tests, which hand it a fixture with the field already populated, stay
green. The facet route closes that gap, and brings two more things with it:

- **An availability gate.** A facet is offered only when every id in `requires` is in the loadable
  field set ([`buildColumnCatalog.ts:236-245`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts)),
  so the column hides itself on an instance where Assignee is not available, rather than appearing
  and doing nothing.
- **No global cost.** Adding `Assignee` to `CORE_FIELDS` would make every report on every screen
  fetch it forever, to serve one optional column.

**The id-space wrinkle:** `requires` must use the Jira **display name** `'Assignee'`, not the id
`assignee`. The fetch pipeline renames every response field key id → name via `mapIdsToNames`, and
`route-data.js` translates `requires` through the name-based `nameMap`. The precedent, with the long
explanatory comment, is `builtin:project:name` / `requires: ['Project']`
([`builtinFieldRegistry.ts:94-106`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts));
see also [`requested-fields.ts:22-38`](../../src/canjs/routing/route-data/requested-fields.ts). The
availability gate lowercases both sides, so `'Assignee'` matches the field's `key` either way.

---

## 2. The registry entry

A new concept appended to `BUILTIN_CONCEPTS`
([`builtinFieldRegistry.ts:80-200`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts)):

```ts
{
  // Assignee is NOT a CORE field, so this facet must declare `requires` or the column renders
  // blank in production — see spec/034 §1. `requires` uses the display name, not the id, for the
  // same reason `builtin:project:name` does (the response-key rename above).
  concept: 'assignee',
  // Deliberately claims NOTHING. Every other concept claims its field to suppress the bare
  // duplicate; this one WANTS the duplicate — the existing `field:assignee` column stays in
  // `Fields` so saved reports using it keep working (Arthur's call).
  claims: [],
  facets: [
    {
      sourceId: 'builtin:assignee:avatar',
      label: 'Assignee & Avatar',
      requires: ['Assignee'],
      schemaType: 'user',
      get: assigneeName,
    },
  ],
}
```

`assigneeName` is a new module-private helper beside `fieldObjectName`
([`builtinFieldRegistry.ts:56-59`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts)) —
`fieldObjectName` reads `.name`, and a Jira user object has `displayName` instead:

```ts
/** Read the assignee's display name (`issue.fields['Assignee'].displayName`). */
function assigneeName(issue: TableIssue): unknown {
  const raw = issue.fields?.['Assignee'] as { displayName?: unknown } | undefined;
  return raw?.displayName;
}
```

Two consequences of `claims: []` the implementer should not "fix":

- `CLAIMED_FIELD_IDS` ([`:248-250`](../../src/react/reports/TableReport/model/builtinFieldRegistry.ts))
  is unchanged, so the set-difference at
  [`buildColumnCatalog.ts:255-261`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts)
  still emits `field:assignee`. **That is the point.**
- `nominalFieldId = concept.claims[0] ?? ''` ([`buildColumnCatalog.ts:240`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts))
  becomes `''`, so `source.fieldKey` falls back to the sourceId. `source` is descriptive metadata
  only (see the `buildBuiltinColumn` JSDoc) — cosmetic, and not worth special-casing the loop for.

`schemaType: 'user'` gives `distinct` as the default aggregation via `defaultAggregationForType`
([`aggregations.ts:120-138`](../../src/react/reports/TableReport/model/aggregations.ts)) and
`textEntry` compare/render from the field-type registry, which §5 then overrides for display.

---

## 3. `getValue` returns the name, never the avatar URL

Mirrors `treeSummaryColumn`, whose `getValue` is `issue.summary` while the icon is pulled off
`ctx.issue` inside `render`
([`fieldTypeRegistry.ts:246-248`](../../src/react/reports/TableReport/model/fieldTypeRegistry.ts)).

Four things break if `get` returns anything else:

| Consumer               | Needs the display name because                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `textEntry.compare`    | Sorting is A→Z **by person**, not by URL                                                                                                                                                                 |
| Select-filter options  | [`TableReport.tsx:206-215`](../../src/react/reports/TableReport/TableReport.tsx) builds `distinctValues` from `fieldValueText(column.getValue(issue))` — return a URL and the filter dropdown lists URLs |
| The `distinct` reducer | Dedupes on the stringified value ([`aggregations.ts:96-106`](../../src/react/reports/TableReport/model/aggregations.ts))                                                                                 |
| Group labels           | Grouping _by_ this column labels each group with the value                                                                                                                                               |

---

## 4. The renderer

It lives in
[`normalizedRenderers.tsx`](../../src/react/reports/TableReport/model/normalizedRenderers.tsx),
not the registry: `fieldTypeRegistry.ts` is deliberately `.ts` and `createElement`-only (file header
`:10`), while `normalizedRenderers.tsx` is the established `.tsx` home for richer cell renderers
(`statusRender`, `iconRender`, `labelsRender` at `:35-60`).

```tsx
/**
 * Render an assignee as their avatar + display name (spec/034). The value is the display name (see
 * §3); the avatar URL is read off the raw field object on `ctx.issue`, exactly as the tree column
 * reads its icon. Unassigned renders blank, like every other empty value in the table.
 */
export function assigneeAvatarRender(value: unknown, ctx: RenderContext): React.ReactNode {
  if (value == null || value === '') return '';
  const assignee = ctx.issue?.fields?.['Assignee'] as { avatarUrls?: Record<string, string> } | undefined;
  const src = assignee?.avatarUrls?.['24x24'] ?? assignee?.avatarUrls?.['48x48'];
  const name = String(value);
  return (
    <span className="flex items-center min-w-0">
      {src && <img src={src} alt="" width={16} height={16} className="mr-1.5 flex-none rounded-full" />}
      <span className="truncate min-w-0" title={name}>
        {name}
      </span>
    </span>
  );
}
```

Details that are deliberate:

- **`flex`, not `inline-flex`**, with `flex-none` on the image and `min-w-0`/`truncate` on the name.
  The reasoning is already written out at
  [`fieldTypeRegistry.ts:249-251`](../../src/react/reports/TableReport/model/fieldTypeRegistry.ts)
  and [`:128-133`](../../src/react/reports/TableReport/model/fieldTypeRegistry.ts): the row must fill
  the cell's real width so the text has something concrete to shrink against, and the image must
  never be the thing that shrinks.
- **`alt=""`** — the name is right there in the same cell, so the image is decorative. Icon & Summary
  uses `alt="Issue type"` only because nothing else names it there.
- **`rounded-full`** — Jira serves square avatars; every Atlassian surface renders them circular.
  `@atlaskit/avatar` is not a dependency and this does not justify adding one; Tailwind does it in
  one class.
- **The avatar is conditional.** A user object without `avatarUrls` degrades to the bare name, never
  a broken-image glyph.
- **`24x24` preferred over `48x48`** — closest to the rendered 16px, and `48x48` is the size the
  fixtures happen to carry, so the fallback is exercised.
- **No `SUMMARY_MAX_WIDTH` equivalent.** That 420px cap
  ([`fieldTypeRegistry.ts:108-118`](../../src/react/reports/TableReport/model/fieldTypeRegistry.ts))
  exists because summaries are long. Person names are not. `truncate` still needs a bound to bite,
  so it only takes effect if the surrounding cell is constrained — acceptable; revisit only if a
  real name is seen stretching a column.

---

## 5. Presentation wiring

One line in `FACET_PRESENTATION`
([`buildColumnCatalog.ts:186-195`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts)),
the catalog-layer override map that keeps the registry render-free:

```ts
'builtin:assignee:avatar': { render: assigneeAvatarRender, filter: { kind: 'select' } },
```

`select` rather than `text`, because assignees are a bounded set of people — the same call as
`builtin:status:name`. It also keeps **Distinct list** on the aggregation menu, since
`aggregations.distinct.applicableTo` is `['text', 'select']`
([`aggregations.ts:116`](../../src/react/reports/TableReport/model/aggregations.ts)) and
`applicableAggregations` keys off `filter.kind`
([`grouping.ts:168-175`](../../src/react/reports/TableReport/model/grouping.ts)).

Nothing else needs touching. `buildColumnCatalog` already emits every concept's facets into
**Common**, and `AddColumnButton`
([`components/AddColumnButton.tsx:29-38`](../../src/react/reports/TableReport/components/AddColumnButton.tsx))
already orders `Common` first and leaves it unsorted, so the new entry appears in registry order with
no picker change.

---

## 6. What it deliberately is not

- **Not tree-capable.** `TREE_CAPABLE_IDS`
  ([`buildColumnCatalog.ts:279-283`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts))
  is untouched; the hierarchy caret stays on the summary/key columns.
- **Not an identity column.** `isIdentity` / `isTree` are not even reachable here —
  `buildBuiltinColumn` ([`:204-220`](../../src/react/reports/TableReport/model/buildColumnCatalog.ts))
  does not pass them through.
- **No avatars in group headers or aggregated cells.** `buildBuiltinColumn` also drops
  `renderMeasure`, so a grouped "Distinct list" measure falls through to `formatMeasureValue`
  ([`grouping.ts:160-165`](../../src/react/reports/TableReport/model/grouping.ts)) and joins names
  with `", "`; and grouping _by_ the column shows the plain text label, because
  [`TableReport.tsx:1208-1223`](../../src/react/reports/TableReport/TableReport.tsx) re-uses a
  column's renderer for group labels only when `isIdentity && isTree`. Both fall back to correct,
  readable text — accepted. The fix, if it ever matters, is small: add an optional `renderMeasure`
  to `FacetPresentation` and pass it through `buildBuiltinColumn`.

---

## Phases

Each phase leaves the suite green and commits on its own.

1. **Registry + catalog.** The `assignee` concept, the `assigneeName` helper, and its tests
   (`requiredFieldsFor`, the accessor, the catalog assertions). At this point the column exists and
   renders as plain text.
2. **Renderer + presentation.** `assigneeAvatarRender` and the `FACET_PRESENTATION` line, with
   render tests. The column now shows avatars.
3. **Docs.** Repoint 030's deferred-work reference from `034` to `035`.

---

## Test impact

| File                                                                                                                | Change                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`model/builtinFieldRegistry.test.ts:8-47`](../../src/react/reports/TableReport/model/builtinFieldRegistry.test.ts) | New `requiredFieldsFor('builtin:assignee:avatar')` → `['Assignee']` case — **the regression guard for §1**. Plus `getBuiltinFacet(…)?.get(issue)` for a populated assignee and for unassigned → `undefined`                                                                                                                      |
| [`model/buildColumnCatalog.test.ts:45-61`](../../src/react/reports/TableReport/model/buildColumnCatalog.test.ts)    | The `common` group is asserted with `arrayContaining`, so it tolerates the addition — add an explicit `builtin:assignee:avatar` assertion anyway. The exact-array `identity` assertion (`:31`) is untouched, since nothing is added there                                                                                        |
| same file                                                                                                           | Assert `field:assignee` is **still present** in `Fields` — the guard for the "keep both" decision                                                                                                                                                                                                                                |
| `model/normalizedRenderers.test.tsx`                                                                                | `assigneeAvatarRender`: avatar + name when both present; name only when `avatarUrls` is missing; `''` when unassigned. Follow the plain-object element inspection used in [`fieldTypeRegistry.test.ts:67-79`](../../src/react/reports/TableReport/model/fieldTypeRegistry.test.ts)                                               |
| [`TableReport.test.tsx`](../../src/react/reports/TableReport/TableReport.test.tsx)                                  | `mockFields` (`:10-22`) **already includes** `{ name: 'Assignee', key: 'assignee', schema: { type: 'user' }, id: 'assignee' }`, so the availability gate passes with no fixture change. Add an integration case adding the column and asserting the name renders, using the assignee fixture from `fieldValueText.test.ts:18-27` |

---

## Verification

### Tests

```
npm run test        # vitest
npm run typecheck   # tsc
```

### Manually, in the app

- **+ Add column → Common → "Assignee & Avatar"** — it is there, above the Fields group.
- Avatars render beside names; rows with nobody assigned are blank; a name too long for its column
  truncates with the full text on hover.
- Sorting the column is A→Z by person.
- The column filter is a **select** listing people's names — not URLs, not `[object Object]`.
- **The point of §1:** do this from a _cold load_ on a report that never previously requested
  Assignee (fresh reload, not just re-adding the column in an open session). The cells must be
  populated. If they are blank, the `requires` wiring is wrong.
- The bare **Assignee** entry is still present under **Fields**, and adding both at once works.

---

## Out of scope

- Avatars in group headers and aggregated cells (§6).
- Multi-user picker fields (arrays of user objects).
- An `@atlaskit/avatar` dependency.
- Reporter / Creator equivalents.
- Making the column tree-capable.
- The per-column `width` that `TableColumnEntry` persists
  ([`persistence.ts:19-23`](../../src/react/reports/TableReport/model/persistence.ts)) but nothing
  currently applies to rendering.

---

## Open questions

1. **Should a plain `builtin:assignee:name` facet join the concept later**, mirroring the
   issueType concept's name + icon pair? _Proposed: no. The bare `field:assignee` already covers it,
   and adding one would only make sense alongside `claims: ['Assignee']` — which Arthur ruled out._
2. **Reporter and Creator are the same shape** — generalise the renderer to any `user`-typed field?
   _Proposed: not yet. Generalise on the second caller, not the first._
3. **Should the avatar appear in the 2D cross-tab's frozen label column** when this is the row
   axis? _Proposed: out of scope, folded into §6's trade-off — revisit with `renderMeasure`._
