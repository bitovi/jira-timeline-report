# Saved data — where it lives today, what it costs us, and where it could go

Four questions, answered in order:

1. [How do we save reports in the website vs. the embedded app?](#1-how-we-save-today)
2. [How much storage do we actually get?](#2-how-much-storage-we-get)
3. [Would a `STATREPS` Jira project make sense — at least as an option?](#3-the-statreps-idea) → deep dive in [001-jira-project-storage.md](./001-jira-project-storage.md)
4. [Could we let people opt into a new way of saving?](#4-letting-people-opt-in) → deep dive in [002-pluggable-backends.md](./002-pluggable-backends.md)

## TL;DR

- **One interface, two backends.** `AppStorage` is three methods — `get(key)`, `update(key, value)`,
  `storageInitialized()` (`src/jira/storage/common.ts:3`). The embedded build picks one, the website
  build picks the other, at bundle time.
- **Embedded (Connect):** one Connect **app property** per key. **32 KB per key**, four keys in use.
- **Website (OAuth):** _all four keys_ packed into a single ```json code block in the description of
one Jira issue titled `Jira Auto Scheduler Configuration`. **~32,767 characters, shared.**
- **The ceilings are closer than they look.** Measured against real record shapes: ~**73 saved
  reports** _or_ ~**31 teams** fills 32 KB. In the website those two compete for the _same_ budget.
  Nothing warns the user; the write just fails (or silently truncates).
- **Three structural problems**, none of which are fixed by a bigger box: every save is a
  read-modify-write of the whole blob (**lost updates**), the store is site-wide with **no permission
  model** (every app user sees every report), and the website does a **JQL search per key per
  operation** (~5 searches just to boot).
- **A `STATREPS` project is the only option on the table that fixes all three at once**, because it
  makes a report a first-class Jira object: its own permissions, its own history, its own edit
  conflict domain. The price is a JQL search to list reports and a real migration.
- **Recommendation:** don't replace anything. Widen `AppStorage` from blob-shaped to
  record-shaped, add a Jira-project backend behind a feature flag and a runtime pointer, and let
  the app-property store keep doing what it's genuinely good at — holding the ~200-byte pointer
  that says which backend is live. See [§ Recommendation](#recommendation).

---

## 1. How we save today

### The seam

```ts
// src/jira/storage/common.ts:3
export type StorageFactory = (jiraHelper: ReturnType<typeof jiraHelpers>) => {
  get: <TData>(key: string, defaultShape?: unknown) => Promise<TData | null>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  storageInitialized: () => Promise<boolean>;
};
```

Selected at build time — `src/plugin.main.ts:49` (`createJiraPluginStorage`) and
`src/web.main.ts:19` (`createWebAppStorage`) — and handed to React through
`StorageProvider` / `useStorage` (`src/react/services/storage/StorageProvider.tsx:10`).

There are exactly **four keys**, and every one of them is a whole-collection blob:

| Key             | Shape                                                     | Written from                              |
| --------------- | --------------------------------------------------------- | ----------------------------------------- |
| `saved-reports` | `Record<reportId, {id, name, queryParams, sections?}>`    | `src/jira/reports/fetcher.ts:21`          |
| `all-team-data` | `Record<teamName, Record<hierarchyLevel, Configuration>>` | `.../team-configuration/key-factory.ts:1` |
| `theme`         | `Array<{label, backgroundColor}>`                         | `src/jira/theme/fetcher.ts:67`            |
| `features`      | `Record<featureFlag, boolean>`                            | `src/jira/features/fetcher.ts:13`         |

Note the shape: **`get`/`update` operate on the whole collection**. There is no "save one report."
That single fact drives most of what follows.

### Backend A — embedded / Connect plugin

`src/jira/storage/index.plugin.ts`. One Connect add-on property per key:

```
PUT|GET /rest/atlassian-connect/1/addons/{appKey}/properties/{key}
```

- App-scoped, site-wide. Not per-user, not per-project. There is no variant of this endpoint that
  _is_ per-user or per-project.
- `get` self-heals: a 404 writes `defaultShape` and returns it (`index.plugin.ts:57-69`).
- Requires the `AP` bridge, so it only works inside the Jira iframe.
- Descriptor asks for Connect `["read", "write"]` (`scripts/atlassian-connect/base-connect.json`),
  which is already enough to create and edit issues if we ever go that route.

### Backend B — website / OAuth

`src/jira/storage/index.web.ts`. Everything lives in **one issue's description**:

- The issue is found by JQL every single time: `summary ~ "Jira Auto Scheduler Configuration"`
  (`index.web.ts:55`, title from `src/shared/configurationIssue.ts`).
- Its description ADF is scanned for the first `codeBlock`; that block's text is
  `JSON.parse`d into `Record<storageKey, value>` (`index.web.ts:104-113`).
- `update` re-reads the issue, mutates one key, and rewrites the whole code block
  (`index.web.ts:115-179`).
- There is a **special case for `all-team-data`**: when the description also contains a table with a
  `Team` header, the update mirrors velocity/tracks/sprint-length into that human-readable table so
  the Auto Scheduler can read it (`index.web.ts:128-155`, TR-133). This is marked temporary in the
  code and is a hard constraint on any migration — something outside this app reads that table.
- Logged out (no `accessToken`/`scopeId` in localStorage) it returns `null` and the app runs on
  mock data (`index.web.ts:42-49`).
- Setup is manual and documented for humans: `docs/saved-reports.md`. `storageInitialized()`
  returning false is what renders "Team storage has not been configured"
  (`src/react/services/storage/StorageNeedsConfigured.tsx`).

**Read amplification.** Because `getConfigurationIssue` runs inside both `get` and `update`, a cold
boot that reads all four keys plus the `storageInitialized` check issues **~5 JQL searches** before
the first report renders, and every save costs a search + an edit. Given the app's history with
rate limiting (`spec/001-comments-causing-rate-limiting.md`) this is worth knowing, and it is worth
knowing that a Jira-project backend would _also_ list via search — see
[001 § Cost model](./001-jira-project-storage.md#cost-model).

### The two backends are not equivalent

Same interface, materially different semantics. Anything built on top has to tolerate both:

|                        | Embedded (app properties)   | Website (config issue)                              |
| ---------------------- | --------------------------- | --------------------------------------------------- |
| Budget                 | 32 KB **per key**           | ~32,767 chars **shared by all keys**                |
| Missing store          | Auto-created on first `get` | Returns `null`; user must hand-create an issue      |
| Visible to users       | No                          | Yes — and hand-editable, therefore hand-corruptible |
| Survives app uninstall | No (app data is removed)    | Yes (it's just an issue)                            |
| Requires               | Jira iframe (`AP`)          | `read:jira-work` + `write:jira-work`                |

---

## 2. How much storage we get

### Documented limits

| Mechanism                                                   | Per-value cap                        | Count cap                                             | Confidence                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Connect app property (what the plugin uses)                 | **32 KB**                            | ~100 properties per app                               | Size documented; count documented on the Confluence side — [verify for Jira](#open-questions) before relying on it |
| Jira issue/project **entity** property                      | **32,768 bytes**, key ≤ 255 bytes    | **Unlimited per entity**                              | Documented                                                                                                         |
| Jira text field (issue description — what the website uses) | **32,767 characters**                | —                                                     | Documented; not raisable on Cloud                                                                                  |
| Jira attachment                                             | 1 GB default per file, 2 GB max      | Free 2 GB total / Standard 250 GB / Premium unlimited | Documented                                                                                                         |
| Forge KVS (if we ever migrate off Connect)                  | **240 KiB** per key, key ≤ 500 chars | 4,000 reads + 4,000 writes/min per install            | Documented                                                                                                         |

The headline: **every JSON-shaped Atlassian storage primitive available to a Connect app is 32 KB.**
There is no bigger box. The only ways past it are _more boxes_ (entity properties are uncapped in
count) or _a different medium_ (attachments), and both of those mean sharding — which is the same
work as going record-oriented, with none of the benefits.

### What that means in practice (measured, not guessed)

Sizes below are `JSON.stringify().length` over the app's real record shapes.

**Team data** — a `Configuration` is 9 fields (`.../team-configuration/shared.ts:17`); a team carries
one per hierarchy level plus `defaults`:

| Teams (defaults + 3 levels each) | Bytes       | % of 32 KB                      |
| -------------------------------- | ----------- | ------------------------------- |
| 10                               | 11,165      | 34%                             |
| 20                               | 21,325      | 65%                             |
| 25                               | 26,405      | 81%                             |
| **~31**                          | **~32,768** | **100% — writes start failing** |

**Saved reports** — using a realistic 374-char `queryParams` (JQL + statuses + timing calculations;
the examples committed in `public/examples/bitovi-training.js` are ~190 chars, real ones are longer):

| Reports | Bytes       | % of 32 KB |
| ------- | ----------- | ---------- |
| 25      | 11,171      | 34%        |
| 50      | 22,371      | 68%        |
| 70      | 31,331      | 96%        |
| **~73** | **~32,768** | **100%**   |

Two caveats that make these numbers optimistic:

- **Report-of-reports documents carry a `sections` tree** (`src/jira/reports/fetcher.ts:16`,
  `.../ReportOfReports/model/sections.ts`) on top of `queryParams` — and `StoredNode` deliberately
  round-trips unknown keys (`WithRaw`), so documents only grow. A handful of composed documents can
  cost as much as dozens of plain reports.
- **In the website build all four keys share one 32,767-char budget**, and the ADF wrapper plus the
  mirrored team table (`index.web.ts:128-155`) eat into it before any of our JSON does. A site with
  20 teams and 40 reports is already at the edge.

An enterprise customer with 40 teams cannot save their team configuration today. They will find out
when a save fails.

### The three problems a bigger box would not fix

1. **Lost updates.** Both backends read the whole collection, mutate one entry, write the whole
   collection back. Two people saving two _different_ reports thirty seconds apart: one of them
   silently disappears. There is no version check, no ETag, no retry.
2. **No permission model.** The app-property store is a single app-scoped blob; the config issue is
   one issue everyone with app access can read. There is no "this report is only for the leadership
   group," and no way to build one on top of a single blob.
3. **The store is a blob, but the data is a collection.** `saved-reports` and `all-team-data` are
   maps keyed by id. Every consumer wants one entry. The interface forces the whole thing across the
   wire, into memory, and back — which is also why (1) exists.

---

## 3. The `STATREPS` idea

**Short answer: yes, and it's a better idea than it first looks — because it isn't really a storage
change, it's a modeling change.**

The reason it's attractive isn't the byte count (though 32,767 chars _per report_ instead of for
_all_ reports is a ~70× improvement). It's that making a report a Jira issue gets you, for free,
the exact three things the current design cannot provide:

| Problem today                         | What one-issue-per-report gives you                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lost updates across unrelated reports | Two people editing two reports never touch the same record. Blast radius drops from "the whole collection" to "one report."                                                              |
| No permissions                        | Jira's project permission scheme _is_ the ACL. Restrict `STATREPS` to a group and only that group sees the reports. Issue security schemes give per-report ACLs where the site has them. |
| No history                            | Issue history records every description change, with author and timestamp. "Who changed the Q3 report's JQL?" becomes answerable.                                                        |

And some things nobody asked for but everyone will use: comment on a report, watch a report,
`@`-mention someone on a report, find a report in Jira's global search, link a report to the
initiative it reports on.

**The costs are real and worth naming up front:**

- Listing reports means a JQL search per app load (roughly what the website backend already pays).
- Someone with project-create permission has to create the project — or point the app at an existing one.
- Saving requires the user to have Create/Edit Issue permission there. Today, saving requires nothing.
- Reports become issues, so they show up in dashboards, boards, and global search unless the project
  is set up to keep them out of the way.
- Migration is genuinely a migration, not a format bump.

Full design — issue type, where the payload actually lives (entity property vs. description, and why
that choice trades history against robustness), the `TEAMMAP` companion project, bootstrap, and cost
model — is in **[001-jira-project-storage.md](./001-jira-project-storage.md)**.

## 4. Letting people opt in

Yes, and the shape of the code is already most of the way there: `StorageFactory` is a one-function
seam with two implementations. Three things are missing.

1. **The interface is the wrong shape.** `get(key)`/`update(key, value)` is blob-oriented. A
   project-backed store emulating it would search for every read and rewrite every issue on every
   write — all the cost of the new design with none of the benefit. The collection keys need
   `list()` / `getOne(id)` / `putOne(id, v)` / `deleteOne(id)`; `theme` and `features` are genuinely
   singletons and can stay blobs.
2. **There's no runtime pointer.** The backend is chosen at bundle time. It needs to be chosen at
   runtime from a tiny config record — which is the one job the 32 KB app-property store is perfect
   for. Data moves out; the ~200-byte "here's where the data is" pointer stays.
3. **There's no migration path.** Copy-forward, dual-read, and an explicit user-initiated cutover,
   with the old blob retained read-only for a release. Note the TR-133 team table
   (`index.web.ts:128-155`) is read by the Auto Scheduler and has to keep being written throughout.

Full design in **[002-pluggable-backends.md](./002-pluggable-backends.md)**.

---

## Recommendation

Additive, in this order. Nothing here forces a customer to move.

**Now — stop the silent failure.** Serialize before writing, compare against 32 KB (32,767 for the
website), and surface a real warning in the UI at ~80%. This is a day of work and it is the
difference between "the app has a limit" and "the app lost my data." Do this regardless of
everything below.

**Next — widen the interface.** Add record-oriented methods for `saved-reports` and `all-team-data`,
implemented over the existing blob backends first. No behavior change, no migration, and it's the
prerequisite for every option after this.

**Then — build the Jira-project backend behind a flag.** `features` already exists as a flag store
(`src/jira/features/fetcher.ts`) and `defineFeatureFlag` is already the pattern. Ship it as opt-in
for the customers who are hitting the ceiling and the ones asking for report permissions.

**Keep app properties.** Not as a fallback — as the bootstrap pointer. It's the only store both
builds can reach without configuration, and 32 KB is enormous for a pointer.

**Don't do:** sharding the blob across numbered app properties (`saved-reports-0`, `-1`, …). It buys
headroom, costs a rewrite of the read path, and fixes none of the three structural problems. If
we're touching the read path anyway, go record-oriented.

## Open questions

- **Is the ~100-property-per-app cap real for Jira Connect add-on properties?** Documented on the
  Confluence side; the Jira app-properties page wouldn't render for me. Only matters if we shard —
  which the recommendation avoids.
- **Does `/rest/api/3/search/jql` return issue entity properties inline via a `properties` param?**
  This is load-bearing for [001](./001-jira-project-storage.md#cost-model): if yes, listing reports
  is 1 request; if no, it's 1 + N. `searchJiraIssuesWithJQL` builds arbitrary query params
  (`src/jira-oidc-helpers/jira.ts:126`) so threading it through needs no new plumbing — but the
  endpoint's support needs a live test. **Test this before committing to the design.**
- **What reads the TR-133 team table besides the Auto Scheduler**, and does it need to keep working
  after a `TEAMMAP` migration?
- **Does the Marketplace listing / privacy policy need updating** if customer report data starts
  living in customer-owned issues rather than app storage? Probably a simplification, but Legal
  should see it.

## Sources

- [Jira Cloud — Entity properties](https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/) — 32,768-byte values, 255-byte keys, unlimited count per entity
- [Jira Cloud — App properties REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-app-properties/)
- [Confluence Cloud — App properties API](https://developer.atlassian.com/cloud/confluence/app-properties-api/) — 100 properties per app, 32 KB each
- [Atlassian Support — text field character limit (32,767)](https://support.atlassian.com/atlassian-cloud/kb/commentbodycharacterlimitexceededexception-no-message-or-the-entered-text-is-too-long-it-exceeds-the-allowed-limit-of-32-767-characters-error-message-in-jcma/)
- [Atlassian Support — configure file attachments](https://support.atlassian.com/jira-cloud-administration/docs/configure-file-attachments/)
- [Forge — KVS and Custom Entity Store limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/) — 240 KiB per key
- [Jira Cloud — Issue search REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/)
