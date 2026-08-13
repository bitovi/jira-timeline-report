# Saved reports storage — Reports Space

> Supersedes the storage portion of [spec/019](../019-saved-data-options/README.md) and
> [spec/020](../020-report-and-team-data/plan.md), deliberately narrower: reports only, no entity
> properties, no migration wizard.

## Context

Every saved report on a site is packed into **one** record. Users are already hitting the limit:

| Host                      | Where reports live                                                                                                                 | Budget                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Connect (marketplace app) | Connect app property `saved-reports`, via the `AP` bridge (`src/jira/storage/index.plugin.ts`)                                     | 32 KB for the key                                         |
| Web (standalone + OAuth)  | One ```json code block in the description of an issue titled `Jira Auto Scheduler Configuration` (`src/jira/storage/index.web.ts`) | 32,767 chars **shared** with theme, features, teams, font |

That caps a site at roughly 73 reports (fewer on web), and the write fails or truncates with nothing
surfaced to the user. It also means every save rewrites the whole collection, so two people saving
two _different_ reports can clobber each other.

**These two stores are disjoint.** Save a report in the Jira-embedded app, open the standalone web
app signed in to the same Jira, and it isn't there. Confirmed: the Connect app property is keyed by
app key and is a Connect-only REST resource the web build cannot read at all.

**Outcome:** a per-host "Reports Storage" setting. Keep today's behaviour as one option; add
**Reports Space**, where each saved report is its own Jira work item — summary is the report name,
description is the report JSON in a ```json block. Removes the ceiling, drops the blast radius of a
save from the collection to one report, and — because a space is readable by both hosts — makes
saved reports shareable across Connect and Web for the first time.

## Scope

In: saved reports, the settings screen, the pointer, a one-button migration.
Out: team data (avoids the TR-133 Auto Scheduler dependency entirely), theme, features, font — all
stay exactly where they are. Out: Forge (see [spec/021](../021-forge/README.md)).

---

## The setting

New `Storage` button in the left sidebar under `Theme`, flying out like every other one.

`src/react/SettingsSidebar/components/ReportSettings/ReportSettings.tsx` — add below the `THEME`
button. `public/images/storage.svg` already exists.

```tsx
<SidebarButton onClick={() => changeSettings('STORAGE')}>
  <img src="/images/storage.svg" className="w-[18px]" aria-hidden />
  Storage
</SidebarButton>
```

`src/react/SettingsSidebar/SettingsSidebar.tsx` — add the branch, following the `FEATURES` case:

```tsx
{
  showSettings === 'STORAGE' && (
    <SidebarLayout onGoBack={returnToSettings} className="w-[560px]">
      <Storage />
    </SidebarLayout>
  );
}
```

### The panel

Two cards, **Connect** and **Web**. Only the card for the host you are actually running in is
editable. The other renders its two options unselected and disabled — it documents how the other
host works, it does not show live state. That is a deliberate limit, not an omission: the web build
cannot read a Connect app property, so there is no live state to show in that direction.

```
┌─ Connect ──────────────────────┐  ┌─ Web ───────────── (info) ─────┐
│ Reports Storage                │  │ Reports Storage                │
│ ● Key/Value                    │  │ ○ Configuration Issue          │
│ ○ Reports Space                │  │ ○ Reports Space                │
│     Space Name  [STATREPS   ]  │  │                                │
│     Space Type  [Story    ▾ ]  │  │ Configured from the standalone │
│                          [Save]│  │ web app. Open it to change.    │
└────────────────────────────────┘  └────────────────────────────────┘

Point both hosts at the same space and they share the same saved reports.
```

- Radio 1 is labelled per host: **Key/Value** (Connect) / **Configuration Issue** (Web). Same stored
  shape either way — only the label differs.
- **Space Name** is the space key of a space the user already created (`STATREPS`, `OPS`, anything).
  The app never creates a space.
- **Space Type** is the work item type each report becomes (Story / Task / Epic …).
- Sharing note rendered under the cards — this is intended behaviour, not an accident.

Component layout follows `Features`:

```
src/react/SettingsSidebar/components/Storage/
├── Storage.tsx          # the two cards
├── StorageWrapper.tsx   # FlagsProvider + ErrorBoundary + Suspense + StorageProvider + QueryClientProvider
├── components/StorageCard/
└── index.ts             # exports StorageWrapper as default, as Features/index.ts does
```

Populate **Space Type** from `GET /rest/api/3/issue/createmeta/{spaceKey}/issuetypes` once a Space
Name is entered, so the list is valid for that space by construction. Do **not** fall back to the
site-wide `fetchIssueTypes`: a failure here is the earliest honest signal that the key is wrong or
you don't have access. On Save, `GET /rest/api/3/project/{spaceKey}` to confirm the
space exists and is reachable, and show an inline error if not.

---

## The pointer

New storage key, written through the existing per-host `AppStorage` — Connect gets an app property,
Web gets another entry in the config issue code block. Web therefore still needs a configuration
issue even when reports live in a space; that is accepted.

