# Phase 1: Home page, Saved Reports page, stars, ownership and "last updated" (no new scopes)

## Context

The design project (claude.ai/design `70b49610…`) has three screens:

- **Home – No Report**: what you see with no report open. It says "Pick up where you left off", lists the recently opened reports in a table card with an "All saved reports →" link, and has a primary "Create new report" button. It replaces today's one-line `NoJqlMessage` ("Configure a JQL in the sidebar…").
- **ReportRow**: one table row. The columns are a star toggle, type icon + name + JQL line, owner, a type badge, and a delete button that appears on hover and only for your own reports. It has a `compact` density and an optional JQL line.
- **Saved Reports**: a full page with "Back to report", a title and a Create button. Below that are three tabs (Starred / My reports / All reports) with count pills, a search box, and a table card with a sticky header. The All tab has "Load more" paging and shows "Showing X of Y". Each tab has its own empty state, and deleting asks for confirmation first.

The designs use hard-coded Atlassian hex values and Phosphor icons. We will **not** add Phosphor or the Bitovi design-system bundle or CSS. Instead colors map to the existing Tailwind palette (`tailwind.config.js`), icons come from `@atlaskit/icon`, and `ReportTypeIcon` stays as the type icon. `support.js` and `_ds_bundle.js` are only the design tool's preview runtime, so nothing from them is ported.

### Why two phases

The single-release plan added `read:jira-user`, which makes the Forge release a **major** (every site admin approves the upgrade) and leaves web users with old tokens unable to look up names until they sign in again. Only one part of the design needs that scope: **other people's names and avatars**. Everything else, including knowing which reports are _yours_, works with the scopes the app already has:

- **Forge:** `view.getContext().accountId`. No scope, no Jira call.
- **Web:** the 3LO access token is a JWT whose `sub` is the account id (verified 2026-10-14 against a real token). No scope, no Jira call. Atlassian documents the token as opaque, so this is observed behavior, not a contract.

So phase 1 ships the whole design **without any scope change**, as an ordinary (non-major) Forge release. Owner names and avatars move to [phase 2](../phase2/plan.md).

### Targets: web and Forge only

The **web build** (`web.main.ts`) and the **Forge build** (`forge.main.ts`). The Connect plugin build (`plugin.main.ts`, `connect.html`, `index.plugin.ts`) is out of scope: nothing here adds a Connect code path, and it is not part of verification.

### Starting point: this branch already implements both phases

Commit `9cb64900 feature: implement saved reports` on `feature/saved-reports-redesign` implements the old one-release plan, scope included. Phase 1 is that commit **minus the name lookups**, **plus "last updated"**.

**The strip is one commit of its own**, titled `spec/041 phase 1: defer owner names to phase 2`, containing only removals. Phase 2 starts by reverting it (`git revert <that commit>`), which brings back `useUsers`, the sign-in banner and owner search in one step instead of rewriting them.

To remove for phase 1 (each is restored in phase 2):

- `read:jira-user` and its comment in `manifest.yml`; `read:jira-user` in `.env.example` / `.env`.
- `src/react/services/user/useUsers.ts` + `useUsers.test.tsx`, and the `/user/bulk` lookup in `useReportOwners.ts` (keep `effectiveOwnerId` and `canDeleteReport`; see § 4).
- The sign-in banner on Saved Reports, the `onReauthorize` prop, and the web host's `reauthorize` wiring in `web.main.ts` / `ViewReportsWrapper.tsx`.
- The owner's display name in the search haystack (the JQL stays).
- Avatars and "Former user" in the owner cell (see § 6).
- Comments that point at `spec/041-saved-reports-redesign/plan.md`: repoint them to `phase1/plan.md` / `phase2/plan.md` (`grep -rn "spec/041" src`).

**Decisions made:**

