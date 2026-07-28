# 016 — Report of Reports: self reports (inline field values)

Third in the series, after [`../001-basic-layout-builder/plan.md`](../001-basic-layout-builder/plan.md)
(the document tree) and [`../002-nested-sections/plan.md`](../002-nested-sections/plan.md) (grouping).
Both shipped; this one is **not built** — the design below is the proposal.

## Context

A report-of-reports document can hold sections and embedded saved reports. It can't state a _fact_.
Users want to write a live value into a document — the summary of a specific work item, a due date, a
story-point total — so the document reads "Blocked on Migrate auth to OIDC" and stays true without
anyone editing it.

The syntax requested:

```
(workItem = SYSTEMS-918).summary
 └────────┬──────────┘  └──┬──┘
        JQL              field
```

The inner half is JQL. The `.field` half is not — it's the `fields` argument every Jira search in this
app already carries. That reframing is the whole design: the expression decomposes into the arguments
of a call the app already makes in production.

### What already exists

`src/jira/storage/index.web.ts:51` already runs arbitrary JQL against named fields, to read the app's
own configuration issue:

```ts
await jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields<{ Summary: string; Description: {…} }>({
  jql: `summary ~ "${configurationIssueTitle()}"`,
  fields: ['summary', 'Description'],
});
```

It mixes a field **id** (`'summary'`) and a **display name** (`'Description'`) in one array —
`fetchJiraIssuesWithJQLWithNamedFields` (`src/jira-oidc-helpers/jira.ts:93`) resolves both through
`nameMap`, then maps the response back to name keys via `mapIdsToNames`. Around it: the typed field
catalog (`useJiraIssueFields()`), duplicate-display-name tracking (`deriveFieldMaps` →
`ambiguousFieldIds`, `src/jira-oidc-helpers/fields.ts:37`), and `JiraProvider` +
`QueryClientProvider` already wrapping the report body (`TimelineReport.tsx:215`). **None of this needs
to change.**

### What doesn't exist

No parser of any kind, anywhere in the repo. No `inline-report` node — what exists is a comment
(`model/sections.ts:14`) and a test asserting the type currently degrades to an "unknown" placeholder
(`model/sections.test.ts:69`), which only proves that adding it needs no migration. No authoring UI, no
single-value rendering, no cardinality or error handling.

So: a few hundred lines of genuinely new code on top of unchanged infrastructure.

### Decisions (locked with the user)

- **Its own block node**, not prose interpolation. `{ type: 'inline-report'; params: { expression } }` —
  the shape `sections.ts` already anticipates. Text nodes and mail-merge interpolation stay out of scope.
- **Exactly one match required.** One match renders the value; zero or several render an inline error.
  Predictable in a document, and it pushes users toward key-based queries.
- **Free-text expression input** (recommendation, not asked): one field, the terse syntax above. The
  alternative — a `JqlEditor` plus a field dropdown — needs no parser, but it isn't the syntax
  requested. The parser is ~40 lines and the error states have to exist either way.

---

## Phase 1 — The splitter (`model/expression.ts`, new)

The only novel logic. Pure — no Jira, no React.

```ts
export type ParsedExpression = { jql: string; field: string };
export const parseExpression = (source: string): ParsedExpression | { error: string } => …
```

**A regex cannot do this.** Scan from the leading `(`, tracking paren depth and quote state (`'` and
`"`, honouring backslash escapes), and stop at the paren that returns depth to zero. The remainder must
then be `.<field>`. The cases that break naive splitting:

| Input                                        | Why                                                |
| -------------------------------------------- | -------------------------------------------------- |
| `(summary ~ "foo)bar").duedate`              | a paren inside a quoted string                     |
| `(project = A AND (x = 1 OR y = 2)).duedate` | nested groups — `lastIndexOf('.')` also fails here |
| `(summary ~ "say \"hi\"").summary`           | escaped quotes                                     |
| `(key = X).Story points`                     | field names contain spaces                         |

Return a discriminated union rather than throwing, matching the tolerant style of the rest of the model.
Error cases: no leading `(`, unbalanced parens, unterminated quote, empty JQL, missing or empty accessor,
and **more than one accessor** (`.assignee.displayName`) — rejected in v1 with a message naming the
limitation, since a user field already renders as its display name.

## Phase 2 — Field resolution (`model/resolveField.ts`, new)

Given the accessor and the catalog from `useJiraIssueFields()` (each entry carries `name`, `id`,
`schema`, `clauseNames`), resolve in order: exact `id` → exact `name` → case-insensitive `name` →
`clauseNames` match. Returns `{ id, name, schema }` or an error.

`.summary` is an **id**; `.Story points` is a **display name** — both must work, which is why the order
matters. When two fields share a display name, error with the candidates listed and tell the user to use
the id: exactly the spec/015-field-selection problem, and silently picking one is what that spec already
rejected.

## Phase 3 — Fetch (`hooks/useInlineExpression.ts`, new)

`useQuery` — **not** `useSuspenseQuery`, so a bad expression fails in place instead of blanking the
document:

```ts
queryKey: [...jiraKeys.all, 'inline-expression', jql, fieldId];
queryFn: () => jira.fetchJiraIssuesWithJQLWithNamedFields({ jql, fields: [field.name], maxResults: 2 });
```

**`maxResults: 2` is the cardinality trick** — telling "exactly one" from "more than one" needs only two
rows. Verified honored: `fetchJiraIssuesWithJQL` (`jira.ts:206`) delegates to `searchJiraIssuesWithJQL`,
which sets `maxResults` on the query string. The new `/search/jql` endpoint returns no `total`, so the
error message must read "more than one work item matched" rather than a count — say only what we know.

