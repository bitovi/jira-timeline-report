# Letting people choose where their data lives

> Companion to [README.md](./README.md) and [001-jira-project-storage.md](./001-jira-project-storage.md).
> This file answers "would we be able to allow people to use this new way of saving data somehow?"

Yes. The seam already exists — `StorageFactory` (`src/jira/storage/common.ts:3`) has two
implementations and one call site each (`src/plugin.main.ts:49`, `src/web.main.ts:19`). Three things
have to change to turn a build-time choice into a runtime one.

## 1. The interface is the wrong shape

```ts
get: <TData>(key: string, defaultShape?: unknown) => Promise<TData | null>;
update: <TData>(key: string, value: TData) => Promise<void>;
```

Blob in, blob out. Two of the four keys — `saved-reports` and `all-team-data` — are _collections_, and
every consumer wants one entry. A project-backed store forced to honor this contract would search for
every read and rewrite every issue on every write: all the cost of the new design with none of the
benefit, and the lost-update race preserved intact.

So widen it. Collections get record methods; genuine singletons keep the blob methods.

```ts
export type RecordStore<T> = {
  list(): Promise<Array<T & { id: string }>>;
  get(id: string): Promise<T | null>;
  put(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
};

export type AppStorage = {
  reports: RecordStore<Report>; // was the `saved-reports` key
  teams: RecordStore<TeamConfiguration>; // was the `all-team-data` key
  get<T>(key: 'theme' | 'features'): Promise<T | null>; // genuine singletons, unchanged
  update<T>(key: 'theme' | 'features', value: T): Promise<void>;
  storageInitialized(): Promise<boolean>;
};
```

**Do this first, over the existing blob backends, with no migration and no behavior change.**
`put` reads the blob, splices one entry, writes it back — exactly what happens today, just behind a
better name. That refactor is worth shipping on its own merits: it deletes the whole-collection
mutation from every call site (`useSaveReports`, `useSaveAllTeamData`, `ViewReport`), and it's the
precondition for every backend after this one.

Two call sites need attention while doing it:

- `getAllReports` writes `routeData.reportsData = reports` as a side effect
  (`src/jira/reports/fetcher.ts:27`) — a can.js bridge, not storage. Keep it attached to `list()`.
- `fixAnyNonExistingFields` (`.../team-configuration/fetcher.ts:48`) rewrites the whole team blob when
  it finds a stale field reference. Under `RecordStore` that becomes one `put` per affected team.

## 2. There's no runtime pointer

The backend needs to be chosen at boot from a small config record. That record has to live somewhere
every build can reach with zero configuration — which is the one thing the 32 KB app-property store
is genuinely excellent at.

```ts
type StorageConfig =
  | { kind: 'legacy' } // today's behavior
  | { kind: 'jira-project'; reportsProject: string; teamsProject?: string };
```

~200 bytes. Read once at boot from the existing store under a new `storage-config` key, before
anything else. Unrecognized `kind` (written by a newer client) falls back to `legacy` and warns
rather than crashing — same tolerance principle as `UnknownNode` in the report-of-reports schema
(`.../ReportOfReports/model/sections.ts`).

Bootstrap order becomes: read pointer → construct backend → `storageInitialized()` → render. That's
one extra round trip in the plugin. In the website it's free, because the pointer rides along in the
config issue's existing code block, which is already being fetched.

Then the factory:

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

`bootstrap` is whichever of the two existing backends the build already picks. **The build-time
choice doesn't go away** — it still decides how we talk to Jira. The pointer decides where the data
sits. Those are independent, which means all four combinations work, including "embedded app reading
reports out of a Jira project."

## 3. There's no migration path, and it can't be automatic

Migration moves customer data into a location with different permissions, different visibility, and a
different failure mode. It must be user-initiated and reversible. The five steps
([001 § Migration](./001-jira-project-storage.md#migration)) reduce to one UI:

**Settings → Data storage**, showing:

- where data lives now, and how full it is — this is where the ~80% warning from the
  [README recommendation](./README.md#recommendation) surfaces
- what the alternatives buy (permissions, history, headroom) and cost (needs a project; saving
  requires Jira write access there)
- a project picker that accepts an existing project, not just a newly created one
- a dry run: "42 reports and 12 teams will be copied to OPS. Nothing is deleted."
- after copying: a reconciliation the user confirms before fallback reads stop
- an unmistakable statement that the old blob is retained

Gate the whole thing on a feature flag. `features` already exists as a flag store
(`src/jira/features/fetcher.ts`), `defineFeatureFlag` is the established pattern
(`src/shared/configurationIssue.ts` uses it), and the flag lets us ship the backend to the two
customers who are hitting the ceiling before it's a general-availability feature.

## What this does _not_ require

- **No change to report or team data shapes.** `Report` (`src/jira/reports/fetcher.ts:6`) and
  `TeamConfiguration` (`.../team-configuration/shared.ts:29`) travel as-is. Adding `legacyId` to the
  stored payload is additive.
- **No new OAuth scopes.** `read:jira-work` + `write:jira-work` (`.env.example`) already cover issue
  create/edit and entity properties. Connect already asks for `["read", "write"]`
  (`scripts/atlassian-connect/base-connect.json`).
  (Aside: `CONTRIBUTING.md:58-60` has contributors grant `read:app-data:confluence` /
  `write:app-data:confluence`, but **nothing in `src/` calls Confluence** — grep finds zero hits.
  Those scopes are vestigial and could be dropped from the setup docs.)
- **No change to the two existing backends.** They stay, they keep working, and `{kind: 'legacy'}`
  remains a supported configuration indefinitely — not a deprecation. It is the only mode where
  saving a report needs no Jira write permission.

## Risks

| Risk                                                                       | Mitigation                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Half-migrated state after a failed copy                                    | Copy is idempotent on `legacyId`; re-running repairs. Fallback reads stay on until the user confirms.                                          |
| Pointer written, backend unreachable (project deleted, permission revoked) | On backend construction failure, fall back to `legacy`, surface a banner, don't wipe the pointer.                                              |
| Two clients disagree about the pointer                                     | Pointer writes are rare and admin-initiated. Read it once at boot; don't poll.                                                                 |
| Users lose the ability to save (no write permission in the chosen project) | Detect on load, not on first failed save. Show it in the storage settings panel.                                                               |
| Every backend combination needs testing                                    | The `RecordStore` refactor in step 1 makes backends testable in isolation — one contract test suite, run against each implementation.          |
| TR-133 team table stops being written                                      | Keep it in the write path for as long as the Auto Scheduler reads it. See [001 § TEAMMAP](./001-jira-project-storage.md#teammap-specifically). |

## Sequencing

| Step                                          | Depends on                  | Ships value on its own?                                    |
| --------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| Size guard + ~80% warning                     | —                           | Yes — stops silent data loss today                         |
| `RecordStore` refactor over existing backends | —                           | Yes — removes whole-collection writes from every call site |
| `storage-config` pointer + `createStorage`    | `RecordStore`               | No — plumbing                                              |
| Jira-project backend behind a flag            | pointer                     | Yes — for customers at the ceiling                         |
| Migration UI                                  | backend                     | Yes — makes the above usable                               |
| `TEAMMAP`                                     | backend + TR-133 resolution | Yes                                                        |

Every row above the last is additive and reversible. The first two are worth doing whether or not we
ever build the project backend.
