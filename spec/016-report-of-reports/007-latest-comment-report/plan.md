# 016 — Report of Reports: 007-latest-comment-report

Show the newest comment on a work item in a document — its rich text, who wrote it, and when.

> **Phase 5 and § Editing can't un-make the node are superseded by
> [009-value-report-modal](../009-value-report-modal/plan.md).** The `Add Work Item Update` button is
> removed — a work item and a field are chosen in the Add Report modal — and **the node is no longer
> editable in place**, so the whole class of defect § Editing can't un-make the node fixes cannot occur.
> A wrong node is deleted and re-added. Everything else here — the node type, the grammar, the accessor,
> the fetch, and the ADF rendering — is unchanged, and this remains the record for it.

**This is a preset, not a new feature.** The node is an ordinary `inline-value` node whose expression is
`(issue = ABC-1).latestComment`. A button writes that string so nobody has to type it, and the edit
affordance for such a node is a plain key field. One node type, one grammar, one authoring path, one set
of error copy — a second fetch and a second row, which is all that genuinely differs.

## Context

A report-of-reports document composes saved reports, sections, and inline values. What it cannot do is
carry a sentence of human context: "here is the chart, and here is what the tech lead said about it on
Tuesday." Today that means retyping a comment into a section title, which goes stale the moment anyone
comments again.

003-self-reports already built the machinery for a live value in a document: `parseExpression` splits
`(jql).field`, `resolveField` maps the accessor to a Jira field, `useInlineExpression` runs the search,
`formatFieldValue` renders the result, and `InlineValue` puts it on a row. All of it shipped. The
question this plan answers is how much of it a comment reuses.

### Decisions locked with the user

- **One node type.** `Add Latest Comment` appends an `inline-value` node pre-filled with
  `(issue = ).latestComment`. **`model/sections.ts` changes not at all** — no new `StoredNode` variant,
  no `parseNode` case, no `toStoredSections` case, no `setIssueKeyAt`, no migration question to answer.
  The document schema is untouched, so a document with a comment node in it already round-trips through
  every client that can read an inline value.
- **`.latestComment` — a named pseudo-accessor, not `.comments[-1]`.** Indexing means new grammar in
  `expression.ts` and, once `[-1]` parses, an obligation to explain `[0]`, `[5]`, and `.labels[2]`. The
  button writes the string, so no user ever types it: generality nobody exercises isn't worth a
  sub-language. See § Why not indexing.
- **Share the node, the grammar, the authoring, and the render. Do _not_ share the fetch hook.**
  `useLatestComment` sits beside `useInlineExpression` rather than inside it. The two fetches differ in
  endpoint, response shape, and correctness constraint, and `useInlineExpression` is the file both
  features would then depend on. See § Where the line goes.
- **Rich text through the walker this repo already has.** `WorkBreakdown/helpers/adfToBlocks.ts` +
  `StatusSummaryBody`'s `renderBlock` already render Jira ADF as semantic HTML, in production, with unit
  tests. `@atlaskit/renderer` is **not** added. See § Rendering.
- **~~`Add Value` stays lit.~~ Parked again — see § Reversed after implementation.**
- **~~The row title treatment:~~** ~~a muted `Latest comment` label with the editable key beside it, and
  the comment body beneath the row at the same indent.~~ **Reversed — see § The row is the key.** What
  survives is the half that was right: the key is the only editable thing on the row.

## Reversed after implementation

Four decisions above were reversed by the user once the feature was on screen — three here, and the row's
layout in § The row is the key, which was big enough to need its own section. The code is as described
here, not as described above; the original wording is left in place so the reversal is legible.

- **`Add Value` is commented out**, for the third time. `AddContentRow` carries the block behind a
  comment naming this file. **`inlineValueNode` stays imported** — unlike 004's parking, the import is
  still needed, because `Add Latest Comment` creates the same node type. That is the clearest possible
  statement of what the preset design bought: parking the button costs one commented block and takes no
  feature dark.
- **`Add Latest Comment` is section-only.** It is absent from the document root's add row and present on
  every section and subsection, with no depth cap. A comment is a note _about_ something, so it belongs
  beside the report or section it comments on rather than floating at the top of the document. This also
  settles § Phase 5's open question — the root row is two buttons and a section's is three, so the
  `Add ▾` split button is not needed.
- **The blank inline value renders nothing.** The _"Write an expression — for example …"_ prompt is
  removed: a document shouldn't carry authoring instructions as content. The row keeps a min-height so
  it stays clickable, and with `Add Value` parked a blank node can only arrive from a saved or
  hand-edited document anyway. `adds a blank value with its field already focused` is deleted again —
  it covered only the button — and `prompts for an expression when the node is blank` becomes
  `renders a blank value as an empty but still editable row`.

The latest-comment node's own _"Enter a work item key — for example ABC-1."_ is **kept**: it sits in a
node whose key is genuinely required and which the user just created on purpose, which is a different
situation from a stray blank value in a saved document.

## The row is the key

