# 016 — Report of Reports: 009-value-report-modal

Move work-item value authoring out of the inline add row and into the Add Report modal, give it a work-item
typeahead plus a field picker, and make the resulting node read-only.

**Supersedes 007-latest-comment-report Phase 5 and § Editing can't un-make the node.** Everything else in
007 stands — the node type, the grammar, the accessor, the fetch, and the ADF rendering are untouched.

## Context

007 shipped `Add Work Item Update` as a fourth button on every section's add row
(`AddContentRow.tsx:159`). It seeds an `inline-value` node with `(issue = ).latestComment` and drops the
user into a bare key field. UX feedback: authoring a value should happen where authoring a report already
happens — the modal behind `Add Report` — and the user should _pick_ a work item and _pick_ a field rather
than type a key into an unexplained box.

The modal becomes:

```
Add Report                                          (modal title)
────────────────────────────────────────────────────
Value Report                                        (subtitle)
[ work item typeahead ]  [ Field ▾ ]           [ + ]
────────────────────────────────────────────────────
Saved Report                                        (subtitle)
[ Search reports by name or type… ]
  ▸ Alpha    ▸ Beta    …                            (unchanged)
```

**The payoff is bigger than the move.** 007 shipped `latestComment` as a _preset_ of the parked "Add Value"
feature precisely so that no new node type was needed. A field dropdown makes every Jira field selectable
through the same two controls, so **"Add Value" un-parks** — not as an expression box (parked three times
for good reason), but as pick-an-item + pick-a-field. `Latest Comment` becomes one entry in that list. One
authoring path, two controls, and the commented-out `Add Value` block finally gets deleted rather than
parked a fourth time.

**How a node renders is unchanged.** `isLatestCommentExpression` still dispatches
(`ReportOfReports.tsx:141`), `LatestCommentView` still renders the ADF body, `InlineValueView` still renders
the pill. `model/sections.ts`'s node shape, `model/expression.ts`, and the two fetch hooks are untouched, so
**a document saved before this change opens byte-identical after it.**

### Decided with the user

- **Field list = Jira's field catalog + one derived entry.** Built from `useJiraIssueFields()` — the same
  catalog `resolveField` resolves against. _Not_ `buildColumnCatalog`: Table's `Computed` and
  `Report Fields` columns read `derivedTiming` and normalized rollup values off a `TableIssue`, and an
  inline value is a raw Jira search response, so those entries would be offered and then render nothing.
  What _is_ reused is `AddColumnButton`'s searchable-popover **UI**, extracted.
- **The work-item input is a typeahead** over `/rest/api/3/issue/picker`, not a plain key field.
- **Value Report shows at the document root too.** 007 made the button section-only on the reasoning that a
  note belongs beside what it comments on; one modal that changes shape by origin is more to explain and
  more to test than that is worth, and a value at the top of a document ("as of ABC-1's latest update…") is
  a reasonable thing to want. A deliberate reversal of 007 § Reversed after implementation.
- **A value node is read-only.** Wrong work item or wrong field? Delete the node and add another. See below.

## The node stops being editable

The decision that pays for the rest of the plan.

**Why it came up.** With a field picker, the stored expression has to name a field — and Jira lets two
different fields share a display name. `resolveField.ts:49` already handles that by refusing:
_"2 fields are named "Story points" (customfield_10014, customfield_10232). Use the field id instead."_ So
picking one specific field from a dropdown and then storing its _name_ can produce an error in the document
for a choice that was never ambiguous. Storing the **id** is correct — but `(issue = ABC-1).customfield_10014`
is what a hand-editor would then see in the row's edit field, which is a worse thing to show than the name.

**The resolution is to remove the edit field.** The modal already collects both halves and validates them;
re-typing them into a raw expression box afterwards is a second, worse authoring path for the same node.
Once nothing displays the expression, it becomes an internal storage format and the id-versus-name question
disappears rather than being traded off. `NodeControls` already carries `DeleteConfirm`, so delete-and-re-add
is a path that exists today.

**What that deletes.** 007's § Editing can't un-make the node is a two-part bug fix for a defect that only a
raw expression field can produce — typing `ASDF` into a comment node's key field turned it into an ordinary
inline value with an unparseable expression, and the only way out was to hand-type the full expression back.
That whole section, both fixes, `looksLikeKey`, and the two integration tests that pin them go away, because
nothing can type into the node any more.

