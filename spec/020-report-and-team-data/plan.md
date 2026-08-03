# Report and team data — moving records out of the blob

Implementation plan for the direction explored in
[spec/019-saved-data-options](../019-saved-data-options/README.md). That folder asked _what could we
do_; this one says _what we should do, in what order, and how we'd know it worked._

- [prior-art.md](./prior-art.md) — how other Jira apps solve this, and why the most famous adopter
  of this exact pattern abandoned it on Cloud (spoiler: a scale problem we don't have)
- [mockups/storage-settings.html](./mockups/storage-settings.html) — the new **Global Settings → Data storage** panel, four states
- [mockups/migration-flow.html](./mockups/migration-flow.html) — the migration wizard, and what the data looks like in Jira afterward

## TL;DR

Today `saved-reports` and `all-team-data` are each **one JSON blob in one 32 KB slot**. That caps a
site at ~73 reports or ~31 teams, makes every save a whole-collection read-modify-write (so two
people saving different reports can clobber each other), and makes per-report permissions
impossible to build.

The fix is to stop storing a collection and start storing records. Six phases, **each of the first
two shipping value on its own**, and nothing before Phase 4 changes where a single byte lives:

| #   | Phase                                                   | Ships value alone?                        | Blocked by    |
| --- | ------------------------------------------------------- | ----------------------------------------- | ------------- |
| 0   | Spike: does JQL search return entity properties inline? | Answers a design question                 | —             |
| 1   | Size guard + capacity warning                           | **Yes** — stops silent data loss today    | —             |
| 2   | `RecordStore` interface over the existing backends      | **Yes** — deletes whole-collection writes | —             |
| 3   | `storage-config` pointer + `createStorage` factory      | No — plumbing                             | 2             |
| 4   | `STATREPS` backend for reports, behind a flag           | **Yes** — for customers at the ceiling    | 0, 3          |
| 5   | Migration UI                                            | **Yes** — makes 4 usable                  | 4             |
| 6   | `TEAMMAP` for team data                                 | Yes                                       | 4, **TR-133** |

**Phase 1 is the one to do this week regardless of everything else.** It's about a day, and it's the
difference between "the app has a limit" and "the app lost my work."

**Phase 6 has a hard external dependency.** The Auto Scheduler reads the team table this app writes
into the config issue description (`src/jira/storage/index.web.ts:128-155`, TR-133). Team data cannot
move until that's resolved with whoever owns that. Treat it as a blocking dependency, not cleanup.

---

## Why this shape and not another

Three candidate fixes, from [019 §2](../019-saved-data-options/README.md#2-how-much-storage-we-get):

**Shard the blob** across numbered app properties (`saved-reports-0`, `-1`, …). Buys headroom.
Requires rewriting the read path. Fixes none of the lost-update, permission, or history problems.
Rejected — if we're touching the read path anyway, go record-oriented.

**Build our own backend.** Every app that did this had a data-volume problem
([prior-art.md](./prior-art.md)). We have ~100 records written a few times a day. Adds
infrastructure, a security review, and a data-residency objection to solve a problem we don't have.
Rejected.

**One Jira issue per record.** Uncaps the count, gives each record its own permissions, its own
history, and its own edit-conflict domain. The pattern is validated across the Server/DC ecosystem
and sits comfortably inside our size class. **Chosen.**

It also has a commercial upside [019](../019-saved-data-options/README.md) didn't make: customer
reports end up in the customer's own Jira, which means they're covered by the customer's backups,
they survive uninstalling the app, and the data-residency question answers itself.

## The design

### Records

```
STATREPS project                                TEAMMAP project
├─ STATREPS-1  "Q3 Platform Status"             ├─ TEAMMAP-1  "Platform"
├─ STATREPS-2  "Exec Rollup"                    ├─ TEAMMAP-2  "Payments"
└─ STATREPS-3  "Payments Timeline"              └─ TEAMMAP-3  "Mobile"
```

Neither project is required, neither name is hardcoded, and **either can be an existing project the
customer already has** — the app needs a project key, not a new project. That matters: creating a
project is a site-admin action in most orgs, and requiring one would gate the feature behind a
ticket to IT.

Per issue:

| Where                                            | What                                                    | Why there                                                                               |
| ------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Summary                                          | Report name / team name                                 | Indexed, sortable, and it's what every Jira surface shows                               |
| `bitovi.status-report.payload` (entity property) | `{schemaVersion, legacyId, queryParams, sections?}`     | 32 KB each, **unlimited count per issue**, invisible so users can't corrupt it          |
| Description                                      | Rendered, human-readable view — never parsed            | Gives issue history something to diff, so "who changed the Q3 report?" stays answerable |
| Labels                                           | Report type (`start-due`, `cards`, `report-of-reports`) | JQL-filterable without reading payloads                                                 |

The description/property split is the one genuinely contested decision — see
[019 § Where the payload actually lives](../019-saved-data-options/001-jira-project-storage.md#where-the-payload-actually-lives).
Payload in the property gets robustness; the rendered description buys back the audit trail that
entity properties don't have. If the description write fails, the payload is still correct.

### Identity — keep the old id

`Report.id` today is an arbitrary object key, and report-of-reports documents reference it
(`{type: 'saved-report', params: {reportId}}`, `.../ReportOfReports/model/sections.ts`). Re-keying to
issue keys would break every composed document.

So: **the issue key is the storage address, `legacyId` stays the application identity.** Store
`legacyId` in the payload, keep resolving by it, and let new reports use the issue key for both.
A few lines in the resolver, and it makes migration non-destructive and re-runnable.

### The pointer

Which backend is live is a ~200-byte record, and app properties are excellent at holding ~200 bytes.
Data moves out; the pointer stays.

```ts
type StorageConfig = { kind: 'legacy' } | { kind: 'jira-project'; reportsProject: string; teamsProject?: string };
```

Unrecognized `kind` (written by a newer client) falls back to `legacy` with a warning rather than
crashing — the same tolerance principle as `UnknownNode` in the report-of-reports schema.

---

## Phases

### Phase 0 — Spike: does search return entity properties inline?

**One question, and it changes the Phase 4 design.** If `/rest/api/3/search/jql` accepts a
`properties` param and returns issue entity properties inline, listing reports is **one request**. If
not, it's **1 + N**, and Phase 4 needs a project-property index instead.

`searchJiraIssuesWithJQL` (`src/jira-oidc-helpers/jira.ts:126`) already builds arbitrary query params,
so this is an afternoon against a real site — not a code change.

Also confirm while you're in there:

- Can a Connect app write issue entity properties via `AP.request`, with the current
  `["read", "write"]` descriptor scopes?
- Do the OAuth scopes in `.env.example` (`read:jira-work` + `write:jira-work`) cover property writes?

**Done when:** a one-page findings note in this folder says which listing strategy Phase 4 uses.

**Fallback if `properties` isn't supported:** a project property on `STATREPS` holding a compact
`[{issueKey, legacyId, name, type}]` index — 32 KB is ~500 entries — written on save, rebuilt from
search when it looks stale. Costs one extra write per save and reintroduces a small shared-blob
write. Acceptable, but the inline path is much better; find out which one we're on before designing
around it.

### Phase 1 — Size guard and capacity warning

**Do this first and independently. It is the highest value-per-hour item in the plan.**

Today a write that exceeds the limit fails (or truncates) with nothing surfaced to the user.

- Serialize before writing; compare against the backend's real budget: **32,768 bytes per key**
  for the plugin, **32,767 characters shared across all keys** for the website. The website's
  smaller, shared budget is the one that bites first.
- Refuse the write and show an actionable error rather than letting Jira reject it.
- Surface a capacity meter at ≥80% in the settings panel — see
  [mockups/storage-settings.html](./mockups/storage-settings.html), "approaching the limit" state.

**Done when:** a site with 70 reports sees a warning, a site attempting the 74th gets a clear error
naming what to delete, and neither path loses existing data. Unit tests cover both budgets.

### Phase 2 — `RecordStore` over the existing backends

No migration, no behavior change, no new storage. Just the right interface over today's blobs.

```ts
export type RecordStore<T> = {
  list(): Promise<Array<T & { id: string }>>;
  get(id: string): Promise<T | null>;
  put(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
};

export type AppStorage = {
  reports: RecordStore<Report>;
  teams: RecordStore<TeamConfiguration>;
  get<T>(key: 'theme' | 'features' | 'storage-config'): Promise<T | null>;
  update<T>(key: 'theme' | 'features' | 'storage-config', value: T): Promise<void>;
  storageInitialized(): Promise<boolean>;
};
```

`put` reads the blob, splices one entry, writes it back — literally what happens today, behind a
better name. `theme` and `features` are genuine singletons and keep the blob methods.

Call sites to move: `useSaveReports`, `useAllReports`, `useSaveAllTeamData`, `useAllTeamData`,
`ViewReport`. Two need care:

- `getAllReports` sets `routeData.reportsData = reports` as a side effect
  (`src/jira/reports/fetcher.ts:27`) — a can.js bridge, not storage. Keep it attached to `list()`.
- `fixAnyNonExistingFields` (`.../team-configuration/fetcher.ts:48`) rewrites the whole team blob on
  finding one stale field reference. Becomes one `put` per affected team.

**Write the contract test suite here** — one suite, run against every backend. It's what makes
Phase 4 safe, and it's cheap to write while there's only one implementation to satisfy it.

**Done when:** no call site outside `src/jira/storage/` mutates a whole collection, the contract
suite passes against both existing backends, and behavior is observably unchanged.

### Phase 3 — The pointer and the factory

```ts
// src/jira/storage/index.ts
export async function createStorage(jiraHelpers, bootstrap: AppStorage): Promise<AppStorage> {
  const config = (await bootstrap.get<StorageConfig>('storage-config')) ?? { kind: 'legacy' };
  switch (config.kind) {
    case 'jira-project':
      return createJiraProjectStorage(jiraHelpers, config);
    default:
      return bootstrap;
  }
}
```

`bootstrap` stays whichever backend the build picks (`src/plugin.main.ts:49`, `src/web.main.ts:19`).
**The build-time choice doesn't go away** — it decides _how we talk to Jira_; the pointer decides
_where the data sits_. Independent, so all four combinations work, including an embedded app reading
reports out of a Jira project.

Boot order: read pointer → construct backend → `storageInitialized()` → render. One extra round trip
in the plugin; free in the website, where the pointer rides in the code block already being fetched.

**Done when:** with no pointer written, both builds behave exactly as today, and a hand-written
`{kind:'jira-project'}` pointer routes to a stub backend.

### Phase 4 — The `STATREPS` backend, behind a feature flag

Implement `RecordStore<Report>` over Jira issues. `features` already exists as a flag store
(`src/jira/features/fetcher.ts`) and `defineFeatureFlag` is the established pattern.

| Method       | Implementation                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `list()`     | JQL `project = {key} AND statusCategory != Done ORDER BY updated DESC`, payloads inline (Phase 0) or via the index |
| `get(id)`    | From the list; otherwise resolve `legacyId` → issue key, then one property GET                                     |
| `put(id, v)` | Create-or-update issue, PUT payload property, then write the rendered description                                  |
| `remove(id)` | **Transition to Done, do not delete.** Recoverable, and it keeps the history that was half the point               |

Route every request through the existing helpers — the search endpoint has already moved under us
once (`spec/search-api-deprecation.md`).

Handle up front, because each is a support ticket otherwise:

- **No write permission** in the chosen project → detect on load and disable saving with an
  explanation, don't fail on first save.
- **Project deleted or access revoked** → fall back to `legacy`, banner, **don't wipe the pointer**.
- **Issue noise** → document recommending a company-managed project with no board and suppressed
  notifications; note the `project != STATREPS` clause customers may want in saved filters.

**Done when:** the contract suite from Phase 2 passes against the new backend, a report survives a
create/edit/list/delete round trip, and two browsers saving two different reports both persist.

### Phase 5 — Migration UI

Migration moves customer data somewhere with different permissions and different visibility. It is
**user-initiated, reversible, and never deletes anything.** See
[mockups/migration-flow.html](./mockups/migration-flow.html).

1. **Choose** — pick an existing project or name a new one. Show a permission precheck.
2. **Dry run** — "42 reports and 12 teams will be copied to OPS. Nothing is deleted."
3. **Copy** — idempotent on `legacyId`; re-running repairs a partial copy instead of duplicating.
4. **Dual-read** — reads prefer the project, fall back to the blob for anything missing; writes go
   to the project only. The blob is now a frozen backup.
5. **Reconcile and cut over** — show "42 migrated, 42 found" and let _the user_ press the button
   that stops the fallback read.
6. **Retain** — the blob stays for at least one release. It's 32 KB. Never auto-delete it.

**Done when:** a site migrates, a deliberately-failed copy is repaired by re-running, and reverting
the pointer restores the old behavior with no data loss.

### Phase 6 — `TEAMMAP`

Same backend shape for `RecordStore<TeamConfiguration>`, summary = team name. Team keys are already
team names (`getTeamKeyDefault`, `src/jira/normalized/defaults.ts:169`), so identity is free.

**Blocked on TR-133.** The website backend mirrors velocity / tracks / sprint length into a
human-readable table in the config issue description _because the Jira Auto Scheduler reads it_
(`src/jira/storage/index.web.ts:128-155`). It's marked temporary in the code, but something outside
this repo depends on it. Either keep writing that table indefinitely, or coordinate a matching change
there. **Resolve this before starting the phase, not during it.**

Nice side effect: `fixAnyNonExistingFields` stops rewriting every team to fix one.

---

## Testing

**One contract suite, every backend.** Written in Phase 2 against the blob backends, then reused
unchanged for the project backend. It's the main reason Phase 2 comes before Phase 4.

Cases worth naming: concurrent `put` of two different records both survive; `put` of a record larger
than the budget fails loudly and leaves prior state intact; `list()` on an empty store returns `[]`
rather than throwing; `remove()` of an unknown id is a no-op; unknown fields on a stored record
survive a round trip (the `WithRaw` principle from the report-of-reports schema).

Plus, for the project backend specifically: migration is idempotent; pointer-to-a-dead-project falls
back rather than crashing; a read-only user can read and is told clearly why they can't save.

## Risks

| Risk                                                                | Mitigation                                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Search API changes again mid-build                                  | Everything goes through existing helpers; Phase 0 documents which endpoint behavior we depend on                            |
| Saving now requires Jira write permission — a capability regression | `{kind:'legacy'}` stays supported indefinitely, not deprecated. It's the only mode where saving needs no Jira write access. |
| Reports pollute boards, backlogs, dashboards                        | Recommend a board-less company-managed project; document the filter clause; suppress notifications                          |
| Half-migrated state                                                 | Idempotent copy on `legacyId`; dual-read stays on until the user confirms                                                   |
| Phase 6 breaks the Auto Scheduler                                   | Hard block on TR-133                                                                                                        |
| Scope creep into a general storage abstraction                      | Only two collections are getting record methods. `theme` and `features` stay blobs. Resist adding a third.                  |

## Open questions

1. **Does JQL search return entity properties inline?** Phase 0. Everything about Phase 4's cost
   model depends on it.
2. **Who owns TR-133 / the Auto Scheduler team-table contract**, and can it be retired?
3. **Default issue type** — plain `Task` (works everywhere, no admin needed) or a custom type
   (cleaner, requires a site admin)? Leaning `Task`, configurable.
4. **Is the ~100-property-per-app cap real for Jira?** Documented on the Confluence side only. Only
   matters if we ever shard, which this plan avoids.
5. **Does the Marketplace listing or privacy policy need updating** when customer data moves into
   customer-owned issues? Probably a simplification, but Legal should see it.