The fourth reversal, and the one that changed the node's shape. Phase 4 shipped
`▾ Latest comment  ABC-1` over `Dana Ruiz · 2026-08-04, 14:22` over the comment. The user's verdict on
seeing it: the label spends the node's heading on saying what kind of node it is, and the byline puts
attribution ahead of the thing being attributed.

**What it is now:**

```
▾ ABC-1                                         (controls)
  Blocked on the SSO cert rotation. See JIRA-412.
  Updated by: Dana Ruiz
  Last updated: 2026-08-04, 14:22
```

- **The row is the work item key and nothing else**, as an `h3` at the `text-base font-semibold` every
  other row-owning node uses (`ReportOfReports.tsx:369`). The node reads as _the work item_, with its
  current word underneath.
- **The comment leads; provenance follows**, as one muted `text-xs` two-line footer. Who wrote it and when
  are attribution, not the point.
- **`grow` only while editing**, copied from `SectionTitle.tsx:40` and for its reason: the field wants the
  row's width, but a full-width resting hit area would swallow clicks on the rest of the row and turn
  "click the row" into "retarget the comment". This is what makes opening the field replace the heading in
  place with nothing below it moving — the question that prompted the redesign. `EditingResolved` in
  `LatestComment.stories.tsx` is the review surface for it.
- **`state` is gone from `LatestComment`'s props.** The row had taken a `LatestCommentState` and never read
  it; with the label gone there is provably nothing for it to read.
- **`created` → `updated`** in `LatestCommentState`, from `newest.updated ?? newest.created`. The footer
  says "Last updated", so it has to be the update time; Jira sets `updated` equal to `created` on an
  unedited comment, so the ordinary case is unaffected and an edited one stops lying.

**What this costs, recorded rather than argued away:** collapsed, the node is a bare `▸ ABC-1` and nothing
says it is a comment. Accepted because a collapsed report card is a bare `▸ Alpha` for exactly the same
reason, and the accessible names match that convention (`ABC-1, edit`, like `Alpha, edit`). **The option
not taken** was showing the issue summary beside the key — it is already fetched by Phase 2's step 1 and
never read, so it costs one field on the state and a name-keyed lookup. Worth revisiting if the collapsed
row proves too thin in real use.

**`Add Latest Comment` → `Add Issue Update` → `Add Work Item Update`.** Named for what the reader gets —
the current word on a work item — rather than for the Jira object it comes from. It went through
`Add Issue Update` for one round; that said _issue_ while the node's own states said _work item_
(_"No work item matched."_, _"Enter a work item key"_), and _work item_ is the app's term for Jira's renamed
issue everywhere else. Settling on `Add Work Item Update` removes the split rather than recording it.

**The word "comment" is now absent from everything the reader sees**, including the empty state
(_"No updates found."_, not _"No comments yet."_). It survives only where it is accurate and internal: the
`latestComment` accessor, `useLatestComment`, `fetchLatestComment`, the `/comment` endpoint, and this plan.
The two states shared with Add Value keep their copy verbatim, because copy that is deliberately identical
across both presets shouldn't diverge for one of them.

## Editing can't un-make the node

**Superseded by [009-value-report-modal](../009-value-report-modal/plan.md) § The node stops being
editable.** The node has no edit field any more, so nothing can be typed into it and neither fix below is
reachable. `looksLikeKey` is deleted, `issueKeyOf` survives only to title the row, and the two integration
tests that pin these fixes are deleted rather than rewritten. Kept as the record of a defect the current
design makes impossible.

