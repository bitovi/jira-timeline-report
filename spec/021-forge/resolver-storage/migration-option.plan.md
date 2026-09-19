# One-time migration: Connect app properties → Forge KVS

A button that copies an existing customer's saved data out of Connect app properties and into Forge's
Key-Value Store, once. Sub-plan of [plan.md](./plan.md), which names this as the one thing it left
out of scope.

## Context

[plan.md](./plan.md) is now built: the Forge host reads and writes KVS through a resolver, verified on
`prodcheck` (app version 9, 18 Sep 2026). It named exactly one follow-up — _"Migrating existing
Connect app-property data into KVS… needs its own plan."_ This is it.

**The problem.** Swapping `createStorage` to KVS gave the Forge host an empty store. Every existing
customer's saved reports, teams, theme and feature flags are still in Connect app properties, intact
but unreachable, because nothing reads that store any more. A customer upgrading to the fully-Forge
version opens the app and finds it blank.

**Why it is cheap.** Both factories already exist, are tested, and run side by side in the same
iframe: `createForgeConnectStorage` reaches app properties over `requestJira`, `createForgeKvsStorage`
reaches KVS over `invoke()` (both in `src/jira/storage/index.forge.ts`). No new scope, no manifest
change, no resolver work. The migration is a read from one and a write to the other.

**Why it is time-boxed.** Reading app properties works only while `manifest.yml` declares
`app.connect.key` — still the open question for Connect EOS in Dec 2026.

## Settled decisions

| #   | Decision                                               | Why                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The probe must not seed.**                           | `createForgeConnectStorage.get()` PUTs `defaultShape` back on a 404, so probing with it _creates_ the property and the prompt would show for fresh installs with nothing to copy.                                                                                                            |
| 2   | **The "already migrated" flag lives in KVS.**          | It describes the KVS store, so it travels with it: clear KVS and the flag goes too, making re-migration correct rather than blocked. A flag in app properties would strand a user with an empty KVS and no way back, and would mean writing to the otherwise read-only legacy store.         |
| 3   | **Reports copy only from the Connect `legacy` store.** | If the Connect pointer says `space`, reports are Jira work items and the Connect `saved-reports` blob is a stale leftover; copying it would resurrect old reports, and decision 4 makes that unrecoverable. The migration still _reads_ the pointer to pick the branch — it never copies it. |
| 4   | **Migrated data overwrites whatever KVS holds.**       | Predictable, and idempotent by construction, so "press it again" repairs a partial run with no bookkeeping. Safe only because decision 2 makes this a first-run operation.                                                                                                                   |
| 5   | **Per-group selection, re-runnable on failure.**       | One group failing must not block the rest. Mirrors the existing space-migration modal.                                                                                                                                                                                                       |
| 6   | **Theme and font are one choice.**                     | Users think "my appearance", not "two app properties". Two keys behind one checkbox.                                                                                                                                                                                                         |

## Groups

Four checkboxes, five keys. `reports-storage-config` is deliberately absent (decision 3).

| Checkbox        | Storage key(s)       | Notes                                      |
| --------------- | -------------------- | ------------------------------------------ |
| Saved reports   | `saved-reports`      | Hidden when the Connect pointer is `space` |
| Team settings   | `all-team-data`      |                                            |
| Appearance      | `theme`, `themeFont` | One checkbox, two keys; fails as a unit    |
| Feature toggles | `features`           |                                            |

## What gets built

### 1. A non-seeding probe

`src/jira/storage/index.forge.ts` — a standalone export, **not** a `StorageFactory` method (adding to
that interface would force `index.web.ts` and `index.plugin.ts` to implement it for no reason):

```ts
export const peekConnectProperty = async <TData>(appKey: string, key: string): Promise<TData | undefined>;
```

Raw `requestJira` GET; `undefined` on 404 **without writing**; throws on any other non-OK, matching
the 404-vs-error distinction already at `index.forge.ts:68`.

### 2. `useMigrateConnectData`

New hook in `src/react/services/reports-storage/`, modelled directly on `useMigrateReports.tsx` —
the same shape with different endpoints. Reuse verbatim:

- the `MigrationProgress` type, `{ isMigrating, copied, total, failures }` (`useMigrateReports.tsx:9`)
- the sequential `for` loop with per-item `try/catch`, pushing a label into `failures` and continuing
- `setProgress` after _every_ item with a fresh `failures` copy
- `resetProgress`, and the "source is never touched" guarantee (`useMigrateReports.tsx:36`)