| Symbol                                     | Sole caller                           | Fate                     |
| ------------------------------------------ | ------------------------------------- | ------------------------ |
| `looksLikeKey` (`accessors.ts:100`)        | `ReportOfReports.tsx:477`             | **deleted**              |
| `setExpressionAt` (`sections.ts:344`)      | the two `onConfirm`s (`:411`, `:479`) | **deleted** (+ its test) |
| `EXPRESSION_PLACEHOLDER` (both components) | the edit fields                       | **deleted**              |
| `TargetKind` / `targetKind`                | key-vs-expression field choice        | **deleted**              |
| `issueKeyOf` (`accessors.ts:81`)           | also titles the row                   | **kept**, display only   |
| `beginEditing` (`DocumentEditing.tsx:13`)  | still `SectionTitle`'s (`:213`)       | **kept**, unchanged      |

`issueKeyOf` survives because the latest-comment row's heading is the work item key (007 § The row is the
key). Its contract shrinks from _"can a key field represent this JQL?"_ — the question that needed forty
lines of docblock to justify — to _"what should this row be titled?"_, and its docblock shrinks with it. A
hand-written-JQL node (`(project = ABC).latestComment`, still reachable from a saved document) titles itself
with the JQL, as it does today.

**Copy that must change.** The latest-comment blank-key state reads _"Enter a work item key — for example
ABC-1."_ (`LatestComment.tsx:145`) — an instruction the UI can no longer carry out. It becomes a statement of
fact: _"No work item set."_ `InlineValue`'s blank state already renders an empty `min-h-5` paragraph
(`:63`); the min-height stays, but its reason changes from "keeps the row clickable to edit" to "keeps the
row hoverable so its delete control can be reached" — worth correcting in the comment, since a zero-height
row would be an undeletable one.

Neither blank state is reachable from the modal, which requires both halves before `+` enables. They exist
only for documents saved earlier or URLs edited by hand.

---

## Phases

### Phase 1 — extract the searchable picker

`AddColumnButton.tsx:41` already is the component this needs: `@atlaskit/popup` + `@atlaskit/textfield` + a
grouped, substring-filtered list of buttons, with per-group headers and an empty state. Lift it to
`src/react/components/SearchablePicker/`, generic over `{ id, label, group }`:

```ts
interface PickerItem {
  id: string;
  label: string;
  group: string;
}

interface SearchablePickerProps {
  items: PickerItem[];
  groupOrder: string[]; // groups not listed are dropped, as today
  excludeIds?: string[]; // AddColumnButton's "already shown" filter
  placeholder: string; // "Search columns…" / "Search fields…"
  emptyMessage: string;
  testIdPrefix: string; // "table-add-column" / "ror-field"
  trigger: (props: unknown, toggle: () => void) => ReactNode;
  onSelect: (id: string) => void;
}
```

`trigger` is a render prop because the two callers differ: Table's is a fixed `+ Add column` button, ROR's
must show the currently-selected field name (or `Field` when nothing is picked).

`AddColumnButton` becomes a thin wrapper mapping `ColumnDefinition[]` → `PickerItem[]`, keeping its
`GROUP_ORDER` and its `table-add-column*` test ids, so **`TableReportControls.test.tsx` is the regression net
and must pass unchanged.** Do this phase in its own commit, green before anything new lands on it.

### Phase 2 — the work-item picker fetch

- `fetchIssuePickerSuggestions` in `src/jira-oidc-helpers/jira.ts`, beside `fetchJqlAutocompleteSuggestions`
  (`:99`) and shaped like it: `/api/3/issue/picker?query=…`. Scope `read:jira-work`, already requested
  (`.env.example`). Response is
  `{ sections: [{ id, label, issues: [{ key, keyHtml, summary, summaryText }] }] }` — `hs` is
  recently-viewed, `cs` is the query match.

  **Why the picker endpoint and not a JQL search:** JQL cannot prefix-match keys. `key` supports `=`, `in`,
  `>`, `<` — there is no `key ~ "ABC-1*"` — so a search-based typeahead over keys is not merely awkward, it
  is impossible. The picker endpoint is what Jira's own issue pickers use, and it takes a plain URL-encoded
  query rather than an interpolated JQL string, which removes the escaping and 400-on-unparseable-key
  hazards entirely.

