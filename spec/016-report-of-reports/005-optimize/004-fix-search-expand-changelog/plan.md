# 016 — Report of Reports: optimization 4 — stop sending expand=changelog

Fourth of five optimizations aimed at Jira 429s in production. Ranked against its siblings:
(1) [`../001-identical-request-dedupe/plan.md`](../001-identical-request-dedupe/plan.md),
(2) request queue + `Retry-After` backoff — deliberately not planned yet,
(3) [`../003-skip-child-approximate-count/plan.md`](../003-skip-child-approximate-count/plan.md),
**(4) this one**, (5) [`../005-partial-overlap-dedupe/plan.md`](../005-partial-overlap-dedupe/plan.md).
The factual baseline is [`../before.md`](../before.md); every line number below was re-verified against
current source, and several had drifted from before.md.

## Context

The user is hitting **HTTP 429 rate-limit errors in production**. The goal is fewer requests, and
cheaper requests.

`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts` is written to keep changelog data _out_ of the
search response — the comment at `src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:10-13`
says so, and claims it "allows up to 5000 issues per search page instead of ~100". **It does not
work.** Every search page this app has ever issued carries `expand=changelog`, and every byte of that
inline changelog is discarded.

The mechanism, in three lines:

| step                                                                | site                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `getRawIssues` always sends `expand: ['changelog']`                 | `src/stateful-data/jira-data-requests.js:127`                   |
| the fetch function keeps it in `apiParams` (only `limit` is peeled) | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:30`           |
| the intended override is a no-op                                    | `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:73`, `:80-85` |

```js
const searchExpand = USE_DIRECT_BULK_CHANGELOG ? [] : ['changelog']; // → []            (:73)

