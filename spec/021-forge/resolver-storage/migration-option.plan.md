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

| #   | Decision                                             | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The probe must not seed.**                         | `createForgeConnectStorage.get()` PUTs `defaultShape` back on a 404, so probing with it _creates_ the property and the prompt would show for fresh installs with nothing to copy.                                                                                                                                                                                                                                                                                                           |
| 2   | **The "already migrated" flag lives in KVS.**        | It describes the KVS store, so it travels with it: clear KVS and the flag goes too, making re-migration correct rather than blocked. A flag in app properties would strand a user with an empty KVS and no way back, and would mean writing to the otherwise read-only legacy store.                                                                                                                                                                                                        |
| 3   | **Reports copy the blob _and_ the pointer, always.** | Forge ends up looking exactly like Connect did. With a `space` pointer the Connect `saved-reports` blob may be the only copy of pre-space reports — `MigrateReportsModal` offers "No, start empty" — and it is lost for good at Connect EOS. Copying the blob alone would be wrong: Forge would default to `legacy` and show those stale reports instead of the space. Copying the pointer too keeps Forge on the space, with the blob dormant in KVS exactly as it was dormant in Connect. |
| 4   | **Migrated data overwrites whatever KVS holds.**     | Predictable, and idempotent by construction, so "press it again" repairs a partial run with no bookkeeping. Safe only because decision 2 makes this a first-run operation.                                                                                                                                                                                                                                                                                                                  |
| 5   | **Per-group selection, re-runnable on failure.**     | One group failing must not block the rest. Mirrors the existing space-migration modal.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | **Theme and font are one choice.**                   | Users think "my appearance", not "two app properties". Two keys behind one checkbox.                                                                                                                                                                                                                                                                                                                                                                                                        |

## Groups

Four checkboxes, six keys.

| Checkbox        | Storage key(s)                            | Notes                                   |
| --------------- | ----------------------------------------- | --------------------------------------- |
| Saved reports   | `reports-storage-config`, `saved-reports` | One unit; pointer written first (below) |
| Team settings   | `all-team-data`                           |                                         |
| Appearance      | `theme`, `themeFont`                      | One checkbox, two keys; fails as a unit |
| Feature toggles | `features`                                |                                         |

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

Rendered at the **top of the app**, on the Forge host only (`jira.host === 'forge'`), when the flag is
absent **and** at least one probe returns data. Order matters: host, then flag, then probe.

The host check is not about Connect, which is gone by the time this ships — it keeps the banner off
the **web** build, where there is nothing to migrate and `peekConnectProperty`'s `requestJira` (from
`@forge/bridge`) does not exist. `Storage.tsx:71` checks `jira.host !== 'hosted'`, which is the same
thing once Connect is gone; `=== 'forge'` says it directly.

When the Connect pointer is `space`, the banner says so up front — e.g. "Your saved reports are in
**{space}**; Forge will keep using it." Nothing extra to do: the pointer is copied (decision 3), and
the work items are already in Jira.

**"Not now" closes for the session and does not persist.** No permanent dismissal: a
dismissed-forever banner with no other entry point would strand the user, because the Storage panel
is gated behind the `reportsStorage` feature flag (`SettingsSidebar.tsx:44`) which is off on a fresh
KVS store. The banner returns next load until the migration runs. Deliberate — the alternative is
silent data loss, and the whole feature expires with `app.connect.key`.

### 5. The modal

New component beside `MigrateReportsModal`, reusing its structure (`MigrateReportsModal.tsx:8-16`):
`onClose` neutered while migrating, both footer buttons disabled while migrating, progress as
"Copying N of M…", failures as "Could not copy: … Try again to retry them."

Adds the four checkboxes. When the Connect pointer is `space`, the reports checkbox names the space
("Saved reports (in {space})") instead of counting reports.

**Write order inside the reports group: pointer, then blob.** If the blob write fails after the
pointer lands, Forge shows the space — correct — and a retry fills in the dormant blob. The reverse
order would leave Forge on `legacy` showing stale reports until the retry.

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
| add    | a banner component                                                                 | top of the app, Forge only                    |
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
- with a `space` pointer, both the pointer and the blob are copied, pointer first (decision 3); a
  failed blob write still leaves the pointer in KVS
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
7. On a site whose Connect pointer is `space`: banner names the space; after migrating, Forge lists the
   space's reports, and switching Forge's storage setting to legacy lists the pre-space blob
   (decision 3).
8. `npm run test`, `npx tsc --noEmit`, `npm run build:forge`.

## Explicitly out of scope

Any change to how web or Connect store anything; sharding; the Reports Space backend; deleting or
rewriting Connect app properties; a hidden UI for clearing the flag — the developer console already
does it, and verification step 6 is the test.