- Expose it in the `createJiraHelpers` return (`jira-oidc-helpers/index.ts:96`).
- `jiraKeys.workItemSuggestions(query)` in `src/react/services/jira/key-factory.ts`, following
  `jiraKeys.inlineExpression` (`:22`).
- `hooks/useWorkItemSearch.ts` — `useDebounce(input, 300)` (`src/react/hooks/useDebounce`, already used at
  `Theme.tsx:63`) feeding a `useQuery`. React Query supplies the caching, request dedupe, and stale-response
  discarding that `@atlaskit/select`'s `AsyncSelect` `loadOptions` would make us hand-roll. Flatten both
  sections, dedupe by key, return `{ key, summary }[]`.

  **Enabled on the empty query too, deliberately:** the `hs` section is a recently-viewed list, which is a
  better resting state for the picker than a blank box.

  `useQuery`, not `useSuspenseQuery` — a failed suggestion lookup must leave the modal usable.

The endpoint matches key **and** summary and offers no parameter to disable the latter. That over-delivers
against "we only care about the key", which is harmless, but it means summary matching is not a later flag —
it ships here.

### Phase 3 — the field catalog

`model/fieldCatalog.ts` in ROR, new and pure:

```ts
export type FieldGroup = 'Derived' | 'Common' | 'Fields';
export interface FieldOption {
  id: string;
  label: string;
  group: FieldGroup;
}

export const buildFieldOptions = (fields: JiraFieldLike[]): FieldOption[] => …
export const buildValueExpression = (issueKey: string, fieldId: string): string => …
```

- `Derived` — one entry: `{ id: LATEST_COMMENT_ACCESSOR, label: 'Latest Comment' }`, from
  `model/accessors.ts:24`. First in `groupOrder`, so it is the first thing in an unfiltered list.
- `Common` — a small curated set of Jira field **ids** a raw search returns directly: `summary`, `status`,
  `assignee`, `reporter`, `priority`, `issuetype`, `duedate`, `labels`. A local constant, **not**
  `BUILTIN_CONCEPTS` — those facets are `get: (issue: TableIssue) => …` readers over rolled-up issues and
  have no meaning against a search response.
- `Fields` — every remaining catalog entry, minus the ids promoted to `Common`. `useJiraIssueFields` already
  returns them name-sorted (`:57`).

`buildValueExpression` is the one place that knows `latestComment` is special: the derived id routes to
`latestCommentExpression(key)` (`accessors.ts:49`), everything else to `` `(issue = ${key}).${fieldId}` ``.
**It always writes the field id**, which is now a free choice rather than a trade-off — nothing displays the
expression, so the id's ugliness costs nothing and its uniqueness is pure gain (see § The node stops being
editable).

Takes `JiraFieldLike[]` (`resolveField.ts:16`) so it unit-tests with a two-entry array and no Jira.

### Phase 4 — `ValueReportForm`

`components/ValueReportForm.tsx` — the Value Report row. Owns both fetches; everything below it is pure.

- **Work item**: `@atlaskit/select` with `inputValue`/`onInputChange` driving `useWorkItemSearch`,
  `filterOption={() => false}` (the server filtered; do not re-filter), `isLoading`, options labelled
  `ABC-123 — Summary` with `value: key`.
- **Field**: `<SearchablePicker>` from Phase 1 over `buildFieldOptions(useJiraIssueFields())`, its trigger
  showing the selected label or `Field`.
- **`+`**: an `@atlaskit/button` `IconButton`, `isDisabled` until both halves are chosen. On click, emit
  `buildValueExpression(key, fieldId)` via `onAdd`.

Since the node cannot be corrected afterwards, `+` staying disabled until both halves are chosen is the only
validation there is, and it has to actually hold.