- **Owner key:** the Jira `accountId`, never email or name. Email usually isn't returned, can change and can be reused; names change too. The account id is always available, never changes, and is what every Jira user API takes.
- **`ownerId` is set by the client** on both builds, and is **advisory, not a security boundary**. On Forge the reports are a single KVS value written whole through the generic `storage.set` resolver function, and on web they live in a configuration issue or a Reports Space with no server of ours in front. Hiding delete for other people's reports is a UI convenience. For the Reports Space, Jira's issue permissions are what actually govern who can delete.
- **Stars:** Forge KVS on Forge, through new per-user resolver functions (`storage:app` is already granted; adding a resolver function isn't a major). localStorage on web.
- **No personal data reporting.** Stars and `ownerId` store **bare account ids only**, and `updatedAt` is a timestamp. Atlassian does not treat a bare account id as personal data, so the app doesn't implement the personal data reporting API. Sources, checked 2026-10-13:
  - [Does a bare accountId require Personal Data Reporting? (Atlassian Developer Community, Aug 2026)](https://community.developer.atlassian.com/t/does-a-bare-accountid-require-personal-data-reporting-and-must-accountid-references-be-erased-after-account-closure/102147): Atlassian staff (ibuchanan): _"Atlassian does not consider the Account ID alone to be personal data"_. The same thread cites staff saying the same in 2018 and 2022.
  - [Forge user privacy guidelines](https://developer.atlassian.com/platform/forge/user-privacy-guidelines/): don't store user personal data; _"always retrieve current user data at the time of use"_.
  - **Caveat:** a consistent staff stance since 2018, but not written into the docs.
  - **The rule this creates:** never store names, emails, avatars or any other profile field next to an account id (in reports, star values, KVS caches, anywhere).
  - **If Atlassian's stance changes:** move stars to Jira user properties or to localStorage on Forge too, and add a weekly `scheduledTrigger` calling [`reportPersonalData`](https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api) that deletes closed accounts' star keys and clears their `ownerId`.
- **Recents:** unchanged. They stay in localStorage through the existing `useRecentReports`.
- **No feature flag.** The new screens replace the old ones outright, for every user.

## Design → code token map

| Design                                                     | Tailwind                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `#172B4D` text                                             | `text-neutral-800`                                                       |
| `#44546F` secondary text                                   | `text-neutral-801`                                                       |
| `#626F86`, `#8590A2` muted                                 | `text-neutral-300` / `text-neutral-100`                                  |
| `#DCDFE4` borders                                          | `border-neutral-41`                                                      |
| `#F1F2F4` row hover, badge (page bg: keep the app's white) | `bg-neutral-20`                                                          |
| `#091E420F` / `#091E4224` subtle button                    | Atlaskit `Button appearance="subtle"` / default                          |
| `#0C66E4` primary                                          | Atlaskit `Button appearance="primary"`                                   |
| `#E9F2FF` active tab pill                                  | `bg-blue-101`                                                            |
| `#E2B203` filled star                                      | Atlaskit `StarStarredIcon` with `color.icon.accent.yellow`               |
| Card shadow                                                | `shadow-sm rounded-xl bg-white`                                          |
| Heading `--fs-h4` Poppins bold                             | Atlaskit `Heading size="large"` (keep the app's font; don't add Poppins) |

---

## 1. Scopes

None. `manifest.yml` and `VITE_JIRA_SCOPE` stay as they are on `main`. The Forge release is a normal (minor) deploy; no site admin approval is needed.

## 2. Current user id

`src/react/services/user/identity.ts` exports `ReadCurrentAccountId = () => Promise<string | null>`, chosen per host (already implemented):

- **Forge:** `createForgeAccountIdReader(view)` → `view.getContext().accountId`. Bridge calls hang outside a Forge iframe (`shared/reload-app.ts`), so this lives behind the host config, not in shared code.
- **Web:** `createWebAccountIdReader()` decodes the payload of `localStorage.accessToken` and returns `sub`. Payload only, no signature check; it's a hint about who's signed in, and the API still authorizes every request on the real token. Never log the token. Works for every signed-in user, whatever scopes their token has.
- `readNoAccountId` returns `null` (sample data, tests, Storybook).

Injected through the host config in `forge.main.ts` / `web.main.ts` (`createUserServices` → `UserServicesProvider`), so `identity.ts` is testable without `vi.mock`.

`useCurrentAccountId()`: a `useSuspenseQuery` over the reader that only caches a found id for good (`staleTime: (q) => (q.state.data ? Infinity : 0)`).

## 3. `ownerId` and `updatedAt` on reports

`src/jira/reports/fetcher.ts` `Report`:

- `ownerId?: string`: already added. Set by `SaveReports.tsx` `handleCreate` from `currentAccountIdQuery` (so "Copy report" makes the copier the owner), kept on update because `useUpdateReport` merges onto the stored report.
- `creatorId?: string`: already added. Read-only, filled by the Space backend from the work item's `creator` (see § 4), stripped on write.
- **New: `updatedAt?: string`**, an ISO 8601 UTC timestamp (`new Date().toISOString()`) of the last user edit. Reports saved before this release have none. Document that it is client-set, like `ownerId`, so it trusts the writer's clock.

Setting `updatedAt`:

- **Create** (`useCreateReport` / `handleCreate`): set it to now, so a new report has one.
- **Update** (`useUpdateReport`, `src/react/services/reports/useSaveReports.tsx`): set it in the one place every update goes through, `const newReport = { ...allReports[id], ...updates, updatedAt: now }`, so renames (`EditableTitle`), saved settings (`useSelectedReport`) and report-of-reports section edits all bump it. Don't make callers pass it.
- **Migrations and their write-back** (`useAllReports` → `migrations/persist.ts`): **don't** touch it. A migration rewriting stored params isn't a user edit, and bumping it would make every migrated report look edited at once.

Fallback when a report has no `updatedAt`:

- **Reports Space:** request the work item's `updated` field alongside `summary`, `description`, `creator` (`read:jira-work`) and fill a read-only `updatedAt` from it, the same way `creatorId` is filled. A stored `updatedAt` always wins. Caveat: a migration write-back edits the work item, so for an old report with no stored `updatedAt`, `updated` can be the migration's time. That's acceptable for a fallback.
- **Legacy backend** (KVS on Forge, configuration issue on web): no per-report timestamp exists, so the cell shows "—".

Both backends keep unknown fields (verified): `legacy.ts` stores the whole map, `space.ts` writes `JSON.stringify(report)` and `parseReport` spreads it back. Migrations spread `...report`. The only backend change is the Space backend's `updated` fallback.

## 4. Owners without names

No user lookups in phase 1. Everything owner-related works from ids alone:

- `effectiveOwnerId(report) = report.ownerId || report.creatorId`. The Space `creator` fallback only needs `read:jira-work`, so it stays in phase 1, and old Space reports you created still count as yours. Reports moved into a Space by a migration have the migrator as creator, which is why a stored `ownerId` always wins.
- **Mine:** `effectiveOwnerId(report) === currentAccountId`.
- **Delete is offered** when the report is mine or has no `ownerId` (`canDeleteReport`). "Former user" can't be detected without `/user/bulk` (it needs `active`), so it's phase 2.

## 5. Stars

Already implemented; unchanged from the one-release plan.

### Forge: KVS, per user

- `src/forge-resolver/contract.ts`: `STARS_GET = 'stars.get'`, `STARS_SET = 'stars.set'`.
- `src/forge-resolver/index.ts`: the key is **`starred-reports:${context.accountId}`**, built from the resolver's `context`, **never** the payload. `stars.set` validates a `string[]` capped at 1000. One key per user, not a shared map (a shared map is a read-modify-write race between users and grows without bound).
- Limits (verified 2026-10-13 against [KVS limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/)): keys match `^(?!\s+$)[a-zA-Z0-9:._\s-#]+$` and ≤500 chars (account ids give ~75); values ≤240 KiB (1000 UUIDs ≈ 39 KB); 4000 writes/min/installation. The resolver checks the key against the regex and throws if it doesn't match.

### Web: localStorage

Key `${JIRA_APP_KEY ?? scopeId}-starred-reports-${accountId}`, falling back to no suffix with no id. Stars are per browser, like recents.

### Shared hook

`StarsStore` (`read`/`write`) with `createForgeStarsStore` and `createLocalStarsStore`, injected through the host config. `useStarredReports()` returns `{ starredIds, isLoaded, toggleStar, removeStar }` with an optimistic mutation and `@atlaskit/flag` toasts. Ids of deleted reports stay in the list but are never shown, because every view intersects with `useAllReports`.

## 6. ReportTableRow

Already implemented (`ReportTableRow.tsx`, `ReportTableHeader.tsx`, `sample-reports.ts`, stories, tests). Phase 1 changes:

- **Grid:** add a "Last updated" column between owner and type: `grid-cols-[40px_minmax(0,1fr)_120px_120px_140px_40px]` (star, name, owner, last updated, type, delete). Header and rows still share `REPORT_TABLE_GRID`.
- **Last updated cell:** a relative time ("3 days ago", "just now") through `Intl.RelativeTimeFormat` (no date library; nothing in `src` does relative time yet, so add a small `formatRelativeTime(iso, now)` helper with its own tests). Show the full local date and time in a `title` / `Tooltip`, and render a `<time dateTime={iso}>`. "—" when there is no `updatedAt`. In `compact` rows (home) keep the column; it's the most useful thing on "Pick up where you left off".
- **Owner cell, phase 1:** no avatars and no names.
  - Mine → "You", with a neutral person icon.
  - Someone else's (`effectiveOwnerId` set and not mine) → "Someone else", muted.
  - No owner → "—", muted.
  - Drop the `displayName` / `avatarUrl` / `active` fields from the `owner` prop for now (or leave them optional and unused); remove the "Former user" and avatar/initials stories and tests, which come back in phase 2.
- Unchanged: only the name is the `Link`; star and delete are siblings; delete shows on hover/focus and renders when `onDelete` is passed; `role="table"`/`"row"`/`"cell"`; star labeled "Star {name}" / "Unstar {name}", delete "Delete {name}".
- Stories: add "last updated just now / days ago / none", replace the owner stories with mine / someone else / no owner.

## 7. Home ("No Report") page

Already implemented (`ReportHome.tsx`, `ReportHomeContainer.tsx`, stories, tests; `ReportArea`'s `home` slot; `NoJqlMessage` deleted; controls row hidden on home). Phase 1 change: the rows pick up the "Last updated" column and the phase 1 owner cell. Home never looked up names, so nothing else changes.

As built: heading "Pick up where you left off"; "Sources" link opens the Sources panel; "RECENTLY OPENED" with "All saved reports →"; up to 5 compact recents; "Create new report" (opens Sources) and "Create Report of Reports" (sets `primaryReportType = 'report-of-reports'`). If saved reports fail to load, the fallback is the no-recents home.

**Home is the landing page, not "any report with no JQL".** Found in testing: Create Report of Reports, then switching the type to Gantt, dropped the user back on home with the controls hidden and no way forward. Fix:

- `TimelineReport` keeps a session flag, `startedReport` (React state, not URL state). Both Create buttons set it, and a link with `primaryReportType` in the URL starts with it set. An open saved report (`report` in the URL) also counts, derived from the URL on every navigation (`hasStartedReport`): its type comes from the saved record, so a saved Report of Reports switched to Gantt would otherwise fall back to home. URL state alone can't do this, because `updateUrlParam` drops a param that equals its default, so a Gantt with no JQL has the same URL as a first visit.
- With no JQL: home when `!startedReport`; otherwise `ChooseSourcesMessage` ("Gantt Chart needs work items", **Choose sources**, **← Back to home**) with the controls row visible. It's a `setup` slot on `ReportArea`, next to `home`.
- **Back to home** clears the flag and resets `primaryReportType` to the default. A reload also lands on home.
- **Home in the sidebar**, above Report Settings: a `Link` to `?` (the bare app URL, through the host's link handling, so it works on web and Forge and can open in a new tab). Its click clears the flag and closes any settings panel. When the URL holds unsaved work (`hasUnsavedReport`: a saved report with any param besides `report`, or a new report with anything beyond its type), it asks first: **Leave this report?** with Stay / Leave. Opening another report from home or Saved Reports still doesn't ask; one shared leave guard for every navigation is follow-up work. No feature toggle: it's the only way back to home once a report is open.

## 8. Saved Reports page

Already implemented (`ViewReports.tsx`, `ViewReportsLayout` `actions` slot, `ViewReport.test.tsx`). Phase 1 changes:

- **Remove the sign-in banner** and the `onReauthorize` prop. Phase 1 has no 401/403 case to recover from.
- **Search:** `extraHaystack` keeps the JQL; drop the owner's display name. Placeholder becomes "Search by name or JQL". (Phase 2 adds owner back.)
- **Sort:** every tab by last updated (`lastUpdatedAt`), most recent first; reports with no timestamp go last, by name. Search filters this order without reordering it.
- **My reports** uses `effectiveOwnerId` (§ 4), so old Space reports you created show there too.
- **Delete** is offered per `canDeleteReport` (mine or no `ownerId`).

Unchanged: Starred / My reports / All tabs with count pills, default tab decided once on mount; "Load more" paging on All with "Showing X of Y"; four empty states; delete through `DeleteReportModal` removes the report from recents and stars.

## Critical files

- New in phase 1 (beyond `9cb64900`): `src/utils/date/format-relative-time.ts` (+ test), or wherever the existing date utils live.
- Modified: `manifest.yml`, `.env.example` (revert the scope), `jira/reports/fetcher.ts` (`updatedAt`), `jira/reports/backend/space.ts` (`updated` fallback), `services/reports/useSaveReports.tsx` (stamp `updatedAt`), `SaveReports/SaveReports.tsx` (stamp on create), `services/user/useReportOwners.ts` (no lookups), `ReportListing/ReportTableRow.tsx` / `ReportTableHeader.tsx` / stories / tests, `ViewReports/ViewReports.tsx` + `ViewReportsWrapper.tsx` + `ViewReport.test.tsx`, `web.main.ts` (drop `reauthorize`).
- Removed: `services/user/useUsers.ts` + test.
- Not touched: `plugin.main.ts`, `index.plugin.ts`, `connect.html`.

## Verification

- **Unit tests (vitest):**
  - `useUpdateReport` stamps `updatedAt`; `handleCreate` stamps it; the migration write-back does not.
  - Space backend: `updatedAt` falls back to the work item's `updated`; a stored `updatedAt` wins; the fallback is stripped on write (like `creatorId`).
  - `formatRelativeTime`: just now, minutes, hours, days, months; a future timestamp (clock skew) reads "just now".
  - `ReportTableRow`: last updated cell (relative text, `dateTime`, "—"); owner cell (You / Someone else / —).
  - `ViewReports`: My reports includes a Space report whose `creatorId` is mine; search by JQL; no banner anywhere.
  - Existing tests for resolver stars, identity, `useStarredReports`, `ReportArea`, `ReportHome`, `describeReport` still pass.
- **Grep check:** no `read:jira-user`, no `user/bulk`, no `/myself` in `src`, `manifest.yml` or `.env.example`.
- **Storybook:** `npm run build:css` first, then check the stories against the design screenshots.
- **Manually, web build** (`launch-dev` agent), with your **existing** token (no re-sign-in needed):
  1. With no URL params, home shows recents with "Last updated", and the controls row is hidden.
  2. "Create report of reports" opens that report type.
  3. Star from home, reload, and the star is still there.
  4. "All saved reports" opens the page. Tabs, search, and Load more work. Your reports say "You".
  5. Create a report: the saved JSON has `ownerId` = your account id and `updatedAt`. Rename it: `updatedAt` changes, `ownerId` doesn't.
- **Manually, Forge**: the user deploys and upgrades `prodcheck` (hand them `forge deploy -e prodcheck` / `forge install --upgrade -e prodcheck`). The upgrade must **not** ask for new permissions. Then repeat 1–5, star in one browser and see it in another, and check a second account sees its own stars and "Someone else" on your reports.
- `npm run typecheck`, Prettier, and `npm test`.