```ts
// src/jira/storage/reports-config.ts
export type ReportsStorageConfig = { kind: 'legacy' } | { kind: 'space'; spaceName: string; spaceType: string };

export const reportsStorageConfigKey = 'reports-storage-config';
```

Read once at boot. Anything unrecognised (written by a newer client) falls back to `legacy` with a
`console.warn` rather than throwing — same tolerance as `UnknownNode` in the report-of-reports schema.

---

## The backend seam

Deliberately narrower than spec/020's `RecordStore`. Three methods, exactly what the read path and
the three mutation hooks need:

```ts
// src/jira/reports/backend/types.ts
export type ReportsBackend = {
  readAll(): Promise<Reports>;
  upsert(report: Report, allReports: Reports): Promise<void>;
  remove(report: Report, allReports: Reports): Promise<void>;
};
```

Both params on purpose: the legacy backend needs the whole map (that is what it writes today, byte
for byte, so its behaviour is unchanged), the space backend needs the single record. Each
implementation ignores the argument it does not want. Document that in the type.

|           | `createLegacyReportsBackend(storage)`         | `createSpaceReportsBackend(jiraHelpers, config)` |
| --------- | --------------------------------------------- | ------------------------------------------------ |
| `readAll` | `storage.get('saved-reports')`                | 1 JQL search, payloads inline                    |
| `upsert`  | `storage.update('saved-reports', allReports)` | create-or-edit one work item                     |
| `remove`  | `storage.update('saved-reports', allReports)` | tombstone one work item (edit Summary + Description)

Chosen at boot from the pointer, in a factory alongside the existing `createStorage` call sites
(`src/plugin.main.ts:49`, `src/web.main.ts:19`). The build-time host choice stays — it decides _how_
we talk to Jira; the pointer decides _where reports sit_.

### Space backend details

**`readAll`** — reuse `fetchJiraIssuesWithJQLWithNamedFields`, the same call `index.web.ts` already
makes, so it works on both hosts through their own request helpers with no new plumbing:

```ts
jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
  jql: `project = "${spaceName}" AND issuetype = "${spaceType}" ORDER BY updated DESC`,
  fields: ['summary', 'Description'],
});
```

Find the first `codeBlock` in each description, `JSON.parse` it, key the result by `report.id`.
**A report whose JSON fails to parse is skipped with a `console.warn`, never thrown** — one
hand-mangled description must not blank the whole list.

**Identity.** The payload is the whole `Report` object, `id` included, so `id` round-trips and
report-of-reports references (`{type:'saved-report', params:{reportId}}`) keep resolving with no
mapping table and no `legacyId` concept. The issue key is only an address: the backend holds an
in-memory `Map<reportId, issueKey>` filled by `readAll`. On an `upsert` miss it re-lists once before
creating, so a stale map cannot produce duplicates. `remove` on a miss is a no-op.

**Description ADF.** Extract `createCodeBlock` out of `src/jira/storage/index.web.ts` into a shared
module and reuse it. Prepend one paragraph — "Generated by Status Reports for Jira. Edits here are
overwritten." — above the code block.

### New Jira helpers

`src/jira-oidc-helpers/jira.ts` has no create or delete. Add both, copying the host branch in
`editJiraIssueWithNamedFields` (`:710`) — `AP.request` when `AP?.history?.getState` is present,
`fetch` otherwise:

- `createJiraIssue(config)` → `POST /rest/api/3/issue` with
  `{fields: {project: {key}, issuetype: {name}, summary, description}}`. Raw field ids, so it must
  **not** go through the `fieldsToEditBody` name mapping.
- `deleteJiraIssue(config)` → `DELETE /rest/api/3/issue/{key}`.

Existing `editJiraIssueWithNamedFields` covers the update path.

---

## Wiring the call sites

**Read path.** `readAllReports` currently does `storage.get` → `migrateReports` →
`publishReportsToRouteData` (`src/jira/reports/fetcher.ts:49`). Change its input from `AppStorage` to
`ReportsBackend` and keep the rest identical. Critical: the spec/018 migration table must run over
space-loaded reports too, and `publishReportsToRouteData` must still fire — `routeData.reportsData`
is what every param-backed setting falls back to.

**Write path.** All three mutations already funnel through one `useSaveReport` in
`src/react/services/reports/useSaveReports.tsx`. Only its `mutationFn` changes, from
`updateReports(storage, toSave)` to `backend.upsert(report, toSave)` / `backend.remove(...)`, so the
hooks pass which report changed alongside the map.

**Leave the optimistic-cache logic alone.** The `onMutate` snapshot, the `publishReportsToRouteData`
call, the deliberate absence of an `onSettled` refetch, and the `onError` rollback all carry
hard-won comments about Jira's search index lagging real writes. That reasoning applies to the space
backend at least as strongly — it also reads through search.

