# Render rich-text (ADF & wiki-markup) work item values in Report of Reports

## Context

Jira has a custom field, **"Status Update"** (`customfield_10844`), of schema type `paragraph` — it supports
rich text, but stores/returns it using Atlassian's legacy **wiki markup** syntax (`h1. heading`, `* bullet`,
`||col||`-style tables), not ADF (the JSON format Jira uses for `description`/comments).

Picking this field as a Report of Reports "Work Item Value" (Add Report → Work Item Value → pick issue +
field) currently renders:

> `"Status Update" holds a string this can't show as text yet. (issue = SUNNYSUSHI-54).customfield_10844`

**Root cause**, confirmed by reading the code:

- `InlineValue.tsx` (`src/react/reports/ReportOfReports/components/InlineValue.tsx:53-70`) calls
  `formatFieldValue(state.value, state.field.schema)`. When it returns `null`, `InlineValue` shows this
  exact error text, interpolating `state.field.schema.type` — which is why the message says "a string": Jira's
  `/api/3/field` catalog reports `schema.type: "string"` for this field (and, notably, also for
  `description` — Jira uses `"string"` as the generic schema type for **any** text-storing field,
  regardless of whether its _value_ is a plain string, an ADF document, or wiki markup).
- `formatFieldValue` (`src/react/reports/ReportOfReports/model/formatFieldValue.ts:58-62`) already
  special-cases ADF: `value.type === 'doc' ? null : labelOf(value)`. It was written expecting only two
  shapes — scalar strings and ADF documents — and deliberately returns `null` for ADF because "rendering it
  as text needs a walker" (its own doc comment). Wiki markup is a **third** shape it wasn't written for at
  all: a string, but one that isn't meant to be shown as raw text either.
- The pieces needed to render rich text already exist and are proven in production: `AdfDocument`
  (`src/react/components/AdfDocument/AdfDocument.tsx`) wraps `@atlaskit/renderer` (lazy-loaded) with a
  lightweight local-walker fallback, and is already used for comment/status-update bodies in
  `CommentReport.tsx`. `InlineValue` just never calls it.

**Outcome of this plan:** picking a field whose _live_ value is either an ADF document (e.g. `description`,
or any other ADF-bearing field) or a wiki-markup string (e.g. `customfield_10844`) renders that value as
real rich text — heading, list, table and all — the same way Jira itself renders it, reusing the existing
`AdfDocument` machinery. Every other field type (plain strings, numbers, dates, users, selects, arrays)
keeps behaving exactly as it does today; this is additive, not a rewrite of `formatFieldValue`.

**Explicitly out of scope** (separate `plan.md` later, not this one):