const response = await searchJiraIssuesWithJQL(config)({
  ...apiParams, // ← still holds expand: ['changelog']
  maxResults: pageSize,
  nextPageToken,
  ...(searchExpand.length > 0 && { expand: searchExpand }), // ← spreads `false`         (:84)
});
```

`searchExpand.length > 0` is `false`, and `{ ...false }` is `{}` — spreading a boolean adds no keys
and, crucially, **removes none**. Re-verified by executing the exact expression:
`node -e "const a=[];const o={expand:['changelog'],x:1};console.log(JSON.stringify({...o,...(a.length>0&&{expand:a})}))"`
→ `{"expand":["changelog"],"x":1}`.

`searchJiraIssuesWithJQL` then puts it on the wire — `if (params.expand) searchParams.set('expand', params.expand.join(','))`
(`src/jira-oidc-helpers/jira.ts:123`), appended to `/api/3/search/jql?…` (`jira.ts:126`).

Observed impact, in order of confidence:

- **Certain.** Every search page of every report carries inline changelog data that is thrown away:
  the bulk branch rebuilds each issue as `{ id, key, fields, changelog: changelogMap.get(id) ?? [] }`
  (`:129-134`), overwriting whatever search returned. The `loadChildren` path multiplies this by one
  call per 40 parents per level (`src/jira-oidc-helpers/makeDeepChildrenLoaderUsingNamedFields.ts:34`,
  `:41`) — and 40 is a real Jira limit the team verified, not a knob to turn.
- **[UNVERIFIED].** If `expand` makes Jira shrink the honoured page size, a 1000-item report is paying
  ~10 search round trips where it should pay 1. Phase 1 settles this, and the size of this fix's
  payoff depends entirely on the answer.

## What already exists

- **The bulk changelog path works and is the only path in use.** `USE_DIRECT_BULK_CHANGELOG = true`
  (`:14`) drives `POST /api/3/changelog/bulkfetch` in batches of 1000 (`:105-134`, `:107`).
- **The inline fallback exists but is dead.** `:135-138` calls `fetchRemainingChangelogsForIssues`
  (`jira.ts:422-504`), which splits issues on `isChangelogComplete` (`jira.ts:405-407`, used at
  `jira.ts:436`) and bulk-fetches only the incomplete ones. It reads `issue.changelog.histories` /
  `.total` (`src/jira-oidc-helpers/types.ts:14-19`) — data that **only arrives if `expand=changelog`
  is sent**. So the flag and the `expand` decision are one decision, made in two places.
- **One test file**, `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts` — a fake `requestHelper`
  routing on URL fragment (`:8-36`), already parsing the search query string with `URLSearchParams`
  (`:14-17`), and a single progress-accumulation test (`:39-73`). The harness needed for the
  regression test is already there; nothing asserts on `expand` today.
- **`expand` has exactly one producer in the whole app.** `grep -rn "expand" src/` returns, excluding
  UI code about expand/collapse and the vendored `src/can.js`: `jira.ts:116` and `:123` (the
  serializer), `fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:10/12/22/84`, and
  `jira-data-requests.js:127`. No other caller passes it — `FetchJiraIssuesParams`
  (`src/jira/shared/types.ts:90-97`) does not even declare it, so `searchAllJiraIssuesWithJQL`
  (`jira.ts:130-204`) and `fetchJiraIssuesWithJQL` (`jira.ts:206-216`) are unaffected either way.

## What doesn't exist

- **No measurement.** Nobody has looked at what `maxResults` Jira actually honours, with or without
  `expand`, on a real instance. before.md's appendix flags this as unknown (1) and (3), and the byte
  split between search and `changelog/bulkfetch` as unknown (2).
- **No way to reach the fallback from a test.** `USE_DIRECT_BULK_CHANGELOG` is a module-level `const`
  with no export and no env plumbing (grep: three hits, all in this file — `:14`, `:73`, `:105`). It
  has never been set to `false` anywhere in the repo's history of this file.
- **No 429 handling of any kind** — no queue, no retry, no `Retry-After`. Both request helpers are a
  bare `fetch` with no status inspection (`src/request-helpers/hosted-request-helper.js:12-14`, called
  at `:69`; `src/request-helpers/connect-request-helper.js:3-5`, called at `:22`). That is sibling
  (2)'s job, not this plan's.

## Decisions (locked with the user)

- **Reducing request count and per-request cost is the goal**; 429s in production are the symptom.
- **The 40-parent chunk stays** (`makeDeepChildrenLoaderUsingNamedFields.ts:34`) — an empirically
  verified Jira limit.
- **The fetch function owns the changelog strategy, so it owns `expand`.** It is the code that decides
  bulk-vs-inline; the caller should not be able to contradict it. `getRawIssues` stops sending
  `expand` as well — belt and braces, and because what it currently says is false.
- **The override must be structural, not conditional.** A conditional spread is exactly the shape that
  failed. `expand` gets destructured out of `params` so it cannot survive into the request, and the
  single branch that adds it back is the flag.
- **The fallback branch stays.** It is the only escape hatch if `changelog/bulkfetch` misbehaves on a
  customer instance, and deleting it would strand `fetchRemainingChangelogsForIssues`, which is
  exported on the public helper object (`src/jira-oidc-helpers/index.ts:103`).
- **Measurement is a phase, not a footnote.** Phase 1 runs before and after the fix.

---

## Phase 1 — Measure, before touching anything

Needs a real Jira instance and credentials. `npm run dev` (Vite + `server/server.js`, port 3000 —
`server/server.js:16`).

**Setup.** Open a single report — not a report of reports — whose `jql` URL param
(`src/canjs/routing/route-data/route-data.js:222`) matches **at least 1,000 work items**, with
`loadChildren` off (`route-data.js:226`) so the trace stays readable. DevTools → Network, filter
`search/jql`, preserve log off, reload.

**What to record, per report load:**

| reading                         | where                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------- |
| number of `search/jql` requests | request count in the filtered list                                               |
| requested page size             | `maxResults=5000` in the request URL (from `:78`, `MAX_RESULTS = 5000` at `:42`) |
| **honoured page size**          | `issues.length` in each response body — **not** the response's `maxResults`      |
| more pages coming?              | `nextPageToken` present / `isLast` false (read at `:90-91`)                      |
| payload size                    | the Size column, transferred **and** resource size (responses are gzipped)       |
| wall clock                      | the Time column, summed                                                          |

> Do not trust `SearchJiraResponse` (`src/shared/types.ts:29-36`): it still declares `maxResults`,
> `total` and `startAt`, which `/search/jql` is documented not to return
> (`spec/search-api-deprecation.md:136`). The code only ever reads `issues`, `nextPageToken` and
> `isLast`. Count the array.

**The A/B, with no code change.** Right-click the first `search/jql` request → Copy as fetch, paste
into the console, re-run it once as-is and once with `&expand=changelog` deleted from the URL. Same
auth header, same JQL, same `fields` — the only difference is `expand`. Compare `issues.length` and
the response size of the two.

**This settles all three unknowns:**

- **(a) does `expand` cap the page?** — the two `issues.length` values from the A/B.
- **(b) does `/search/jql` honour 5000 at all?** — the without-`expand` run against a query matching
  > 1000: if `issues.length` reaches the full match count in one page with `isLast: true`, yes at least
  > to that size. Note the app requests 11 core fields plus team/table fields
  > (`jira-data-requests.js:81-93`, `:112`), and the API is documented to shrink pages as fields grow
  > (`spec/search-api-deprecation.md:583`, `:589`), so a number well under 5000 is expected and fine.
- **(c) the search vs bulkfetch split** — clear the filter, re-run with filter `bulkfetch`, and record
  count / total size / total time for both endpoints. This is the first actual evidence for the
  "changelog dominates" assumption stated everywhere in this repo and measured nowhere.

**Decision rule:**

| result of (a)                                          | verdict                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| page size materially smaller with `expand` (e.g. ~100) | **Urgent.** The fix removes `pages − 1` requests per report _per child level_. Ship ahead of siblings 3/5. |
| same page count, response ≥2× larger with `expand`     | **Worth shipping now.** No request-count win; a real per-request cost and bandwidth win.                   |
| same page count, similar size                          | **Tidy-up.** Correctness only — ship it, but re-rank it below siblings (1)–(3).                            |

Record the numbers in this file under an "As measured" heading. Every later claim about payoff cites
them.

## Phase 2 — Fix the leak in the fetch function

`src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts`.

1. Peel `expand` off the incoming params alongside `limit` at `:30`, so `apiParams` structurally
   cannot carry it. A caller-supplied `expand` is deliberately ignored, not merged — this function's
   changelog strategy is not the caller's to override.
2. Replace the conditional spread at `:84` with an unconditional key derived from the flag: `expand`
   present iff `!USE_DIRECT_BULK_CHANGELOG`. `searchJiraIssuesWithJQL` guards with `if (params.expand)`
   (`jira.ts:123`), so an explicit `undefined` never reaches the wire — but prefer one expression that
   yields either `{ expand: ['changelog'] }` or `{}` so the two branches read as one decision.
3. Delete the now-redundant `searchExpand` local at `:73`, and update the comment block at `:10-13` to
   say what the code does, including that a caller's `expand` is ignored.
4. Leave `:22` (`expand?: string[]` in the params type) in place for now — Phase 3 decides its fate.

**Extract the request construction into a small exported pure function** in the same module —
`buildSearchRequest(apiParams, { pageSize, nextPageToken, useDirectBulkChangelog })` returning the
object passed to `searchJiraIssuesWithJQL`. Reason: it is the only way to test the flag-off branch at
all (see "What doesn't exist"), and the bug being fixed lives entirely in the construction of that
object. ~8 lines. The alternative — fix `:84` in place — is smaller but leaves the fallback branch as
untested in the new code as it is in the old.

**Tests** (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts`, harness at `:8-36` reused):