Also touch: `useAllReports` (`src/react/services/reports/useAllReports.ts`) and
`persistMigrations` (`src/jira/reports/migrations/persist.ts`), both of which take `storage` today.

---

## Migration

One button, one confirm. No wizard.

When the user switches from legacy to Reports Space and the legacy store holds at least one report:

> **Migrate your saved reports?**
> You're moving saved report storage to `STATREPS`. Would you like to copy your 42 existing saved
> reports into that space? Your current data is not deleted either way.
> **[ Yes, migrate ] [ No, start empty ]**

On Yes: list the space, then create one work item per report that is not already there (matched on
`report.id`), then write the pointer. Re-running repairs a partial copy instead of duplicating.
Report `n of m` progress and name any failures.

The legacy blob is **never** deleted or rewritten — it stays as a backup, and switching the radio
back to Key/Value restores the old behaviour immediately with nothing lost.

---

## Known trade-offs

Two, both accepted, both worth stating so nobody rediscovers them as bugs:

1. **The JSON is user-editable.** It's a description, so anyone with Edit Issues can corrupt it —
   the same failure mode the web backend has today, scoped to one report instead of all of them.
   Mitigated by the "edits are overwritten" banner and by skipping unparseable items rather than
   failing the list. (spec/019 chose an issue entity property to avoid this, at the cost of being
   invisible and unreadable by JQL search; the readability of a ```json block is the point here.)
2. **Saving now needs Jira write permission** in the space, and deleting needs Delete Issues, which
   is often admin-only. Legacy mode stays supported indefinitely — it's the only mode where saving a
   report requires no Jira write access at all. Detect missing permission on load and disable saving
   with an explanation, rather than failing on the user's first save.

Optionally gate the whole feature behind a flag in `src/configuration/features.ts` so it can ship
dark — the `features` store and `defineFeatureFlag` are already the established pattern.

---

## Files

| Action | Path                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| add    | `src/jira/storage/reports-config.ts` — pointer type + key                                 |
| add    | `src/jira/reports/backend/{types,legacy,space,index}.ts`                                  |
| add    | `src/react/SettingsSidebar/components/Storage/**`                                         |
| add    | `createJiraIssue`, `deleteJiraIssue` in `src/jira-oidc-helpers/jira.ts`                   |
| edit   | `src/react/SettingsSidebar/components/ReportSettings/ReportSettings.tsx` — Storage button |
| edit   | `src/react/SettingsSidebar/SettingsSidebar.tsx` — `STORAGE` branch                        |
| edit   | `src/jira/reports/fetcher.ts` — take `ReportsBackend`                                     |
| edit   | `src/react/services/reports/{useSaveReports.tsx,useAllReports.ts}`                        |
| edit   | `src/jira/storage/index.web.ts` — export `createCodeBlock` for reuse                      |
| edit   | `src/plugin.main.ts`, `src/web.main.ts` — build the backend from the pointer              |

## Verification

`npm test` (vitest). Existing neighbours to model tests on: `useSaveReports.test.tsx`,
`Features.test.tsx`, `ReportSettings.test.tsx`.

Unit:

- space `readAll` parses a code-block description; a malformed one is skipped, not thrown
- `upsert` creates when the id is unknown and edits when known; `remove` on an unknown id is a no-op
- migration is idempotent — running it twice creates no duplicates
- an unrecognised pointer `kind` falls back to `legacy`
- legacy backend writes byte-identical payloads to today (guards the 100%-of-users path)

End to end, against a real Jira, **both builds**:

1. Storage panel opens from the sidebar; the non-active card is visibly disabled.
2. Set Space Name + Type, save, confirm the pointer round-trips through a reload.
3. Migrate with existing reports; confirm one work item per report, summary = report name,
   description = readable ```json. Re-run; confirm no duplicates.
4. Create, rename, and delete a report; confirm the work item is created / edited / deleted.
5. Open a report-of-reports document that references migrated reports; confirm it still resolves.
6. Point the _other_ host at the same space and confirm the same reports appear — the cross-host
   sharing claim.
7. Switch back to Key/Value; confirm the original reports are all still there.

## Open questions

1. Does `GET /rest/api/3/issue/createmeta/{spaceKey}/issuetypes` work on both hosts? Fallback is the
   site-wide `fetchIssueTypes`, which lets a user pick a type the space doesn't have.
2. Does `POST /rest/api/3/issue` work over the `AP` bridge with the current `["read", "write"]`
   descriptor scopes (`scripts/atlassian-connect/base-connect.json`)? Connect asks for write, so it
   should — confirm before building the space backend.
3. Connect end-of-support is Q4 2026 and Phase 2 enforcement (no Marketplace updates without a Forge
   manifest) passed in March 2026 — see [spec/021](../021-forge/platform-constraints.md#the-connect-timeline).
   Issue-backed reports are the one storage option that survives the Forge jump unchanged, so this
   work de-risks that migration; but the Connect _pointer_ lives in an app property, which may not.