**`useJiraIssueFields` is a suspense query, and ROR's only Suspense boundary is at the top of the island.**
`ReportOfReportsWrapper.tsx:34` wraps the entire `<ReportOfReports>` in `<Suspense fallback={'Loading…'}>`.
The field catalog is normally fetched by `useInlineExpression` (`:33`), so a document that already holds
inline values has it warm — but a document with none has not, and that is exactly the document someone is
looking at when they add their first value. Without a nearer boundary, opening the modal would blank the
whole document to the word `Loading…` and then rebuild it. Wrap the field picker in a local
`<Suspense fallback={…}>` inside the form so only the dropdown waits.

### Phase 5 — make the value nodes read-only

Both views lose their edit half. Neither loses anything else — the fetch, the states, the collapse, the
controls, the print behaviour, and the dispatch are all as they are.

`components/InlineValue.tsx` — drop `InlineEdit`, `Textfield`, `EXPRESSION_PLACEHOLDER`, and the
`isEditing` / `onEdit` / `onConfirm` / `onCancel` props. What is left is today's `ReadView` (`:58`) promoted
to be the whole component: blank, loading, error, the `Problem` branch with its `.comment` signpost, and the
name-plus-pill. Props narrow to `{ expression, state }`.

`components/LatestComment.tsx` — drop `InlineEdit`, `Textfield`, both placeholders, `TargetKind`, and the
same four props. The row becomes the work item key as a plain `h3` at the `text-base font-semibold` 007 § The
row is the key specifies. `LatestCommentBody` and `formatCommentTime` are untouched. Props narrow to
`{ target }`.

`ReportOfReports.tsx` — `InlineValueView` (`:393`) and `LatestCommentView` (`:437`) stop reading
`editingNodeId` / `beginEditing` / `endEditing` and stop calling `setExpressionAt`. `LatestCommentView` keeps
`issueKeyOf` for the heading and keeps passing the JQL to `useLatestComment`; the `targetKind` branch and the
`looksLikeKey` line (`:477`) go.

`model/accessors.ts` — delete `looksLikeKey`; rewrite `issueKeyOf`'s docblock for its narrower job.
`model/sections.ts` — delete `setExpressionAt`.

Copy changes as listed in § The node stops being editable.

### Phase 6 — wire the modal and delete the old button

`AddReportModal.tsx`:

- Two `<h3>` subtitles, `Value Report` then `Saved Report`, with the existing search + `ReportRow` list under
  the second — unchanged, including the `described.length === 0` copy and `useReportSearch`'s ↑/↓/↵/Esc
  handling (`useReportSearch.ts:52`).
- Render `<ValueReportForm onAdd={onAddValue} />` under the first.
- New prop `onAddValue: (expression: string) => void`, beside the existing `onSelect`.

`ReportOfReports.tsx` — `handleAddValue` beside `handleSelect` (`:70`), the same three lines with
`inlineValueNode(expression)` in place of `savedReportNode(reportId)`, appending at `pickerPath ?? []` and
then `closeReportPicker()`. **No `beginEditing`** — there is nothing left to edit.

`AddContentRow.tsx`:

- Delete the `!isRoot && <AddButton text="Add Work Item Update" …>` block (`:159-181`).
- **Delete the commented-out `Add Value` block** (`:137-158`) rather than leaving it. It has been parked
  three times; the modal now does what it was for, better. Say so in the docblock instead of keeping the
  code.
- Drop the now-unused `inlineValueNode` and `latestCommentExpression` imports.
- Update the docblock: the row is `[+ Add Report] [+ Add Section]` at every level again, and `Add Report`
  opens a modal that adds either kind.

---

## Files

**New**

- `src/react/components/SearchablePicker/` — `SearchablePicker.tsx`, `index.ts`, `.test.tsx`
- `src/react/reports/ReportOfReports/model/fieldCatalog.ts` + `.test.ts`
- `src/react/reports/ReportOfReports/hooks/useWorkItemSearch.ts` + `.test.tsx`
- `src/react/reports/ReportOfReports/components/ValueReportForm.tsx` + `.test.tsx` + `.stories.tsx`

**Modified**