Differences: iterate **groups** not reports; `failures` holds group labels; idempotency comes from
overwrite rather than diffing ids, so there is no destination read and no `alreadyThere`.

### 3. The flag

A seventh KVS key, `connect-migration`:

```ts
{ migratedAt: string; groups: string[] }
```

Written once, after a run with no failures. Read first on boot — if present, no probing happens at
all, so a migrated install pays exactly one KVS read. Add it to the canonical key-list comment at
`src/jira/storage/index.web.ts:78`.

### 4. The banner

Rendered on the Forge host only (`jira.host === 'forge'`, the check already at `Storage.tsx:70`), when
the flag is absent **and** at least one probe returns data. Order matters: flag first, then probe.

**"Not now" closes for the session and does not persist.** No permanent dismissal: a
dismissed-forever banner with no other entry point would strand the user, because the Storage panel
is gated behind the `reportsStorage` feature flag (`SettingsSidebar.tsx:44`) which is off on a fresh
KVS store. The banner returns next load until the migration runs. Deliberate — the alternative is
silent data loss, and the whole feature expires with `app.connect.key`.

### 5. The modal

New component beside `MigrateReportsModal`, reusing its structure (`MigrateReportsModal.tsx:8-16`):
`onClose` neutered while migrating, both footer buttons disabled while migrating, progress as
"Copying N of M…", failures as "Could not copy: … Try again to retry them."

Adds the four checkboxes, and — when the Connect pointer is `space` — a line naming the space and
telling the user to point Forge's storage setting at it, instead of a reports checkbox.

### 6. After a successful run: reload

Overwriting `features` changes which panels render and `theme` changes the whole look, so surgical
query invalidation is the wrong tool. Use the existing full reload — precedent is
`useUpdateFeatures.tsx:21` (`reloadApp()`), and commit `d02f6852` added the Forge app reloader for
exactly this class of problem.

## Files

| Action | Path                                                                               | Notes                                         |
| ------ | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| edit   | `src/jira/storage/index.forge.ts`                                                  | add `peekConnectProperty`                     |
| add    | `src/react/services/reports-storage/useMigrateConnectData.tsx`                     | the hook, modelled on `useMigrateReports.tsx` |
| add    | `src/react/services/reports-storage/connect-migration.ts`                          | flag key, shape, read/write, group→keys map   |
| add    | `src/react/SettingsSidebar/components/Storage/components/MigrateConnectDataModal/` | modal + `index.ts`                            |
| add    | a banner component                                                                 | placement to settle in review                 |
| edit   | `src/react/services/reports-storage/index.ts`                                      | barrel export                                 |
| edit   | `src/react/services/reports-storage/key-factory.ts`                                | query key for the flag                        |
| edit   | `src/jira/storage/index.web.ts`                                                    | extend the canonical key-list comment         |

## Verification

**Unit** — mirror `useMigrateReports.test.tsx`: `renderHook` with `StorageProvider` + `JiraProvider`,
fake storage objects for both ends.

- `peekConnectProperty` returns `undefined` on 404 **and asserts no write was issued** — decision 1,
  the one guaranteed to regress
- a group that fails leaves the others copied, and appears in `failures`
- re-running after a partial failure succeeds (overwrite idempotency)
- `theme` + `themeFont` fail and succeed as one unit
- the reports group is not offered when the Connect pointer is `space` (decision 3)
- the flag is written only when `failures` is empty

**End to end on `prodcheck` / `arthurpankiewicz.atlassian.net`** — the ideal fixture: real Connect
app-property data, and a KVS store holding only a `test` report.

1. Load the Forge app → banner appears.
2. Copy all four groups → reports, teams, appearance and flags all appear; the `test` report is gone
   (overwrite, decision 4).
3. Developer console → Storage → prodcheck: `theme`, `themeFont`, `all-team-data` and
   `connect-migration` now present alongside the existing three.
4. Reload → banner gone, one KVS read, no probing.
5. Confirm the Connect app properties are **unchanged** — the source is never touched.
6. Clear `connect-migration` in the developer console → banner returns, re-run works (decision 2).
7. `npm run test`, `npx tsc --noEmit`, `npm run build:forge`.

## Explicitly out of scope

Any change to how web or Connect store anything; sharding; the Reports Space backend; deleting or
rewriting Connect app properties; a hidden UI for clearing the flag — the developer console already
does it, and verification step 6 is the test.
