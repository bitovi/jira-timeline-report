# 007 — Secondary Report Improvements

The **secondary report** is the row of cards rendered below the primary report (Gantt /
scatter). It is the React `WorkBreakdown` report
([`src/react/reports/WorkBreakdown/WorkBreakdown.tsx`](../../src/react/reports/WorkBreakdown/WorkBreakdown.tsx)),
mounted from [`src/timeline-report.js`](../../src/timeline-report.js) into
`#react-secondary-report-container`. It has two modes today — `status` and `breakdown` — both
built purely from `rollupStatuses` by
[`buildBoard.ts`](../../src/react/reports/WorkBreakdown/helpers/buildBoard.ts).

This effort has two goals:

1. **Reduce noise** — let the user filter the secondary report down to items that need attention
   (changed, blocked, or warning).
2. **Explain _why_** — surface qualitative narrative (an "executive summary") on each card,
   replacing the per-child status swatches with prose about what actually happened.

Each idea below is written as an independent `requirements.md` so they can be picked up
separately. The five "summary source" ideas are competing approaches for goal #2 — we will build
requirements for each, then pick one (or a phased combination) to implement.

## Ideas

| #   | Idea                                         | Folder                                                                        | Goal                 | Depends on       |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------- | -------------------- | ---------------- |
| 1   | Filter to changed / blocked / warning        | [`filter-changed-and-blocked/`](./filter-changed-and-blocked/requirements.md) | Reduce noise         | —                |
| 2   | Summary card display (shared render surface) | [`summary-card-display/`](./summary-card-display/requirements.md)             | Explain why          | —                |
| 3   | Status summary custom field (read + write)   | [`status-summary/`](./status-summary/requirements.md)                         | Explain why (source) | Idea 2           |
| 4   | User-typed summary saved to Jira             | [`user-typed-summary/`](./user-typed-summary/requirements.md)                 | Explain why (source) | Idea 2, (3 or 6) |
| 5   | EXEC SUMMARY marker comment                  | [`exec-summary-comment/`](./exec-summary-comment/requirements.md)             | Explain why (source) | Idea 2           |
| 6   | Pull last / child comments                   | [`pull-comments/`](./pull-comments/requirements.md)                           | Explain why (source) | Idea 2           |
| 7   | Anthropic-key AI summary                     | [`ai-summary/`](./ai-summary/requirements.md)                                 | Explain why (source) | Idea 2, filter   |

## Shared context (applies to all ideas)

- **Change detection gap.** `issueLastPeriod` (driven by the Compare-to slider,
  [`rollup-and-rollback.ts`](../../src/jira/rolledup-and-rolledback/rollup-and-rollback.ts))
  currently carries only the prior period's **dates** — not a computed prior **status**. Date
  slips are already computed (`dateSlip` helper). Detecting "status changed since last period"
  requires new derivation in
  [`work-status.ts`](../../src/jira/rolledup/work-status/work-status.ts). This work lives in
  Idea 1 and is a prerequisite for any "what changed" narrative.
- **Blocked / warning already exist** as rollup status values (`blocked`, `warning`), computed
  from `blockedStatusIssues` / `warningIssues`. No new derivation needed to filter on them.
- **Fields fetched today** are `CORE_FIELDS` + user-selected fields in
  [`jira-data-requests.js`](../../src/stateful-data/jira-data-requests.js). Named-field mapping
  runs through [`fields.ts`](../../src/jira-oidc-helpers/fields.ts) / `mapIdsToNames`. Adding a
  field is cheap; adding **comments** is not (see below).
- **Comments are not fetched today**, and there is a documented Jira rate-limiting problem with
  per-issue fetches ([spec/001](../001-comments-causing-rate-limiting.md)). Any comment-based
  idea must fetch narrowly (only visible/expanded cards) or use a bulk endpoint.
- **Write path** exists: `editJiraIssueWithNamedFields`
  ([`jira.ts`](../../src/jira-oidc-helpers/jira.ts)) → `fieldsToEditBody` → `PUT` issue.
- **React service layer** for new queries/mutations lives in
  [`src/react/services/jira/`](../../src/react/services/jira/) (Provider + key-factory +
  `useSuspenseQuery`/`useMutation` hooks). Local config (AI key, per-report settings) belongs in
  [`src/react/services/storage/`](../../src/react/services/storage/).

## Evaluation framework (fill in when comparing sources 3–7)

| Criterion                        | Status summary field | User-typed | EXEC comment | Pull comments | AI summary |
| -------------------------------- | -------------------- | ---------- | ------------ | ------------- | ---------- |
| No Jira admin setup required     |                      |            |              |               |            |
| No rate-limit risk               |                      |            |              |               |            |
| Author-controlled / high signal  |                      |            |              |               |            |
| Works read-only (no write scope) |                      |            |              |               |            |
| Implementation effort            |                      |            |              |               |            |
| Ongoing maintenance / cost       |                      |            |              |               |            |
| Data freshness                   |                      |            |              |               |            |

Each source doc ends with its own effort/risk call-out to populate this table.