- `components/AddReportModal.tsx` — two subtitles, the form, one new prop
- `components/AddContentRow.tsx` — two blocks deleted, imports and docblock
- `components/InlineValue.tsx`, `components/LatestComment.tsx` — read-only; edit halves removed
- `ReportOfReports.tsx` — `handleAddValue`; both value views lose their editing wiring
- `model/accessors.ts` — `looksLikeKey` deleted, `issueKeyOf` docblock rewritten
- `model/sections.ts` — `setExpressionAt` deleted
- `TableReport/components/AddColumnButton.tsx` — becomes a wrapper over `SearchablePicker`
- `src/jira-oidc-helpers/jira.ts` + `index.ts` — `fetchIssuePickerSuggestions`
- `src/react/services/jira/key-factory.ts` — one query key
- `spec/016-report-of-reports/007-latest-comment-report/plan.md` — supersede notes

**Deliberately unchanged:** the `StoredNode` shape and every parse/serialize path in `model/sections.ts`,
`model/expression.ts`, `model/resolveField.ts`, `model/formatFieldValue.ts`, `hooks/useInlineExpression.ts`,
`hooks/useLatestComment.ts`, `components/AdfDocument/`, and the `isLatestCommentExpression` dispatch. A
document saved before this change opens byte-identical after it — it just can't be edited in place any more.

## Test impact

- **`TableReportControls.test.tsx`** — must pass **unchanged**. It is the proof Phase 1's extraction was a
  pure move.
- **`SearchablePicker.test.tsx`** — filters by substring; groups in `groupOrder`; drops empty groups; honours
  `excludeIds`; shows `emptyMessage`; clears the search on close.
- **`fieldCatalog.test.ts`** — `Latest Comment` is first; a `Common` id lands in `Common` and not in
  `Fields`; an unknown field lands in `Fields`; `buildValueExpression` writes
  `(issue = ABC-1).latestComment` for the derived id and `(issue = ABC-1).customfield_10014` otherwise.
- **`useWorkItemSearch.test.tsx`** — an injected fake jira client via `JiraProvider`, copying
  `useInlineExpression.test.tsx:25`. Covers: debounce collapses keystrokes to one request; `hs` and `cs`
  merge and dedupe by key; an empty query still asks (recently-viewed); a rejected request leaves the form
  usable.
- **`ValueReportForm.test.tsx`** — `+` disabled until both halves are chosen; picking `Latest Comment` emits
  `(issue = ABC-1).latestComment`; picking an ordinary field emits its **id**. `vi.mock` the
  `useJiraIssueFields` module the way `useInlineExpression.test.tsx:18` does, so no suspense plumbing.
- **`AddReportModal.test.tsx`** — the eleven existing tests keep their assertions, with two mechanical
  changes: `renderModal` gains the `QueryClientProvider` + `JiraProvider` + `vi.mock` wrapper, and the four
  bare `screen.getByRole('textbox')` calls (`:76`, `:87`, `:95`, `:105`) narrow to the reports field by
  placeholder — a second textbox in the modal makes the bare query throw on multiple matches. Plus: both
  subtitles render, and `onAddValue` fires with the built expression.
- **`sections.test.ts`** — the `setExpressionAt` cases are deleted. Nothing else changes; the node shape is
  the same.
- **`accessors.test.ts`** — the `looksLikeKey` cases are deleted. `issueKeyOf`'s stay: it still has to
  answer for `issue = ABC-1`, `issue =`, and a real query, just for a title now rather than a field mode.
- **`InlineValue.stories.tsx` / `LatestComment.stories.tsx` / `LatestComment.test.tsx`** — every editing
  story and assertion goes, including `EditingResolved` (007 § The row is the key names it as the review
  surface for the grow-while-editing behaviour, which no longer exists). The state stories stay and are
  still the design-review surface.
- **`ReportOfReports.test.tsx`** — the largest change, and almost all of it deletion:
  - the add-row tests naming `Add Work Item Update to Q3` (`:1089`, `:1103`, `:1110`, `:1116`, `:1219`) are
    rewritten to go through the modal;
  - the editing-recovery tests from 007 § Editing can't un-make the node — `keeps a mistyped key in the key