Add the key to `src/react/services/jira/key-factory.ts`. Identical `(jql, field)` pairs dedupe through
React Query for free; different JQLs cannot be batched.

Returns a discriminated state: `{ status: 'loading' }` | `{ status: 'error', message }` |
`{ status: 'ok', value, field }`.

## Phase 4 — Render and author

- **`components/InlineValue.tsx` (new)** — pure and prop-driven, taking the resolved state as props so it
  stories and unit-tests with no Jira, the way `MissingReportCard` takes an injected `controls`. A
  container reads the hook.
  - `formatFieldValue(value, schema)` — a small local formatter keyed on `schema.type`: string, number,
    date/datetime, user (`displayName`), array (join `name`/`value`), option (`value`), status (`name`).
    **Do not** import `TableReport`'s `getFieldTypeEntry`: its `render(value, ctx)` requires a
    `RenderContext` carrying a `TableIssue`, so reuse would mean fabricating a fake issue. Borrow the
    type-switch approach, not the code.
  - The error state renders inline and muted **with the expression visible**, following
    `MissingReportCard` — the document keeps rendering around it.
  - It's content, not chrome: no `print-hidden`.
- **`model/sections.ts`** — add `InlineReportNode` to `LayoutNode` and the `inline-report` variant to
  `StoredNode`; `parseNode` accepts it (tolerating a missing `expression` as `''`); `toStoredSections`
  writes it back. `childrenOf` returns `undefined` for it, so the depth cap and every tree op are
  unaffected.
  - **Two existing tests must change** (`sections.test.ts:69`, `:134`) — they currently assert that
    `inline-report` degrades to a placeholder. That's the canary for this behaviour change, not a
    breakage to route around.
- **`components/AddContentRow.tsx`** — a third button, "Add Value". The row then carries three buttons at
  every level; if that reads as crowded, the fix is one "Add ▾" split button, not dropping a level's
  affordance.
- Editing reuses the inline-edit affordance from `SectionTitle` (a `Textfield` inside
  `@atlaskit/inline-edit`), so a value is edited like a section title. Parser and resolver errors surface
  in the read view.

---

## Files

**New** — all under `src/react/reports/ReportOfReports/`

- `model/expression.ts` + `.test.ts`
- `model/resolveField.ts` + `.test.ts`
- `hooks/useInlineExpression.ts` + `.test.ts`
- `components/InlineValue.tsx` + `.stories.tsx`

**Modified**

- `model/sections.ts` + `.test.ts` (new node type; the two placeholder tests above)
- `ReportOfReports.tsx` (a `LayoutNodeView` branch), `components/AddContentRow.tsx`
- `src/react/services/jira/key-factory.ts` (one query key)

**Deliberately unchanged:** `src/jira-oidc-helpers/*`, `fields.ts`, `mapIdsToNames`, `JiraProvider`,
`useJiraIssueFields`, `ReportLayoutProvider`, `SaveReports.tsx`. No migration — older documents load
unchanged, and a document written with inline values still opens in a client that predates them: it
degrades to the "unknown" placeholder and round-trips intact.

## Verification

- `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- Unit: the four splitter cases in the table above; resolver id / name / ambiguous cases; the formatter
  per `schema.type`.
- Storybook: `InlineValue` in ok / loading / error states.
- **Verify `workItem` is even valid JQL.** `issue`, `issuekey`, `key`, and `id` are; "work item" is
  Jira's newer UI term and may not be a JQL field. The app already calls
  `/rest/api/3/jql/autocompletedata` (`fetchJqlAutocompleteData`), whose `visibleFieldNames` settles it
  against the real instance. If it isn't valid, the docs and error copy should say `issue`.
- End-to-end (needs Jira credentials): a real key with `.summary`; a custom field with a space in its
  name; a field name shared by two fields (expect the disambiguation error); a query matching zero; a
  query matching several; save → reload → same values; print.

## Risks / caveats

- **Rich-text (ADF) fields.** `description` and comment bodies come back as an ADF document, not a
  string. v1 should render an explicit "unsupported field type" rather than `[object Object]`; a
  plain-text ADF walker is a follow-up.
- **One request per distinct expression.** Identical `(jql, field)` pairs dedupe via the query key, but a
  document with many different expressions issues many searches. Grouping several fields of the _same_
  JQL into one request is a natural follow-up.
- **The document renders differently per viewer.** A JQL matching one item for one user may match none
  for another, by Jira permissions — so an inline value can be an error for a colleague. Inherent to live
  values; worth saying in the UI copy.
- **Printing races the fetch.** Values load asynchronously, so printing before they resolve prints
  loading states. Check how `PrintReportButton` sequences this.
- **Saved-report size.** This is the "when text nodes land" trigger `001-basic-layout-builder` deferred
  to: free text in documents brings the ~32KB Jira description cap into play, alongside the known
  `routeData.serialize()` bloat.
- **Field ids are stable, display names are not.** An expression storing `.Story points` breaks if an
  admin renames the field, where `.customfield_10014` wouldn't. Accepting names is the friendly choice;
  the cost is that documents can rot silently.

## Out of scope

- Text nodes and prose interpolation (`{{ … }}`), per the decision above.
- Multi-hop accessors (`.assignee.displayName`), aggregates (`sum(…)`), and arithmetic.
- Cross-expression references, or referencing an embedded report's data.