- `buildSearchRequest` with `useDirectBulkChangelog: true` **and** a caller-supplied
  `expand: ['changelog']` → result has no `expand` key. _This is the test that would have caught the
  original bug._
- Same with `useDirectBulkChangelog: false` → `expand: ['changelog']`, whatever the caller passed.
- Both preserve `jql`, `fields`, `maxResults`, `nextPageToken`, and drop `limit`.

## Phase 3 — Stop `getRawIssues` claiming a changelog it doesn't use

`src/stateful-data/jira-data-requests.js:122-130`: drop `expand: ['changelog']` (`:127`).

Safe, because authority now sits in the fetch function (Phase 2) — with the flag off, the inline
`expand` is added there, so the fallback keeps working without the caller's help. And because
`getRawIssues` only ever reaches that one function: `loadChildren` picks between
`fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields` and
`fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields` (`:118-120`), which are
`makeDeep(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config))` (`index.ts:132-134`, initially
`:109-111`) and the name-mapping wrapper `jira.ts:540-558` (which spreads `...params` at `:546` into
the same function at `:549`). Both funnel through the code Phase 2 fixed. The deep loader spreads
params into every child batch too (`makeDeepChildrenLoaderUsingNamedFields.ts:87-90`, `:41`), so today
`expand` propagates to every level; after this it propagates nothing.

**On the public contract.** `expand?: string[]` is a documented parameter of
`fetchAllJiraIssuesWithJQLAndFetchAllChangelog` (`:22`) and the helper is exposed on `jiraHelpers`
(`index.ts:106`). Verified: **no caller anywhere in `src/` passes it except `getRawIssues:127`** (the
grep in "What already exists"). Recommendation: keep the parameter in the type but document it as
ignored while the flag is on, rather than removing it — removing it is a breaking signature change for
an exported helper, and the type is not what caused the bug. Revisit if a second consumer never
appears.

**Tests:** none of the four test files that stub these helpers assert on request params
(`state-helpers.test.js:44/47`, `ChildReport.test.tsx:41-42`, `ChildReportConfig.test.js:251/281/301`),
and the only one that inspects the request reads `request.jql` (`ChildReportConfig.test.js:251-253`).
So this phase should be test-neutral; `npm test` green is the assertion.

## Phase 4 — Keep the fallback honest

