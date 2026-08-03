# 016 — Report of Reports: optimization

Driven by a live problem: **Jira is returning 429 rate-limit errors in production.** The goal of
everything in this directory is to cut the number of HTTP requests a document issues. CPU and
allocation savings are secondary and are treated as such.

Start with [`before.md`](before.md) — a description of how data is fetched and processed today, with
`file:line` citations, written before any proposal. Every plan below builds on it. Two of its claims
have since been corrected by the plans that checked them; see [Corrections](#corrections-to-beforemd).

## The plans, in priority order

| #   | plan                                                                     | what it does                                                                                                                                                     | status                                            |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | [request dedupe](001-request-dedupe/plan.md)                             | A document-level field union that makes reports over one JQL send identical requests, then singleflight + short TTL at `getRawIssues` so those produce one fetch | planned                                           |
| 2   | —                                                                        | Request queue + `Retry-After` backoff in the two request helpers                                                                                                 | **not planned yet**                               |
| 3   | [skip child approximate-count](003-skip-child-approximate-count/plan.md) | Stop paying a count request per 40-parent child batch — 43% of the deep-children walk                                                                            | planned                                           |
| 4   | [fix `expand=changelog`](004-fix-search-expand-changelog/plan.md)        | The suppression at the search call site is a no-op, so every page carries changelog data that is then discarded                                                  | planned; payoff needs measurement                 |
| 5   | [partial-overlap sharing](005-partial-overlap-dedupe/plan.md)            | Sharing work between reports whose _different_ JQLs match some of the same items                                                                                 | planned; **recommends building measurement only** |

**Why 2 has no plan.** It is the only item that stops a 429 from surfacing as a failed report rather
than merely making one less likely, and it is needed even for a single report on a page — one
`loadChildren` report can exhaust the budget alone. It was deliberately deferred at the point these
four were written, not judged unimportant. It ranks second.

## What the plans concluded that the ranking didn't anticipate

- **Plan 5 argues itself down to measurement.** Request savings from partial overlap are governed by
  `ceil(N/1000)` changelog batching, so shrinking a batch saves nothing — only emptying one does. In
  `before.md`'s own scenario a perfect overlap cache removes **1 request of 9**, not the 27% that the
  slot-count redundancy figure suggests. The 27% is slots, not requests.
- **Plan 3 found the sharpest 429-shaped moment in the system**: the deep loader starts every child
  batch synchronously in one `.map`, so the children phase opens with N simultaneous POSTs.
- **Plan 4's payoff is unknown until measured.** Its Phase 1 is a network-panel procedure with an
  explicit decision rule, because whether Jira caps page size in the presence of `expand` decides
  whether this is urgent or merely tidy.
- **Plan 1 grew a second half.** Deduping identical requests is only half the job: reports over one JQL
  don't send identical requests, because a Table contributes its columns' fields and a Gantt contributes
  none. So plan 1 now also computes a field union per query group at the document layer, from the static
  `sections` roster. On a five-report document that is the difference between three fetches and one.
  A debounce and a request barrier were both considered and rejected — see that plan's §Where the field
  union is computed.

## Corrections to `before.md`

- **§1.1 is stale.** Both `allFieldsToRequest` implementations have dropped the report's `fields` URL
  param, so the union is now `fieldsToRequest ∪ tableColumnFields` only.
- **§4's "shareable" table is wrong about rollback.** `rollbackIssues` builds sprint, version and
  status lookups from the whole array before rolling back each issue, so its output depends on the
  array's membership — it is not a pure function of one issue. This does not affect plan 1 (identical
  membership by construction) but it is a constraint on plan 5.

## Open across more than one plan

Two plans independently flagged the same suspect path: `useRawIssueRequestData.ts` reads
`rawIssuesRequestData.progressData.issuesReceived` without the `.value` segment that
`useReportLoadingState.ts` documents as required. If it resolves, the settings sidebar's issue counter
may be reporting wrong numbers on the deep-children path; if it does not, it is dead. Unresolved from
source alone — marked **[UNVERIFIED]** in both plans.

**Resolved for plan 1, still open for plan 5.** Earlier drafts flagged one unmeasured premise as common
to both: nobody had counted how much real documents overlap. Those are two different questions, and only
plan 5's is still open. Plan 1 asks whether a document's reports reuse _one_ query — the user has counted,
and they do, so plan 1's `[UNVERIFIED]` flag is retired. Plan 5 asks how much _different_ queries overlap,
which remains unmeasured and still gates its entire build.

Plan 1 also declines to measure whether Jira shrinks a search page as the requested field list grows,
which its field union makes larger. Decided rather than deferred: real field-set deltas are a field or two
on top of a mostly-core set, so there is nothing for a payload cap to bite on. Note that this is the same
question plan 4 has to answer for `expand=changelog` — if anyone measures it there, plan 1 gets the answer
for free.