A bug found in use, and the sharpest possible demonstration of what the preset design costs. Reported as:
typing `ASDF` into a new comment node produced the heading `(issue = ASDF).latestComment` and the error
_"No work item matched. (issue = ASDF).latestComment"_ — and then typing a real key into that field gave
_"An expression starts with "(" — for example (issue = ABC-1).summary"_. The only way out was to hand-type
`(issue = SUNNYSUSHI-54).latestComment`.

**One root cause with two exits.** A node is a comment node iff its expression parses and its accessor is
`latestComment`. The row edits a key iff `issueKeyOf` recognizes the JQL. Both were reachable from a typo:

1. `issueKeyOf` required the value to look like a key (`[A-Za-z][A-Za-z0-9_]*-\d+`). `ASDF` failed, so the
   node fell back to expression mode — the correct fallback for `project = A AND …`, and exactly wrong for
   a typo. **Fixed** by matching any bare term: the question is "can a key field represent this JQL?", not
   "is this a valid key". Jira answers the second, as _"No work item matched."_, beside a field that still
   edits a key. `rejects a key that is not shaped like one` is inverted into
   `keeps a mistyped key in the key field rather than giving up on it`.
2. Once in expression mode, confirming a bare key wrote it as the whole expression, which doesn't parse —
   so the node dispatched to `InlineValueView` and **stopped being a comment node**. **Fixed** with
   `looksLikeKey`: a bare term (or empty) typed into either field is wrapped in
   `latestCommentExpression`, so nothing typed into a comment node can un-make it.

Fix 1 alone closes the reported path; fix 2 closes the same defect reached from a genuinely
expression-mode node, where a user could equally type a key. Each has an integration test that fails with
only the other applied — verified by reverting each in turn.

**What is deliberately still possible:** typing a real query (`project = ABC`) into an ordinary inline
value's field, or any non-key text into a comment node's expression field, still routes by the expression
alone. That is the preset design working as intended — one node type, and the expression decides — and it
is why `switches an ordinary value to a comment when the accessor is typed in` is a test rather than a bug.
The line is that a node can be _changed_ by writing an expression, but never _broken_ by writing a key.

## Why not indexing

`(issue = ABC-1).comments[-1]` was the alternative shape considered. Three problems, in increasing order
of seriousness:

1. **It needs grammar.** `expression.ts` scans to the balanced paren and then takes one dot-free
   accessor; brackets, integers, and negative indices are all new. `.latestComment` needs **zero**
   parser changes — `parseExpression` accepts it today, because the only thing it rejects in an accessor
   is a second dot (`expression.ts:105`).
2. **It promises a language.** Once `[-1]` works, `[0]` and `.labels[1]` are reasonable things to try,
   and every one of them is a support question or a silent wrong answer.
3. **Nobody reads it.** The string exists only in storage and in the edit field of a node whose edit
   affordance is a key input. Expressiveness spent where there is no author.

`.latestComment` costs one entry in a lookup table.

## Where the line goes

The temptation is to put the comment fetch inside `useInlineExpression` — a mode flag, a chained query.
Rejected. That file is nine lines of linear parse → resolve → search, and it is the one thing Add Value
depends on; giving it a second fetch mode means a bug in the comment path is a bug in Add Value. The
fetches are the part that genuinely differs, so they stay apart.

What actually duplicates, and therefore what gets shared:

| Layer                                                              | Shared?                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| node type, `params.expression`, `setExpressionAt`, parse/serialize | **shared** — `sections.ts` untouched                        |
| `parseExpression`                                                  | **shared, unchanged**                                       |
| authoring (append node + `beginEditing`)                           | **shared** — one more `AddButton` calling `inlineValueNode` |
| accessor → what to fetch                                           | new: one small table (`model/accessors.ts`)                 |
| fetch hook                                                         | **separate**: `useLatestComment`                            |
| view dispatch                                                      | inside `InlineValueView` (`ReportOfReports.tsx:372`)        |
| ADF → HTML                                                         | **shared**, promoted out of WorkBreakdown                   |

Compared with a dedicated `latest-comment` node type, this deletes: a `StoredNode` variant, a
`parseNode` case, a `toStoredSections` case, a node factory, `setIssueKeyAt`, a second inline-edit
shell, and the re-parking of Add Value.

**The cost, stated plainly:** `latestComment` is not a field in `/api/3/field`. The accessor is no longer
purely "a Jira field", which is the one thing a separate node type would have avoided. Accepted — it buys
a single node type and a single authoring path, and the pseudo-accessor is discoverable rather than
hidden (see the signpost in Phase 4).

## Rendering

`WorkBreakdown/helpers/adfToBlocks.ts` converts ADF to a renderer-agnostic `AdfBlock[]` — paragraphs,
headings, blockquotes, code blocks, ordered and bullet lists with nesting — and
`StatusSummaryBody.tsx:20` maps those to real `<ol>`/`<ul>/<blockquote>/<pre>` inside a Tailwind `prose`
container. Both are unit-tested (`adfToBlocks.test.ts`, `StatusSummaryBody.test.tsx`). This is Jira rich
text rendering that ships in this app today, for the Status Summary field.

~~So `@atlaskit/renderer` is not added.~~ **It is. See § Rich rendering — this section's conclusion did
not survive two rounds of contact with real comments, and the reasoning below is kept only to show what
was wrong with it.**

The argument was: three new packages (~15 MB unpacked), a lazy chunk, its own `IntlProvider`, and a
prosemirror dependency unproven under jsdom, versus extending a walker already shipping in the app. The
walker looked like the smaller, reversible move.

**Two things falsified it.** First, marks: the walker flattened each block to one string, so bold,
italic, underline, links, and hard breaks were all dropped, and fixing that meant changing the block
payload from `text: string` to a list of inline runs (§ Marks and breaks). Second, tables — and panels,
code blocks, emoji, mentions, status lozenges, dates, and smart links, all of which were then wanted too.
At that point "extend a walker" is reimplementing the renderer one node type at a time, each with its own
design questions, which is not the smaller move at all.

**Where the estimate was wrong:** ~15 MB was npm's `unpackedSize`, which counts a tarball's own files.
Installed with their dependency trees the three packages are **127 MB and 1515 packages**, taking
`node_modules/@atlaskit` from 1.0 GB to 2.7 GB. Two orders of magnitude out. The lesson is to measure the
installed tree, not the registry metadata.

The walker is not deleted — it is the `Suspense` fallback and WorkBreakdown's renderer. See § Rich
rendering for what each does now.

## Marks and breaks

Added after the first credentialed look, which found a comment with bold, underline, and newlines
rendering as flat text.

**The cause was the block payload, not the renderer.** `AdfBlock` carried `text: string`, produced by a
`leafText` walk that concatenated every descendant text run — so marks had nowhere to live, and a
`hardBreak` (Shift+Enter in Jira) carries no text at all and so vanished without trace. No amount of work
in `AdfBlocks.tsx` could recover information the walker had already discarded.

So block content became a list of inline runs:

```ts
export type AdfInline = ({ type: 'text'; text: string } & AdfMarks) | { type: 'break' };
```

- `paragraph`, `heading`, and `blockquote` carry `content: AdfInline[]` in place of `text: string`.
  `codeBlock` keeps `text: string` — marks don't apply inside one, by definition.
- Marks read: `strong`, `em`, `underline`, `strike`, `code`, `link`. Unknown marks (`textColor`,
  `subsup`) are ignored and their text still renders.
- **Link hrefs are scheme-checked in the walker,** not the renderer: `http`, `https`, `mailto`, and
  relative URLs pass; anything else (`javascript:`, `data:`) loses the href and keeps its text. The href
  comes from Jira content and lands in an `<a href>`, so this is the one place in this feature where a
  render decision is a security decision.
- A blockquote holding several paragraphs now gets a `break` between them rather than running them
  together.
- Anchors render `target="_blank" rel="noopener noreferrer"`.

**This changed WorkBreakdown's Status Summary too, for the better** — it renders through the same walker,
so it gained marks and hard breaks for free. Its three fixture-bearing tests were updated to the new
block shape; the behaviour they assert is unchanged.

New coverage: `AdfBlocks.test.tsx` (18 tests — new file; the renderer had only indirect coverage through
`StatusSummaryBody` before), marks and hard-break cases in `adfToBlocks.test.ts`, and one end-to-end
assertion in `LatestComment.test.tsx` that a comment's bold, underline, and breaks survive.

## Rich rendering

`@atlaskit/renderer` **is** added, reversing § Rendering. The trigger was tables plus every other node
type the walker drops; the argument that settled it was that ~15 MB against 1.0 GB of `@atlaskit` already
installed is not a real objection, and that hand-writing tables/panels/emoji/mentions/status/dates/smart
links is reimplementing the renderer rather than extending a walker.

### The seam

`src/react/components/AdfDocument/` — two renderers behind one component:

- **`RichAdf.tsx`** is the only module that imports `@atlaskit/renderer`, loaded through `React.lazy`.
  That single import boundary is what keeps the editor stack out of `index`.
- **`AdfBlocks`** (the local walker) is the `Suspense` fallback. The chunk is large and a comment is
  usually a sentence, so the walker's version shows instantly and the real renderer replaces it — better
  than a spinner, and for plain prose a reader may never see a difference. It also keeps the walker as
  live production code rather than something kept warm by tests.
- `LatestCommentBody` hands the ADF over **whole**, not through the walker first. The earlier
  `blocks.length ? … : "no text to show"` guard had to go: a table-only or emoji-only comment produces no
  walker blocks but is not empty, so that guard would have hidden exactly what the renderer was added
  for. The remaining guard is `isEmptyDocument` — a document with no `content` at all.

`appearance="comment"` (the renderer's compact treatment) and its own `<IntlProvider locale="en">`, which
is load-bearing: this app has none higher in the tree (`JqlEditor.tsx:24` records the same) and the
renderer throws without one.

### jsdom: it mounts

The plan's largest unknown, resolved. It needed **two inert observer stubs** in `vitest.setup.ts` —
`IntersectionObserver` (reached via `@atlaskit/width-detector` during layout effects; without it every
render throws) and `ResizeObserver`. They never fire a callback, deliberately, so no test can come to
depend on a measurement jsdom has no layout to produce.

Verified under jsdom: `<table><tbody><tr><th><td>`, marks, blockquote, lists, `hr`. **Not** rendering
under jsdom: panels, code blocks, emoji, mentions, status, dates, smart links — accompanied by a
`Client must be initialized before using this method` error from `@atlaskit/feature-gate-js-client`. All
of those nodes _are_ in the default schema (checked directly via `getSchemaBasedOnStage`), so this looks
like a feature-gate/provider artifact of the test environment rather than real behaviour. **That is why
Storybook is the design-review surface** — `AdfDocument.stories.tsx` covers tables, wide tables, marks,
panels, inline atoms, structure, and the media-does-not-load case, and it is the only place the browser
answer can be seen.

`AdfDocument.test.tsx` exercises the real renderer (tables, marks, rule + list) with generous timeouts,
because the dynamic import takes seconds. Everything downstream sees the synchronous fallback, which is
what keeps the `ReportOfReports` suite fast. The fallback is deliberately not asserted there:
`React.lazy` caches on first load, so only a file's first test could observe one, and a test that passes
because of its position is worse than none.

### What it cost

|                          | Before  | After                                                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| `node_modules/@atlaskit` | 1.0 GB  | **2.7 GB** (1515 packages added)                                                                        |
| `index` chunk            | 15.7 MB | **8.8 MB** — _smaller_; the new dynamic-import boundaries let vite hoist shared modules out             |
| Lazy `RichAdf` chunk     | —       | **23.2 MB raw / 5.3 MB gzipped**, fetched only when a comment renders                                   |
| Other new lazy chunks    | —       | `inlineCard` 9.5 MB, `MediaCard` 8.5 MB, `mention` 6.9 MB, …                                            |
| Total build JS           | —       | 171 MB across 1130 chunks                                                                               |
| Build heap               | default | **`--max-old-space-size=8192`** — `vite build`, `build:dev`, and `storybook build` all OOM'd without it |

The 5.3 MB gzipped first-render cost is the real price, and the walker fallback is what makes it
tolerable rather than a blank box. Worth revisiting if comment nodes turn out to be common.

### Still not rendered, by anything

Inline images and attachments (needs a `mediaProvider` and a media token this app cannot obtain) and
mention avatars (needs a `mentionProvider`). Mention _names_ do render, through the real renderer.

---

## Phases

### Phase 0 — verify the fetch (this decides Phase 2)

Two questions against a real instance, before any code:

1. **Does `fields: ['comment']` on the search return the _newest_ comment?** Jira returns comments
   oldest-first and the embedded page on a search/issue response is capped, so `comments.at(-1)` may be
   the newest of the _oldest_ N — silently wrong, and wrong exactly on the busy work items most likely to
   be worth a comment node. Check against a work item with more than ~20 comments: create a value node
   reading `(issue = KEY).comment` (which resolves today — see the signpost note in Phase 4) and inspect
   the response in devtools for a `total` greater than `comments.length`.
2. **Does `/api/3/issue/{key}/comment` honour `orderBy=-created`?**

**If (1) says the search is reliable,** Phase 2 collapses to nothing: no new helper, no new hook, no
query key, no second request. `useInlineExpression` returns the comments-page as its `value` and the
whole feature is an accessor entry plus a view. Take that outcome if it's available — it is strictly
better than what follows.

**If (1) says the search is capped or misordered** (the expected answer), build Phase 2 as written.

### Phase 1 — the derived accessor

`model/accessors.ts`, new and pure:

```ts
export type DerivedAccessor = { kind: 'latest-comment'; label: string };

/** Accessors that aren't Jira fields. See § Where the line goes. */
export const derivedAccessor = (accessor: string): DerivedAccessor | undefined => …
```

Matched case-insensitively, so `.latestcomment` works like `resolveField`'s name matching does.

`expression.ts` and `resolveField.ts` are **unchanged**. Keeping the pseudo-accessor out of
`resolveField` is deliberate: that function's contract stays "accessor → a real Jira field", which is
what makes its ambiguity handling (`resolveField.ts:49`) meaningful.

`model/sections.ts`, `model/documentParam.ts` — unchanged.

`model/childQueryGroups.ts` — **one docblock sentence, no logic.** Line 52 currently reads
"`InlineValueNode` and `UnknownNode` are skipped — neither issues an issue request." An inline-value node
holding a comment accessor _does_ fetch. The skip is still correct — `collectChildQueries` groups embedded
_report_ queries, and this isn't one — but the stated reason needs to be the real one.

### Phase 2 — the fetch

- `fetchLatestComment` in `src/jira-oidc-helpers/jira.ts`, beside `fetchJiraIssue` (`:46`) and shaped like
  `fetchJiraChangelog` (`:294`), which is the same issue-subresource pattern:
  `/api/3/issue/{key}/comment?orderBy=-created&maxResults=1`.
- Exposed through the jira service the way `fetchJiraIssue` is (`jira-oidc-helpers/index.ts:25`, `:93`).
- `jiraKeys.latestComment(issueKey)` in `src/react/services/jira/key-factory.ts`, following
  `jiraKeys.inlineExpression` (`:22`). Keyed by the resolved key, so two nodes pointing at one work item
  share a request.
- `hooks/useLatestComment.ts` — takes the **JQL** (not a key), and runs two queries:

  ```ts
  type LatestCommentState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'empty' }
    | { status: 'ok'; body: unknown; author: string; created: string };
  ```

  **Step 1** is the search `useInlineExpression` already makes — `maxResults: 2` for cardinality, and the
  issue `key` off the response (`fetchJiraIssuesWithJQLWithNamedFields` spreads `...issue`, so `key`
  survives `mapIdsToNames`). Request `fields: ['summary']`: the cheapest always-present field, asked for
  because the endpoint wants _a_ projection, not because the value is used.

  **Step 2** is `fetchLatestComment(key)`, `enabled` on step 1 resolving to exactly one row.

  Error copy is reused verbatim from `useInlineExpression` — `'No work item matched.'` and
  `'More than one work item matched — narrow the query.'` — so the two presets fail identically. That
  consistency is a large part of what sharing the node buys.

  `useQuery`, deliberately not `useSuspenseQuery`, for the reason `useInlineExpression:29` records: a bad
  key must fail in place with a message beside it, not suspend and blank the document.

  `body` is the comment's ADF passed through untouched; the walker runs in the view, so the hook stays
  about fetching. `author` is `author.displayName`; `created` is Jira's ISO string, formatted at render so
  the pure component stays the only place that knows about locales.

  **The blank-key state is not in this union,** deliberately — a disabled `useQuery` reports `isPending`,
  which would make "nothing typed yet" indistinguishable from "loading". The view checks the expression
  first, exactly as `InlineValue.tsx:58` checks `!expression.trim()`.

**Two requests, not one.** That is the honest cost of routing through the shared grammar: the JQL half has
to be resolved to a key before the comment endpoint can be asked. In exchange, cardinality and
permission-visibility semantics come out identical to Add Value's, and `(assignee = currentUser() AND
…).latestComment` works without further design. Short-circuiting a bare `issue = X` to skip step 1 is a
follow-up, not v1 — it means parsing JQL, which nothing in this app does.

### Phase 3 — the shared ADF renderer

Promote what WorkBreakdown already has, following the `src/react/components/<Name>/` convention:

- **New** `src/react/components/AdfBlocks/` — `adfToBlocks.ts` (moved with its test), `AdfBlocks.tsx`
  (`renderBlock`/`renderListItems` lifted out of `StatusSummaryBody`, as
  `<AdfBlocks blocks={…} className={…} />`), `index.ts`.
- `StatusSummaryBody.tsx` keeps its `Card` prop, its `prose` classes, and its `fontSize` — it just renders
  `<AdfBlocks>` instead of its own local copy of the mapper.
- Five import sites to update: `WorkBreakdown/types.ts:10`, `helpers/buildBoard.ts:8`,
  `helpers/index.ts:15-16`, `StatusSummaryBody.tsx:3`. `helpers/index.ts` re-exports from the new home so
  nothing outside WorkBreakdown notices.

A pure move — `adfToBlocks.test.ts`, `StatusSummaryBody.test.tsx` and
`buildBoard.statusSummary.test.ts` are what prove it. Do this phase in its own commit, green before
anything new lands on top of it.

### Phase 4 — the view

`components/LatestComment.tsx` — pure and prop-driven, taking `AdfBlock[]` rather than raw ADF so it
stories with hand-written blocks and no Jira. The split `InlineValue` established.

Structurally a report rather than a value: a row, then content beneath it at the same indent.

```
▾ Latest comment · ABC-1                        (controls)
  Dana Ruiz · 2026-08-04, 14:22
  Blocked on the SSO cert rotation. See JIRA-412.
```

**Superseded — see § The row is the key** for the layout that shipped. The label is gone, the row is the
key alone, and the author and timestamp moved below the comment as a footer.

- Content beneath the row means a `CollapseToggle`, per 004-redesign's rule — "a caret if there's content
  beneath the row".
- Collapsed content stays mounted and hides via `hidden` + `.collapsed-content`
  (`ReportOfReports.tsx:286`), restored for print (`src/css/print.css`), for the same reason a chart does.
- `print-avoid-break`, and deliberately **not** `print-hidden`: this is content, not chrome.
- Timestamp via a module-level `Intl.DateTimeFormat('en-CA', …)` yielding `2026-08-04, 14:22`.
  Per-component formatters are the house pattern (`UpdateModal.tsx:27`, `IssueSimulationRow.tsx:24`), and
  `en-CA` keeps the date half at the `YYYY-MM-DD` convention `formatFieldValue` documents.

States, all muted and in place — the document keeps rendering around a broken one, following
`MissingReportNote`:

| State                    | Renders                                            |
| ------------------------ | -------------------------------------------------- |
| blank key                | _"Enter a work item key — for example ABC-1."_     |
| loading                  | _"Loading…"_                                       |
| no match / more than one | `useInlineExpression`'s copy, verbatim             |
| no comments              | _"No updates found."_                              |
| ok                       | the body, then _"Updated by:"_ / _"Last updated:"_ |

"Work item", not "issue" — the app's user-facing term, per `useInlineExpression`'s _"No work item
matched."_ And "update", not "comment": the empty state is _"No updates found."_, matching the
`Add Work Item Update` button the reader clicked to get here. See § The row is the key.

**The dispatch** goes in `InlineValueView` (`ReportOfReports.tsx:372`), which is already the thin wrapper
that reads the hook: parse the expression, and if `derivedAccessor(parsed.field)` matches, render
`LatestCommentView` instead of `InlineValue`. Both share the node, `setExpressionAt`, `NodeRow`,
`NodeControls`, and `useNodeRow`. `LayoutNodeView`'s branch table (`:132`) is unchanged — there is no new
node type for it to know about.

**The signpost.** `.comment` resolves today (Jira's field is id `comment`, name "Comment") and dead-ends:
`formatFieldValue` gets a comments-page, finds no `displayName`/`name`/`value`, returns `null`, and the
document reads _"Comment holds a comments-page this can't show as text yet."_ Key `InlineValue`'s
`Problem` branch (`:73`) on the resolved field id being `comment` and point at `.latestComment` instead. A
dead end becomes a discovery path for the pseudo-accessor — which is the mitigation for the one cost this
design carries.

### Phase 5 — authoring

**Superseded by [009-value-report-modal](../009-value-report-modal/plan.md).** The button below shipped and
was then moved into the Add Report modal on UX feedback, which also un-parked `Add Value` by giving it a
field picker. The text is kept as the record of what was built; the code no longer matches it.

`components/AddContentRow.tsx` — a fourth `AddButton`, `Add Work Item Update`, appending
`inlineValueNode('(issue = ).latestComment')` then `beginEditing(node.id)`. The same two calls
`Add Section` and `Add Value` already make; the only difference is the seed string. Accessible name
`Add Work Item Update` / `Add Work Item Update to <container>`, matching its siblings. No depth cap — a value
holds nothing, so it can't deepen the tree. Order: `Add Report`, `Add Section`, `Add Work Item Update`.

**Section-only, and `Add Value` commented out** — see § Reversed after implementation. The root row is
`Add Report`, `Add Section`; a section's is those two plus `Add Work Item Update`.

**On the wording.** ~~`Add Latest Comment`, not `Add Update` (which implies a status transition or field
change might appear instead)~~ **The button is `Add Work Item Update` — see § The row is the key.** The
objection above was to `Add Update` bare; `Add Work Item Update` reads as "the latest word on this work
item", which is what the node is, and `Update` is not carrying the ambiguity alone. The other half stands:
**not `Add Comment`**, which reads as _posting_ a comment to Jira — the one thing this must never look
like.

**~~Four buttons per level is the open question in this plan.~~** Settled by § Reversed after
implementation: `Add Value` is commented out and `Add Latest Comment` is section-only, so the root row is
two buttons and a section's is three. No `Add ▾` split button is needed.

---

## Files

**New**

- `src/react/reports/ReportOfReports/model/accessors.ts` + `.test.ts`
- `src/react/reports/ReportOfReports/hooks/useLatestComment.ts` + `.test.tsx`
- `src/react/reports/ReportOfReports/components/LatestComment.tsx` + `.stories.tsx`
- `src/react/components/AdfBlocks/` — `AdfBlocks.tsx`, `adfToBlocks.ts` (moved), `adfToBlocks.test.ts`
  (moved), `index.ts`

**Modified**

- `ReportOfReports.tsx` — the dispatch in `InlineValueView`, plus `LatestCommentView`
- `components/AddContentRow.tsx` — one more button
- `components/InlineValue.tsx` — the `.comment` signpost only
- `model/childQueryGroups.ts` — one docblock sentence, no logic
- `src/jira-oidc-helpers/jira.ts` + `index.ts` — `fetchLatestComment`
- `src/react/services/jira/key-factory.ts` — one query key
- `WorkBreakdown`: `StatusSummaryBody.tsx`, `types.ts`, `helpers/buildBoard.ts`, `helpers/index.ts` —
  imports and the lifted mapper
- `ReportOfReports.test.tsx`

**Deliberately unchanged:** `model/sections.ts`, `model/expression.ts`, `model/resolveField.ts`,
`model/formatFieldValue.ts`, `hooks/useInlineExpression.ts`, `model/documentParam.ts`, `ChildReport.tsx`,
`AddReportModal.tsx`, and `package.json` — **no new dependencies.** The document schema and the whole
inline-value fetch path are untouched, which is what keeps this from being a second feature.

## Test impact

- **`sections.test.ts`** — nothing. No new node type.
- **`accessors.test.ts`** — `latestComment` matches, case-insensitively; an unknown accessor and a real
  field name don't.
- **`useLatestComment.test.tsx`** — an injected fake jira client, copying
  `useInlineExpression.test.tsx:25`, which already records requests for assertion. Covers: the search's
  key reaching step 2; `orderBy=-created&maxResults=1` reaching the request; zero matches; more than one
  match; a work item with no comments; a 404.
- **`LatestComment.stories.tsx`** plus pure-component assertions for all five states, no Jira.
- **`AdfBlocks`** — the moved `adfToBlocks.test.ts` runs unchanged; `StatusSummaryBody.test.tsx` and
  `buildBoard.statusSummary.test.ts` are the regression net for the move.
- **`ReportOfReports.test.tsx`** — add via the button and confirm the seeded expression; resolves and
  renders author, time, and body; collapses its body while leaving its row; offers a caret; moves and
  deletes like any other node. New tests hover the enclosing `[data-node-row]` first, per the note the
  file already carries.
- **Two existing tests change**, both consequences of § Reversed after implementation:
  `adds a blank value with its field already focused` is deleted (it covered only the parked button) and
  `prompts for an expression when the node is blank` becomes
  `renders a blank value as an empty but still editable row`. Every `storedValue`-seeded inline-value
  test is untouched — seeding is what keeps the parked feature covered.
- **Add-row coverage:** the button is absent at the root, present on a section and on a subsection.

## Verification

- `npm run typecheck`, `npm test`, `npm run build`, `npm run build-storybook`.
- Phase 0's two questions answered against a real instance **before** Phase 2 is written.
- Phase 3 green on its own, before anything new depends on it.
- Storybook covers all five states and both collapse states with no Jira.
- In the app (needs credentials, `npm start`): add a comment node from the button; confirm a real comment
  renders with its author and time; a comment with lists and headings keeps them; point it at a
  nonexistent key; at a work item with no comments; at a JQL matching several; put one inside a section
  three levels deep and confirm it moves and deletes. Confirm `.comment` now points at `.latestComment`.
- Look at the four-button row and decide about `Add ▾`.
- **Print check:** collapse the node, then Download PDF — the body must still appear, and no add row or
  controls anywhere on the page.
- Confirm a document saved before this change opens unchanged, and that one containing a comment node
  round-trips through the `sections` URL param — it should, trivially, since it is an inline-value node.
- No bundle measurement needed: no dependency is added.

## Risks / caveats

- **~~Marks, tables, panels, media, and mentions are dropped.~~** Resolved by adopting
  `@atlaskit/renderer` — see § Rich rendering. **Only media and mention avatars still don't render**, and
  neither can without auth infrastructure this app has no way to get.
- **5.3 MB gzipped on the first comment render.** The lazy `RichAdf` chunk. Contained by not being in
  `index` and softened by the walker fallback, but it is a real wait on a slow connection, and a document
  with a comment node pays it once per session. Revisit if these turn out to be common.
- **The build needs a raised Node heap.** `vite build`, `build:dev`, and `storybook build` all abort with
  _"Ineffective mark-compacts near heap limit"_ at Node's default (4288 MB on a 32 GB machine; a
  16 GB `ubuntu-latest` runner sizes similarly, so CI would fail the same way). 6144 MB was verified
  sufficient; **`node-options=--max-old-space-size=8192` in `.npmrc`** for headroom.
  Deliberately _not_ a `NODE_OPTIONS` prefix on each build script: npm applies `node-options` to every
  script with no shell-specific syntax, so it works on Windows too, it's one line instead of three, and
  it also covers `storybook dev`, which hits the same ceiling. The cost is that it's less discoverable
  than a script prefix, hence the comment in `.npmrc` pointing back here.
- **1515 packages added, and version skew.** The repo's `@atlaskit` deps sit on older majors (`icon ^22`,
  `button ^20`, `primitives ^12`, `tokens ^2`) while `renderer@134`/`editor-common@117` want much newer
  ones, so npm now keeps several majors of the core packages side by side. That was already true via
  `jql-editor@7`; this deepens it. It's the usual source of "two copies of `@atlaskit/tokens`, theming
  looks slightly off" bugs, so it's the first place to look if something renders wrong.
- **jsdom does not render panels, code blocks, or inline atoms** (a `feature-gate-js-client` artifact —
  see § Rich rendering). So the automated tests cannot prove those work; only Storybook can. If they turn
  out to be broken in a real browser too, that is not something the suite will tell us.
- **Two requests per comment node.** The shared-grammar cost. Identical JQLs dedupe through React Query
  and identical keys dedupe on step 2, but a document with ten distinct comment nodes makes twenty
  requests. Acceptable at the scale a hand-built document reaches; the bare-`issue = X` short-circuit is
  the fix if not.
- **`latestComment` is a pseudo-field.** A user who goes looking for it in Jira won't find it. Mitigated
  by the `.comment` signpost, not eliminated.
- **`Add Value` and `Add Latest Comment` can produce the same node.** Typing `.latestComment` into a
  value created by the first button switches its rendering. That's a feature of one node type, but it
  means the view must handle the expression changing under it — covered by the dispatch living in
  `InlineValueView` rather than in `LayoutNodeView`.
- **Restricted comments.** The endpoint returns the newest comment _visible to the authenticated user_,
  which may not be the newest comment. Not detectable from the response, so not reportable in the UI.
  Same class of problem as 003's "the document renders differently per viewer".
- **A comment is unbounded content.** A long one will dominate the document. No clamp here — collapse is
  the escape hatch — but a max height with a "show more" is the obvious follow-up.
- **Add Value goes dark for the third time,** with its model, hook, formatter, resolver, and view
  reachable only from hand-edited or previously-saved documents and kept honest by their own unit tests.
  The pattern is now worth naming: this button has been built, parked, un-parked, and re-parked without
  the code beneath it ever being removed. What's different this round is that a live button — `Add Latest
Comment` — creates the same node type, so the parked path is exercised in production rather than only
  by tests.

## Out of scope

A feed of comments across many work items; comment authoring or replies; the full comment thread;
changelog or status-transition history; `@atlaskit/renderer` and providers of any kind; mention avatars
and inline media; indexing or multi-hop accessors of any form; the `Add ▾` split button; and the
bare-key fetch short-circuit.