field rather than giving up on it`, `switches an ordinary value to a comment when the accessor is typed
in`, and the expression-field cases at `:1195`, `:1205`, `:1243`, `:1265` — are **deleted**, not
    rewritten. They pin a defect class that no longer exists.
  - every `storedValue`-seeded rendering test (`:997` onward) is **untouched**. Seeding is what keeps the
    render path covered independently of how a node gets created, and it is why this change is as small as
    it is.
  - add: a value added from the modal lands in the container the picker was opened from, at the root and
    inside a section; and a value row offers no edit affordance but still offers delete.

Net expectation: the suite shrinks. If it doesn't, something was rewritten that should have been deleted.

## Verification

- `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- Phase 1 green on `TableReportControls.test.tsx` before anything else lands.
- Storybook: `ValueReportForm.stories.tsx` with a stubbed suggestion list — resting, loading, no-results, and
  both-chosen states, no Jira.
- In the app (needs credentials, `npm start`):
  - Click `Add Report` from a section. Confirm both subtitles, and that the saved-report list behaves as
    before (search, ↑/↓, Enter, Esc).
  - Type three characters of a real key — confirm suggestions appear and that clicking one fills the field.
    Confirm the resting state shows recently-viewed before typing.
  - Pick `Latest Comment`, press `+`. Confirm the node renders the ADF comment body exactly as it does
    today, that the row shows the key, and that **clicking the row does nothing**.
  - Repeat with `Summary` and with a custom field. Confirm the pill renders and shows the field's **name**,
    not its id.
  - Confirm the node's hover controls still offer move and delete, and that delete works — it is now the
    only correction available.
  - Open the modal from the document root and confirm the Value Report row is present and adds there.
  - Confirm the add row is back to two buttons at every level, with no `Add Work Item Update`.
- **Regression:** open a document saved before this change containing a latest-comment node — it must render
  unchanged (the stored node is byte-identical), and must now be read-only. Include one with a hand-written
  JQL (`(project = ABC).latestComment`) and confirm it titles itself with the JQL rather than breaking.
- No bundle measurement needed: no dependency is added (`@atlaskit/select`, `@atlaskit/popup`, and
  `@atlaskit/textfield` are all already in `package.json`).

## Risks / caveats

- **A wrong pick costs a delete and a re-add.** The accepted trade. It is only cheap because the modal
  collects both halves up front and `+` refuses until it has them — if that validation ever loosens, this
  decision should be revisited rather than the validation.
- **Documents saved before this change may hold expressions nobody can now fix in place.** A hand-written
  JQL node, or one with a typo'd key, renders its error and can only be deleted. Acceptable: 007's editing
  path shipped recently and these are rare, and the error copy already names the problem.
- **The picker endpoint matches summaries whether we want it or not.** No parameter disables it. Harmless,
  but "key-only now, summary later behind a flag" is not available — it ships matching both.
- **Value Report at the root reverses a 007 decision.** If it reads wrong in use, the fix is a conditional in
  the modal on `pickerPath?.length === 0`, not a redesign.
- **A field can be picked that has no showable value.** `.comment`, `.attachment`, and other object-valued
  fields resolve and then dead-end in `InlineValue`'s `Problem` branch (`:82`) — and now the only way out is
  delete. That was already reachable by typing; the dropdown makes it easy. Mitigated by the existing
  `.comment` → `.latestComment` signpost (`InlineValue.tsx:84`) and by `Latest Comment` sitting at the top of
  the list. Filtering the catalog by schema type is the obvious follow-up, and read-only nodes make it a
  stronger candidate than it was.
- **Two more requests when the modal opens** — the field catalog (cached across opens, usually already warm)
  and the recently-viewed suggestion list. Both are `useQuery` behind React Query, so repeat opens are free.
- **`SearchablePicker` now has two callers with different needs.** The `trigger` render prop is the seam that
  keeps them from fighting; if a third caller wants something else from it, generalize then, not now.
- **The modal grows a second focus target.** `useReportSearch`'s `autoFocus` currently owns the modal's focus
  on open. With the Value Report row above it, decide deliberately: keep focus on the reports search (least
  disruptive to the existing keyboard flow) and let Tab reach the value row. Called out because it is easy to
  ship an accidental answer here.

## Out of scope

Editing a value node by any means; scoping suggestions with the picker's `currentJQL` parameter; multi-add
without closing the modal; filtering the field list by schema type; adding a value from the inline row at
all; and any change to how either node type renders.