No behaviour change while `USE_DIRECT_BULK_CHANGELOG` stays `true`; this phase is about the branch not
rotting.

- Verify the flag-off path end to end **by flipping the const locally** (do not commit): the search URL
  gains `expand=changelog`, `fetchRemainingChangelogsForIssues` receives issues carrying
  `changelog.histories`, and the report renders identical dates and statuses to the flag-on run. The
  rollback replay is the only consumer of changelog data, so a silent regression here shows up as wrong
  "N days ago" comparison values, not as an error.
- Add a comment at `:14` recording what the flag costs when off, so the next reader does not have to
  rediscover it: `/search/jql` returns at most **40 changelog entries per issue**
  (`spec/search-api-deprecation.md:142`, `:593`), and `isChangelogComplete` compares
  `histories.length === total` (`jira.ts:405-407`) — so on any instance with real history, nearly every
  issue is classified incomplete (`jira.ts:436`) and bulk-fetched anyway. The fallback pays for the
  inline payload and then mostly re-fetches. That is an argument for eventually deleting it, and the
  argument against deleting it today is the escape hatch above.
- **Do not delete the branch in this plan.** If it is ever removed, `fetchRemainingChangelogsForIssues`
  loses its last in-app caller and should be unexported from `index.ts:103` in the same change.

## Phase 5 — Re-measure and record

Repeat Phase 1 verbatim against the fixed build, on the same report and the same instance. Record, as
a table in this file:

| metric                                | before | after |
| ------------------------------------- | ------ | ----- |
| `search/jql` requests per report load |        |       |
| honoured page size (`issues.length`)  |        |       |
| search bytes (transferred)            |        |       |
| search wall clock                     |        |       |
| `bulkfetch` requests / bytes / time   |        |       |

Then repeat once with `loadChildren` on over a report with ≥200 parents, where the per-level multiplier
lives, and once on a report-of-reports document — the same saving, times N.

**On the rate-limit angle beyond page count.** Even if page size turns out not to be capped, a response
carrying discarded inline changelogs is a more expensive request to serve, and this repo's own research
states Jira Cloud's limits are "based on a combination of request count and computational cost"
(`spec/001-comments-causing-rate-limiting.md:40`). **[UNVERIFIED]** — that line cites no Atlassian
source, and no Atlassian rate-limit documentation is linked anywhere in this repo (only the
`/search/jql` deprecation notice, `spec/search-api-deprecation.md:65`). What would settle it: Atlassian's
published rate-limit docs, or observing `X-RateLimit-*` / `Retry-After` response headers in the Phase 1
network trace and comparing them across the with/without-`expand` A/B. Until then the honest claim is
narrow: **removing a payload the code discards cannot raise the cost of the request, and plausibly
lowers it.** The request-count win is the one worth quoting, and only if Phase 1 finds a cap.

---

## Tests and verification

- `npm run typecheck`, `npm test` — both must stay green; this change should not touch any existing
  assertion.
- **The regression test that matters** (Phase 2): with the flag at its production value and the caller
  passing `expand: ['changelog']`, the outgoing search request carries no `expand`. Assert it at the
  URL, through the real function, using the existing fake `requestHelper`
  (`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.test.ts:8-36`): capture every `urlFragment` matching
  `/api/3/search/jql`, parse with `URLSearchParams` as the harness already does at `:14-17`, and assert
  `params.get('expand') === null` while `params.get('jql')` and `params.get('fields')` are intact. Both
  layers are worth having — the pure-function test names the defect, the URL test proves nothing
  downstream re-adds it.
- Also assert the bulk path still runs: `/api/3/changelog/bulkfetch` is still called once per ≤1000
  issues (`:107`, `:117-127`) and the returned issues still carry a `changelog` array (`:129-134`).
- **Credentialed check** (no substitute for it): one report loads with identical rows, dates, statuses
  and comparison arrows before and after, since the changelog reaching `rollbackIssues` comes from the
  bulk endpoint in both cases. Then the Phase 5 table.

## Risks

- **The payoff may be zero requests.** If Jira already ignores `expand` for page sizing, this is a
  bytes-and-correctness fix. Phase 1 is deliberately first so that is known before anyone claims a
  429 improvement.
- **Ignoring a caller's `expand` is a silent contract change.** Today no caller passes one (verified);
  if one appears later expecting `expand=changelog` to be honoured, it will get bulk changelogs
  instead — the same data, a different shape (`InterimJiraIssue.changelog` is `History[]`,
  `types.ts:26-31`). The updated comment at `:10-13` is the mitigation.
- **The fallback stays untested end to end.** Phase 4 verifies it by hand, once. A permanent test would
  need the flag to be injectable, which is more surface than the dead branch is worth.