- Anything about showing a field's value _as of a past date_ — no hardcoded date, no changelog lookup.
- The interactive "slider" control (à la Gantt's `CompareSlider`) for picking a comparison date in RoR.
- The value shown is always the field's **current** live value, exactly like every other Work Item Value
  field today.

Also explicitly unaffected: Table report's `fieldValueText.ts`/`fieldTypeRegistry.ts` (a deliberately
separate, non-shared implementation — see `formatFieldValue.ts`'s own doc comment on why), the `.comment`
dead-end message, and the Latest Comment / Status Update _derived_ presets (`CommentReport.tsx`,
`useLatestComment`, `useStatusUpdate`) — a different code path that already renders ADF correctly. Note:
the _derived_ preset is also labeled "Status Update" in the field picker; it will keep sitting alongside the
real custom field of the same name (distinguished only by the picker's "Derived" vs "Fields" group headers)
— confirmed acceptable, no relabeling needed.

## Key files

| File                                                                                          | Role                                                                                                             |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/react/reports/ReportOfReports/components/InlineValue.tsx`                                | Renders one work-item-value node; owns the error message; needs the row+block rich-content branch                |
| `src/react/reports/ReportOfReports/model/formatFieldValue.ts`                                 | Value → text formatter; currently returns `null` for ADF; needs to classify instead of just formatting text      |
| `src/react/reports/ReportOfReports/model/resolveField.ts`                                     | Resolves accessor → `{id, name, schema}`; `schema` currently drops `custom`, needed to detect wiki-markup fields |
| `src/react/reports/ReportOfReports/hooks/useInlineExpression.ts`                              | Fetches the live value via `fetchJiraIssuesWithJQLWithNamedFields` — unchanged                                   |
| `src/react/components/AdfDocument/AdfDocument.tsx` (+ `RichAdf.tsx`, `AdfBlocks/`)            | Existing ADF renderer (lazy `@atlaskit/renderer` + local-walker fallback) — reused as-is                         |
| `src/react/reports/ReportOfReports/components/CommentReport.tsx`                              | Precedent for row (label) + block (`AdfDocument`) layout, and the prose/table CSS to share                       |
| `src/react/reports/ReportOfReports/model/formatFieldValue.test.ts`, `InlineValue.stories.tsx` | Existing tests/stories to extend                                                                                 |

## Design

### 1. Carry `schema.custom` through field resolution

Jira's field catalog (`/api/3/field`, surfaced via `useJiraIssueFields()`) already includes `schema.custom`
— the field-type identifier string, e.g. `com.atlassian.jira.plugin.system.customfieldtypes:textarea` for a
wiki-rendered "Paragraph" field vs `...customfieldtypes:textfield` for a plain single-line text field. Both
report `schema.type: "string"`, so `custom` is the only signal that distinguishes them.

`resolveField.ts`'s `FieldSchema` only keeps `{ type, items }` today (`resolved()`, line 38-42) — extend it
to also keep `custom`:

```ts
export interface FieldSchema {
  type?: string;
  items?: string;
  custom?: string;
}
```

and copy it through in `resolved()`. This is the only change to `resolveField.ts`.

### 2. Classify the value instead of only formatting text

`formatFieldValue` currently returns `string | null`. Rich content needs to become React content, not text,
so add a classification step `InlineValue` consults instead of (or alongside) `formatFieldValue`. Recommend
a new function — e.g. `classifyFieldValue(value, schema)` in `formatFieldValue.ts` itself (small file,
single existing caller) — returning a tagged union:

```ts
export type FieldValueDisplay =
  | { kind: 'empty' }
  | { kind: 'text'; text: string } // existing behavior, unchanged
  | { kind: 'adf'; document: unknown } // value.type === 'doc'
  | { kind: 'wiki'; markup: string } // string value + schema.custom marks a wiki/paragraph field
  | { kind: 'unsupported'; schemaType?: string };
```

Logic, layered on the existing checks in `formatFieldValue`:

- Empty/array/date/scalar-non-string cases: unchanged, mapped to `empty`/`text`.
- A string value where `schema.custom` ends in `:textarea` (the classic wiki-markup-capable paragraph
  field type) → `{ kind: 'wiki', markup: value }`. Any other string → `{ kind: 'text', text: value }`,
  exactly as today (so a "Summary"-like plain string field is completely unaffected).
- An object (`isRecord`) with `value.type === 'doc'` → `{ kind: 'adf', document: value }` (previously
  `null`). Otherwise fall back to `labelOf(value)` → `text` or `unsupported`, as today.

`formatFieldValue`'s existing `string | null` signature can stay for any other caller, or be reimplemented
in terms of the new classifier — decide during implementation; the Table report is unaffected either way
since it never imports this module.

### 3. Wiki markup → ADF, via the official Atlassian transformer

Confirmed available: `@atlaskit/editor-wikimarkup-transformer` (npm, latest `12.2.0`) — the same
parser Atlassian uses internally for wiki↔ADF conversion. Its peer packages (`@atlaskit/adf-schema`,
`@atlaskit/editor-json-transformer`, `@atlaskit/editor-prosemirror`) are **already present** in
`node_modules` transitively via `@atlaskit/renderer`/`@atlaskit/editor-common`, so this is the only new
direct dependency to add to `package.json`.

Usage:

```ts
import { WikiMarkupTransformer } from '@atlaskit/editor-wikimarkup-transformer';
import { JSONTransformer } from '@atlaskit/editor-json-transformer';

const pmNode = new WikiMarkupTransformer(schema).parse(wikiMarkupString); // ProseMirror node
const adfDocument = new JSONTransformer().encode(pmNode); // ADF JSON
```

`adfDocument` is exactly what `AdfDocument`'s `document` prop already accepts — the wiki case reuses the
**same renderer** as the ADF case, just with a conversion step in front. (The `schema` instance to construct
`WikiMarkupTransformer` with is the one remaining implementation detail — resolve it during implementation,
e.g. via `@atlaskit/adf-schema`'s schema builder or whatever `@atlaskit/renderer` constructs internally;
this is a small lookup, not a design risk.)

This conversion pulls in the same heavy editor stack `RichAdf.tsx` already lazy-loads, so it must live
behind the same lazy boundary — do not import `@atlaskit/editor-wikimarkup-transformer` eagerly anywhere.
Concretely: a new sibling module, e.g. `src/react/components/AdfDocument/WikiAdfDocument.tsx`, following
`AdfDocument.tsx`'s exact `React.lazy` pattern — parse + encode + render in one lazy-loaded chunk, with a
plain-text (or no) fallback while it loads (wiki markup has no cheap local walker equivalent to
`AdfBlocks`, so a brief loading state is acceptable here, unlike the ADF case).

### 4. InlineValue: row + block for rich content, unchanged pill for everything else

A single-line truncated pill (`InlineValue.tsx:80`, `<span className="truncate ...">`) cannot hold a
heading, list, or table. Rich content needs the row-plus-block layout `CommentRow`/`CommentBody`
(`CommentReport.tsx`) already established for Latest Comment/Status Update.

Restructure `InlineValue`'s `ok`-status branch to switch on `classifyFieldValue(...)`:

- `text` / `empty` / `unsupported` → **exactly today's rendering** (pill, or the `Problem` error) —
  zero behavior change for every field type this bug doesn't touch.
- `adf` → field name as a row header (same `reportTitleClassName`/`reportTitleColorClassName` styling used
  today), then `<AdfDocument document={display.document} fallbackClassName={...} />` beneath it.
- `wiki` → same row header, then the new lazy `WikiAdfDocument` beneath it.

Extract the prose/table CSS `CommentReport.tsx` currently keeps private (`STATUS_UPDATE_PROSE_CLASSNAME`,
`COMMENT_TABLE_STYLES`) into a small shared module (e.g.
`src/react/reports/ReportOfReports/components/richTextStyles.ts`) so both `CommentReport.tsx` and the
updated `InlineValue.tsx` import the same constants instead of duplicating CSS.

## Verification

- Run the app locally (dev server / `launch-dev` flow), open Report of Reports, Add Report → Work Item
  Value, pick `SUNNYSUSHI-54` and the **"Status Update"** field from the **Fields** group → should render
  formatted rich text (heading, bullet list, table) instead of the error message.
- Also pick **Description** (or any other ADF-bearing field) as a Work Item Value, to confirm the generic
  `adf` branch fixes the same underlying bug for _any_ rich-text field, not only this one — this is the
  regression check that proves the fix isn't wiki-markup-specific.
- Pick a plain field (Summary, Assignee, Priority, a date field) and confirm it renders exactly as before —
  regression check on the unchanged `text`/pill path.
- Confirm the `.comment` dead-end message (pointing at Latest Comment / Status Update) is unchanged.
- Extend `formatFieldValue.test.ts` (or add a sibling `classifyFieldValue.test.ts`) with cases for: ADF doc
  value, wiki-markup string value (using the exact sample from the bug report, including its table), plain
  string value (must stay `text`, not `wiki`), and the existing empty/array/date/label cases (must be
  unchanged). Add/extend `InlineValue.stories.tsx` with an ADF-value story and a wiki-markup-value story.

## Explicitly deferred to a future `spec/031-*/plan.md`

Rollback/"as of a past date" support (picking a field's value as it stood on an earlier day) was originally
scoped into this plan, which is why this spec was briefly named with a `-rollback` suffix. It's been pulled
out entirely: this plan and its directory now cover only the rich-text rendering fix above, and everything
below is notes to seed a **separate, later spec** (`spec/031-*`, name TBD) — not a section of this one.

- An interactive slider (à la Gantt's `CompareSlider` / `useCompareTo`, see
  `src/react/ReportControls/components/CompareSlider/`) to pick an "as of" date for Report of Reports
  values, and the question of how/whether it should affect saved (non-inline-value) reports on the same
  page.
- Resolving a field's value as of a past date from Jira's changelog. The existing whole-issue
  `rollbackIssue`/`rollbackIssues` (`src/jira/raw/rollback/rollback.ts`) reconstructs full issue state
  generically by replaying an already-fully-fetched changelog, but it's built for the main fetch pipeline's
  bulk issue set, not a one-off single-issue/single-field lookup done outside it — and its ordering
  assumption (newest-first) isn't guaranteed to hold for the current `fetchBulkChangelogs` path. A small
  dedicated resolver scoped to one issue + one field id (via `fetchBulkChangelogs({ issueIdsOrKeys: [key],
fieldIds: [id] })`, sorting `created` ascending itself rather than trusting API order) is the likely
  shape — conceptually the same walk as `poc.go`'s `findValueAsOf`, minus its live per-page REST calls. Left
  for the `031` plan, along with the hardcoded-date stopgap ("last Friday") the user suggested trying
  before building the real slider.

### Open questions the `031` plan must resolve before implementation

Grounded in how RoR's node types actually work today (confirmed by reading the code, not assumed):

**1. Does the slider only affect inline-value nodes, or also `saved-report`/`inline-report` nodes?**

`saved-report` and `inline-report` nodes are not read-only embeds of something pre-rendered elsewhere —
each one instantiates a fully independent child report (`SavedReportView`/`InlineReportView` →
`ChildReport`, `ReportOfReports.tsx:175-180,347-497`), with its own `ChildReportConfig` and its own data
fetch. So "it's a saved report, we can't touch it" isn't quite the right framing: the question is really
whether this feature's scope is _only_ the inline-value work-item-value nodes this plan already covers, or
whether it should also reach into every embedded report on the page.

**2. How complex is affecting saved/inline reports, concretely — is it in scope?**

Less complex than it first looks, but not free. `ChildReportConfig` already treats `compareTo` as a
**per-child** parameter, resolved independently from each node's own `queryParams` rather than shared
page-level route state (`childParamProps`/`resolveFromParams`, `ChildReportConfig.js:156-172,284,334-336`)
— unlike parameters that genuinely fall back to the parent/page. The actual obstacle: `compareTo` is
explicitly listed in `NON_OVERRIDABLE_CHILD_PARAM_KEYS` (`ChildReportConfig.js:284`), so an in-document edit
to it is never written back onto the node — because parsing a picked date into that param is lossy (it
collapses to a relative "N days ago" offset, not an absolute date, the same lossiness `CompareSlider`
itself has to manage via `useTimeSliderValue`'s piecewise mapping). Removing that exclusion is a real but
bounded chunk of work, not an open-ended one. **Decide:** is lifting that exclusion (making each embedded
report's `compareTo` independently overridable from the RoR document) in scope for the `031` plan, or
should that plan explicitly restrict itself to inline-value nodes only and leave saved/inline reports
alone?

**3. Should each inline-value (and, if in scope, each embedded report) get its own independent slider, or
one shared slider for the whole document/section?**

There's already a precedent for genuinely independent per-node state in this exact document model: the
`overrides`/`query` mechanism (`sections.ts`) keys each `saved-report`/`inline-report` node's config diff
by node id, independent of its siblings and of any page-level state. A per-inline-value "as of" date would
be consistent with that existing pattern, not a new one. The tradeoff to decide: independent sliders give
precise control per value but add a control to every single node (more UI, more state to reason about,
and — if question 2 says yes — a third bucket of per-node state alongside `overrides` and `query`); one
slider shared across a section (or the whole document) is simpler to build and use, but means adjusting
one inline value's date always moves every other rolled-back value on the page with it. **Decide before
building anything**, since it changes where the date state lives (per-node in `sections.ts`, vs. one value
at the document/section level) and isn't a refactor to do after the fact.
