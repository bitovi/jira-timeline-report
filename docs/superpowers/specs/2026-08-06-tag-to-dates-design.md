# POST /tag-to-dates — design

**Date:** 2026-08-06
**Status:** Approved, ready for implementation plan

## Problem

Jira Automation rules used alongside Status Reports need to turn a half-quarter planning tag
(`my-tag-25.Q2.T1`) into a date, so a rule can write an issue's Start date or Due date from a label.

The [jira-auto-scheduler](https://github.com/bitovi/jira-auto-scheduler) repo has this as
`POST /tag-to-dates` (`server/tag-to-dates.js`), but it lives on that app's server. Meanwhile the
Status Reports wiki already documents the endpoint at
`https://statusreports.bitovi.com/tag-to-dates` — a URL that has never resolved. `POST /tag-to-dates`
returns Express's default 404 on both Status Reports API hosts, so the endpoint exists nowhere.

This spec ports the logic into Status Reports' own Express server and makes the documentation true.

## Goals

- `POST /tag-to-dates` live on the Status Reports API server, callable from Jira Automation.
- One source of truth for where half-quarter boundaries fall, shared with the existing date rounding.
- Corrected wiki documentation.

## Non-goals

- Wiring tag parsing into report rendering (normalization, Gantt bars, release timing). The consumers
  are Automation rules, not the UI.
- Porting the other two auto-scheduler endpoints. `/adjusted-story-points` and
  `/dates-to-half-quarter-dates` already exist here as in-process code
  (`src/utils/math/confidence.js`, `src/utils/date/round.js`) and are out of scope.
- Any CDN routing so the endpoint answers on `statusreports.bitovi.com`. See Deployment.

## Background

### What upstream does

`server/tag-to-dates.js` reads `startTag` or `endTag` from the body, accepts a string or an array,
matches `/(\d{2})\.Q(\d)\.?T?(\d)?$/`, and returns `{ isoDate, isoDay }`. Its half-quarter placement
disagrees with its sibling endpoint `dates-to-half-quarter-dates.js` by one day.

### What already exists here

`src/utils/date/round.js` is a port of `dates-to-half-quarter-dates.js`. Its private `HALF_QUARTERS`
table is the canonical set of boundaries in this repo, consumed via `roundDate.halfQuarter` by the
Gantt grid, Scatter plot, Report of Reports, and route-data.

`server/server.js` is a small Express app (`/access-token`, `/domain`) deployed to EC2 by
`.github/workflows/deploy-{staging,prod}.yaml`.

## Decisions

| Decision                   | Choice                                                                      | Rationale                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the logic lives      | New `src/utils/date/half-quarters.js`; `round.js` imports the table from it | Single source of truth for boundaries with a ten-line diff to existing code. Rewriting `round.js`'s rounding functions was rejected — it touches four report surfaces for no functional gain. |
| Fidelity to upstream       | Fix the discrepancies                                                       | The endpoint has no existing consumers to protect (see Deployment), so there is no compatibility cost to being correct.                                                                       |
| Request fields             | `startTag` / `endTag`                                                       | Matches the implementation any existing rule would have been written against. The wiki's single `tag` field cannot express an end date, which is half the use case.                           |
| Both fields in one request | `400`                                                                       | A rule needs one date per call. Upstream silently returns the _end_ date of your `startTag`, which is a trap.                                                                                 |
| Input shape                | List-aware: string, JSON array, or comma-separated string                   | `{{issue.labels}}` renders in an Automation body as comma-separated text, so this is the shape that actually arrives.                                                                         |
| `T3`+                      | Lenient — falls through to full-quarter bounds                              | Matches upstream.                                                                                                                                                                             |
| 4-digit years              | Used as-is                                                                  | Upstream reads the last two digits and adds 2000, so `1999.Q1` returns 2099. Identical results for 2000–2099.                                                                                 |
| Error body                 | `{ errors: [message] }`                                                     | Matches upstream's shape for this endpoint. Differs from the neighbouring `/access-token`'s `{ error: true, message }`; accepted as the lesser inconsistency.                                 |
| Documented URL             | `https://api-status-reports.bitovi.tools/tag-to-dates`                      | The host the server already answers on. Requires no infrastructure work.                                                                                                                      |

## Design

### Files

```
src/utils/date/half-quarters.js       NEW   HALF_QUARTERS + parsing + tagsToDate
src/utils/date/half-quarters.test.ts  NEW   vitest
src/utils/date/round.test.ts          NEW   roundDate.halfQuarter regression test
src/utils/date/round.js               MOD   -11 lines, +1 import
server/tag-to-dates.js                NEW   express handler, no date math
server/tag-to-dates.test.js           NEW   handler branching, fake res
server/server.js                      MOD   +1 route, +1 import
.dockerignore                         MOD   comment: server/ imports from src/
```

### `src/utils/date/half-quarters.js` (new, plain ESM `.js`)

Plain JavaScript, not TypeScript, because `node server/server.js` imports it directly with no build
step. This follows the precedent already set by `round.js`, which is `.js` and imported from
TypeScript. `tsconfig.json` excludes `**/*.js` from typecheck, and `allowJs` is on.

```js
export const HALF_QUARTERS = [...]         // moved verbatim from round.js
export function parseHalfQuarterTag(text)  // → { year, quarter, half|null } | null
export function halfQuarterTagToDate(text, { isEndDate })  // → Date (UTC) | null
export function tagsToDate(input, { isEndDate })           // → Date (UTC) | null
```

`half` is `1` or `2`. Any other digit — the lenient `T3`+ case — yields `half: null`, which is the
same representation as a tag with no `.TT` at all and therefore produces full-quarter bounds.

`tagsToDate` is the list-aware entry point. It normalizes `input` to candidate strings (array →
flatten; every string → split on `,`; trim; drop empties), parses each, discards misses, then takes
the minimum for a start date or the maximum for an end date. It returns `null` when nothing parses.
The module never throws — the route decides what a miss means.

Splitting is comma-only. Jira labels cannot contain spaces, so `{{issue.labels}}` splits cleanly, and
a space-prefixed single tag such as `Roadmap 2026.Q2.T2` already matches because the pattern is
unanchored at the front. A tag followed by more text in the same label (`2026.Q1.T1 roadmap`) does
not match; this matches upstream and is documented rather than fixed.

Dates are constructed with `Date.UTC(...)`, making output independent of the server's timezone.

### Parsing

`/(\d{4}|\d{2})\.Q([1-4])(?:\.?T?(\d))?$/`, unanchored at the front so prefixed tags work:
`2026.Q1.T1`, `FY26.Q1`, `Roadmap 2026.Q2.T2`.

### Boundaries

Half-quarters start Jan 1 / Feb 15 / Apr 1 / May 15 / Jul 1 / Aug 15 / Oct 1 / Nov 15 — the existing
`HALF_QUARTERS` table. An end date is the day before the next boundary.

| Tag             | Start  | End    |
| --------------- | ------ | ------ |
| `…Q1.T1`        | Jan 1  | Feb 14 |
| `…Q1.T2`        | Feb 15 | Mar 31 |
| `…Q2.T1`        | Apr 1  | May 14 |
| `…Q2.T2`        | May 15 | Jun 30 |
| `…Q3.T1`        | Jul 1  | Aug 14 |
| `…Q3.T2`        | Aug 15 | Sep 30 |
| `…Q4.T1`        | Oct 1  | Nov 14 |
| `…Q4.T2`        | Nov 15 | Dec 31 |
| `…Q1` (no half) | Jan 1  | Mar 31 |
| `…Q4` (no half) | Oct 1  | Dec 31 |

Full-quarter tags land on the same dates as upstream. Only the T1/T2 seam moves.

### `server/tag-to-dates.js` (new) and `server/server.js` (one route)

A thin handler containing no date math:

```
startTag and endTag both present  → 400  { errors: ["Provide startTag or endTag, not both."] }
neither present                   → 400  { errors: ["Provide startTag or endTag."] }
nothing parses                    → 400  { errors: ["No valid half-quarter tag found."] }
otherwise                         → 200  { isoDate, isoDay }
```

```
POST /tag-to-dates
  { "startTag": "my-tag-25.Q2.T1" } → { "isoDate": "2025-04-01T00:00:00.000Z", "isoDay": "2025-04-01" }
  { "endTag":   "my-tag-25.Q2.T1" } → { "isoDate": "2025-05-14T00:00:00.000Z", "isoDay": "2025-05-14" }
```

The route is registered alongside `/access-token` and `/domain`. `app.use(cors())` is already global,
so the endpoint is public and unauthenticated, matching upstream. It reads no data and touches no
Jira credentials — it is a pure function of its input.

### `src/utils/date/round.js` (modified)

Delete the `HALF_QUARTERS` declaration (lines 1–11) and add
`import { HALF_QUARTERS } from './half-quarters.js';`. Nothing else changes; the rounding functions
and `roundDate` export are untouched.

## Deviations from upstream

1. **T1/T2 seam moves one day.** T1 end Feb 15 → Feb 14, T2 start Feb 16 → Feb 15, aligning with the
   `HALF_QUARTERS` table `round.js` already uses. Upstream's two endpoints disagreed with each other
   here; this makes them agree.
2. **`startTag` + `endTag` together is a 400** rather than silently returning the end date of the
   `startTag`.
3. **UTC-safe construction.** On a UTC server `isoDay` is unchanged; on UTC+X it stops being a day
   early. `isoDate`'s time component becomes `T00:00:00.000Z` where a US-hosted server previously
   returned `T05:00:00.000Z`. This only matters if a rule writes `isoDate` into a date-**time** field;
   rules writing `isoDay` into a date field are unaffected.
4. **4-digit years used as-is.** `1999.Q1` → 1999, not 2099.

## Testing

`src/utils/date/half-quarters.test.ts`, colocated per the convention of
`round-and-shift-due-date.test.ts`:

- All eight half-quarters and four full quarters, start and end, against the boundary table.
- Prefixed tags: `FY26.Q1`, `Roadmap 2026.Q2.T2`, `my-tag-25.Q2.T1`.
- Two-digit vs four-digit years, including `1999.Q1` → 1999.
- Lenient `T3` → full-quarter bounds.
- List input: comma-separated string, JSON array, and arrays with unparseable entries mixed in.
- Earliest-start and latest-end selection across multiple valid tags.
- Unparseable input → `null`.

Assertions are on exact ISO strings, which makes them timezone-proof by construction.

`src/utils/date/round.test.ts` (new) adds a small regression test for `roundDate.halfQuarter` as cheap
insurance, since `round.js` has no tests today and this change touches a path four report surfaces
depend on.

`server/tag-to-dates.test.js` covers the handler's own branching — both tags, neither tag, no body,
and input containing no tag — by calling it as a plain function with a stand-in `res` that records
`status`/`json`. This needs no HTTP server and no `supertest` dependency.

Full HTTP-level tests are still out of scope; the route registration itself is verified by booting
the server and exercising the endpoint with curl.

`ci.yaml:20-22` runs `typecheck`, `build`, and `test` on every PR, so these are enforced.

## Deployment

|         | Express server                                    | Frontend CDN                                                              |
| ------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| prod    | `https://api-status-reports.bitovi.tools`         | `statusreports.bitovi.com`, `status-reports.bitovi.tools`                 |
| staging | `https://api-status-reports-staging.bitovi.tools` | `statusreports-staging.bitovi.com`, `status-reports-staging.bitovi.tools` |

Verified by `GET /access-token` on both API hosts returning `{"error":true,"message":"No Access code
provided"}`, which is `server/server.js:38` verbatim.

Merging to `main` deploys to staging (`deploy-staging.yaml:4-5`). Publishing a GitHub release deploys
to prod (`deploy-prod.yaml:3-5`). No infrastructure change is required.

`.dockerignore` does not exclude `src`, and the Dockerfile does `COPY . .`, so the production image
already ships `src/` and the route's import resolves. A comment should be added to `.dockerignore`
recording that `server/` imports from `src/utils/date/`, so nobody prunes `src` from the image later.

Making `https://statusreports.bitovi.com/tag-to-dates` resolve would need a CDN rule routing that path
to the API origin. That host sits behind Cloudflare (resolves to 104.26.x / 172.67.x) fronting a
CloudFront origin. Out of scope; noted as a possible follow-up if a shorter URL is wanted.

## Wiki updates

The page at
<https://wiki.at.bitovi.com/wiki/spaces/StatusReportsForJira/pages/2485518357/POST+tag-to-dates>
needs three corrections. Replacement text:

> ## Overview
>
> `POST https://api-status-reports.bitovi.tools/tag-to-dates` converts a half-quarter planning tag
> into a date. Staging: `https://api-status-reports-staging.bitovi.tools/tag-to-dates`.
>
> ## Request
>
> Send exactly one of `startTag` or `endTag`. Sending both, or neither, returns 400.
>
> ```json
> { "startTag": "my-tag-25.Q2.T1" }
> ```
>
> Each accepts a single tag, a comma-separated list, or a JSON array — useful for passing
> `{{issue.labels}}` directly. With a list, `startTag` returns the earliest start and `endTag` the
> latest end; entries that are not tags are ignored.
>
> A tag is any string **ending** in `YY.QQ`, `YYYY.QQ`, `YY.QQ.TT`, or `YYYY.QQ.TT`.
> Examples: `foo-25.Q1` is Q1 2025; `foo-25.Q1.T2` is the second half of Q1 2025.
>
> ## Response
>
> ```json
> { "isoDate": "2025-04-01T00:00:00.000Z", "isoDay": "2025-04-01" }
> ```
>
> - `isoDate` — ISO datetime, always UTC midnight.
> - `isoDay` — ISO date. This is the value to write into a Jira date field.
>
> ## Period boundaries
>
> | Tag      | Start  | End    |
> | -------- | ------ | ------ |
> | `…Q1.T1` | Jan 1  | Feb 14 |
> | `…Q1.T2` | Feb 15 | Mar 31 |
> | `…Q2.T1` | Apr 1  | May 14 |
> | `…Q2.T2` | May 15 | Jun 30 |
> | `…Q3.T1` | Jul 1  | Aug 14 |
> | `…Q3.T2` | Aug 15 | Sep 30 |
> | `…Q4.T1` | Oct 1  | Nov 14 |
> | `…Q4.T2` | Nov 15 | Dec 31 |
>
> A tag with no `.TT` covers the whole quarter — `foo-25.Q1` is Jan 1 to Mar 31.
>
> ## Errors
>
> `400` with `{ "errors": ["..."] }` when both or neither field is sent, or when no entry parses as a
> tag.

## Follow-ups

- Optional CDN route so `statusreports.bitovi.com/tag-to-dates` resolves.
- `src/utils/math/confidence.js` and `src/utils/date/round.js` are duplicated source shared with
  jira-auto-scheduler and free to drift. Not addressed here.
