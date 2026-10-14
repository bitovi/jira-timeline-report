# Plan: Home ("No Report") page, redesigned ReportRow, and a new Saved Reports page

## Context

The design project (claude.ai/design `70b49610…`) has three screens:

- **Home – No Report**: what you see with no report open. It says "Pick up where you left off", lists the recently opened reports in a table card with an "All saved reports →" link, and has a primary "Create new report" button. It replaces today's one-line `NoJqlMessage` ("Configure a JQL in the sidebar…").
- **ReportRow**: one table row. The columns are a star toggle, type icon + name + JQL line, owner (avatar with initials, "You" when it's yours), a type badge, and a delete button that appears on hover and only for your own reports. It has a `compact` density and an optional JQL line.
- **Saved Reports**: a full page with "Back to report", a title and a Create button. Below that are three tabs (Starred / My reports / All reports) with count pills, a search box, and a table card with a sticky header. The All tab has "Load more" paging and shows "Showing X of Y". Each tab has its own empty state, and deleting asks for confirmation first.

The designs use hard-coded Atlassian hex values and Phosphor icons. We will **not** add Phosphor or the Bitovi design-system bundle or CSS. Instead:

- colors map to the existing Tailwind palette (`tailwind.config.js`);
- icons come from `@atlaskit/icon`;
- `ReportTypeIcon` stays as the type icon (it already has per-type tones).

`support.js` and `_ds_bundle.js` are only the design tool's preview runtime and bundle, so nothing from them is ported.

### Targets: web and Forge only

The Connect → Forge move has shipped. This plan targets the **web build** (`web.main.ts`) and the **Forge build** (`forge.main.ts`) only. The Connect plugin build (`plugin.main.ts`, `connect.html`, `index.plugin.ts`) is out of scope: nothing here adds a Connect code path, and it is not part of verification. If something breaks only under Connect, it doesn't block this work.

### One release, and it is a major

An earlier draft split this into two phases to keep `read:jira-user` out of the Connect → Forge release. That reason is gone, so the whole design ships in **one release**, owners included.

That release adds the `read:jira-user` scope, which every API that turns an account id into a name (`/myself`, `/user`, `/user/bulk`) needs:

- **Forge:** adding a scope to `manifest.yml` is a **major version**, and every site admin has to approve the upgrade. Until a site approves it, that site keeps running the previous major, so nobody sees a half-working owner column. Plan the deploy and the release notes as a major.
- **Web:** add `read:jira-user` to `VITE_JIRA_SCOPE` (`.env`, `.env.example`, and the deployed environment). Only **new** authorizations get the scope. A user who is already signed in keeps refreshing a token with the old scopes (`refreshAccessToken` in `jira-oidc-helpers/auth.ts` never asks for scopes again), so `/user/bulk` fails for them until they sign in again. Name lookups must therefore degrade quietly (see 4); never block the page on them.

**Decisions made:**

- **Owner key:** the Jira `accountId`, never email or name. Email usually isn't returned (profile visibility), can change, and can be reused; names change too. The account id is always available and never changes, and it is what every Jira user API takes. Names are always looked up when the page renders, never stored.
- **`ownerId` is set by the client** on both builds, and is **advisory, not a security boundary**. On Forge the reports are a single KVS value written whole through the generic `storage.set` resolver function (`legacy.ts` → `createForgeKvsStorage`), and on web they live in a configuration issue or a Reports Space with no server of ours in front. So there's no place to stamp or enforce an owner without a dedicated reports API, which is out of scope. Hiding delete for other people's reports is a UI convenience. For the Reports Space, Jira's issue permissions are what actually govern who can delete.
- **Stars:** Forge KVS on Forge, through new per-user resolver functions. localStorage on web.
- **No personal data reporting.** Stars (`starred-reports:{accountId}` → report UUIDs) and `ownerId` store **bare account ids only**. Atlassian does not treat a bare account id as personal data, so the app doesn't implement the personal data reporting API, and the Marketplace privacy answer stays "no". Sources, checked 2026-10-13:
  - [Does a bare accountId require Personal Data Reporting? (Atlassian Developer Community, Aug 2026)](https://community.developer.atlassian.com/t/does-a-bare-accountid-require-personal-data-reporting-and-must-accountid-references-be-erased-after-account-closure/102147) quotes Atlassian staff (ibuchanan): _"Atlassian does not consider the Account ID alone to be personal data"_, and says apps storing only account ids should answer "no" to personal data reporting. The same thread cites Atlassian staff saying the same in 2018 (epehrson: switching to account ids means _"you will not be storing any personal data"_) and in 2022 (AdamSlaski: accountId is _"a personal-data-free replacement for the username"_).
  - [Forge user privacy guidelines](https://developer.atlassian.com/platform/forge/user-privacy-guidelines/) recommend not storing user personal data and instead to _"always retrieve current user data at the time of use using Atlassian APIs"_. That is what §4 does.
  - **Caveat:** this is a stance Atlassian staff have held consistently since 2018, but it isn't written into the docs. The thread's author asked Atlassian to reconfirm it and had no answer as of Aug 2026.
  - **The rule this creates:** never store names, emails, avatars or any other profile field next to an account id (in reports, star values, caches in KVS, anywhere). Doing so would make it personal data and require reporting.
  - **If Atlassian's stance changes:** move stars to Jira user properties, which go away with the account (needs user-property scopes, so another major), or to localStorage on Forge too. Add a weekly `scheduledTrigger` that calls [`reportPersonalData`](https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api) and, for closed accounts, deletes their star key and clears their `ownerId`.
- **Recents:** unchanged. They stay in localStorage through the existing `useRecentReports`.
- **No feature flag.** The new screens replace the old ones outright, for every user.

## Design → code token map

| Design                                  | Tailwind                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `#172B4D` text                          | `text-neutral-800`                                                       |
| `#44546F` secondary text                | `text-neutral-801`                                                       |
| `#626F86`, `#8590A2` muted              | `text-neutral-300` / `text-neutral-100`                                  |
| `#DCDFE4` borders                       | `border-neutral-41`                                                      |
| `#F1F2F4` page bg, row hover, badge     | `bg-neutral-20`                                                          |
| `#091E420F` / `#091E4224` subtle button | Atlaskit `Button appearance="subtle"` / default                          |
| `#0C66E4` primary                       | Atlaskit `Button appearance="primary"`                                   |
| `#E9F2FF` active tab pill               | `bg-blue-101`                                                            |
| `#E2B203` filled star                   | Atlaskit `StarStarredIcon` with `color.icon.accent.yellow`               |
| Card shadow                             | `shadow-sm rounded-xl bg-white`                                          |
| Heading `--fs-h4` Poppins bold          | Atlaskit `Heading size="large"` (keep the app's font; don't add Poppins) |

---

## 1. Scopes

- `manifest.yml` `permissions.scopes`: add `read:jira-user`, with a comment saying what it is for (owner names through `/rest/api/3/user/bulk`) and that adding it made this release a major.
- `.env.example` (and `.env`): `VITE_JIRA_SCOPE="read:jira-work write:jira-work read:jira-user offline_access"`. Flag the deployed-environment change in the PR description.
- The OAuth app in the Atlassian developer console must also have `read:jira-user` enabled for the web client id. Without it, the authorize redirect fails. Add it to the PR checklist.
- Forge commands (`forge deploy`, `forge install --upgrade`) are run by the user. List them in the PR; don't run them.

## 2. Current user id

`src/react/services/user/identity.ts` exports `readCurrentAccountId(): Promise<string | null>`, chosen per host:

- **Forge:** `view.getContext()` from `@forge/bridge` → `accountId`. Needs no scope and makes no Jira call. `forge.main.ts` already calls `view.getContext()` for licensing; reuse that pattern, and remember `shared/reload-app.ts`'s warning that bridge calls hang outside a Forge iframe.
- **Web:** decode the payload of `localStorage.accessToken` (Atlassian 3LO access tokens are JWTs) and return its `sub` claim. Read the payload only, with no signature check; it's only a hint about who's signed in, and the API still authorizes every request on the real token. Never log the token. This works for users who signed in before the scope change, so `ownerId` and "My reports" work for them right away. `/myself` would not.
- Returns `null` when neither is available (sample data, tests).

Inject the host-specific reader through the host config in `forge.main.ts` / `web.main.ts` (next to `createStorage`) rather than branching on the host inside the module. That keeps `identity.ts` testable without `vi.mock`.

`useCurrentAccountId()` in `src/react/services/user/`: a `useSuspenseQuery` over the reader. Only cache a found id for good (`staleTime: (q) => (q.state.data ? Infinity : 0)`), so one miss isn't cached for the whole session.

## 3. `ownerId` on reports

- `src/jira/reports/fetcher.ts`: add optional `ownerId?: string` to `Report`. Document that reports saved before this release have none, and that the value is advisory (see Decisions).
- `src/react/SaveReports/SaveReports.tsx` `handleCreate`: `await queryClient.fetchQuery(...)` the account id and spread `ownerId` in when there is one. "Copy report" goes through here too, so a copy is owned by whoever copied it.
- On update, keep the stored `ownerId`. Check that the update path in `useSaveReports` merges onto the stored report rather than replacing it from form state.
- Both backends keep unknown fields (verified): `legacy.ts` stores the whole map, `space.ts` writes `JSON.stringify(report)` and its `parseReport` spreads the payload back. Migrations spread `...report`. No backend changes.

## 4. Names

- `src/react/services/user/useUsers.ts`: `useUsers(accountIds)` calls `GET /rest/api/3/user/bulk?accountId=…&maxResults=200` in batches of up to 200, through the existing request helper (`requestJira` on Forge, the hosted helper on web). It is **non-suspending** (names are decoration), caches per id, and returns `{ displayName, avatarUrl, active }` by id. Use `displayName`, `avatarUrls['24x24']`, `active` and `accountType`; `emailAddress`, `timeZone` and `locale` depend on each user's privacy settings, so don't rely on them.
- **On a 401/403** (a web user still on a token without `read:jira-user`): return no names, don't retry, and return `needsReauth: true`. Rows then show "You" for your own reports and a neutral "Unknown" for everyone else. The Saved Reports page turns `needsReauth` into a sign-in banner (see 8).
- `active: false` → "Former user". Delete stays available on reports whose owner is a former user (see 6).
- **Fallback for reports with no `ownerId`:**
  - Reports Space backend: use the work item's **`creator`** (not `reporter`, which anyone with edit permission can change), readable with `read:jira-work`. Reports moved into a Space by a migration have the migrator as creator, so only use the creator when there's no `ownerId` at all.
  - Legacy backend (KVS on Forge, configuration issue on web): no per-report creator exists, so reports with no `ownerId` show "Unknown".

## 5. Stars

### Forge: KVS, per user

- `src/forge-resolver/contract.ts`: add `STARS_GET = 'stars.get'` and `STARS_SET = 'stars.set'`.
- `src/forge-resolver/index.ts`: define both. The key is **`starred-reports:${context.accountId}`**, built from the resolver's `context`, **never** from the payload; otherwise anyone could read or write anyone's stars. `stars.set` validates that the payload is a `string[]` (cap the length, e.g. 1000) before writing. Update the file's "deliberately thin" doc comment to name the second reason the resolver exists.
- One key per user, not a shared `Map<userId, ids[]>`. A shared map is a read-modify-write race between users (one user's star silently erases another's, the same class of bug `index.web.ts`'s `enqueue` comment describes). It grows without bound against KVS's per-value limit, and it makes deleting one user's data an edit to a shared blob.
- Needs only `storage:app`, which is already granted, and adding a resolver function isn't itself a major.
- **Limits (verified 2026-10-13 against [KVS and Custom Entity Store limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/)):**
  - Keys must match `^(?!\s+$)[a-zA-Z0-9:._\s-#]+$` and be at most 500 characters. Account ids (`557058:f58131cb-…` or `5b10ac8d82e05b22cc7d4ef5`) use only letters, digits, `:` and `-`, so the key is about 75 characters at most.
  - A value can be at most 240 KiB. Report ids are UUIDs (`randomUUID` in `SaveReports.tsx`), so the 1000-id cap is about 39 KB of JSON.
  - Writes are limited to 4000 per minute per installation and 1 MB/s per key, which one small write per star click never comes near.
  - The resolver checks the built key against that regex before reading or writing, and throws if it doesn't match. Account ids always pass; this only guards against an id format we haven't seen.

### Web: localStorage

- Key: `${JIRA_APP_KEY ?? scopeId}-starred-reports-${accountId}` (mirrors `useRecentReports.getReportKey`). With no id, fall back to the key without the suffix. Stars are per browser, the same trade-off recents already make.

### Shared hook

- A `StarsStore` interface (`read(): Promise<string[]>`, `write(ids: string[]): Promise<void>`), with `createForgeStarsStore` (over `invoke`) and `createLocalStarsStore`, injected through the host config like `createStorage`.
- `src/react/services/reports/useStarredReports.ts` returns `{ starredIds: Set<string>, toggleStar(id), removeStar(id) }`: a React Query query over `read`, plus an optimistic mutation over `write`.
- Value: `string[]` of saved-report ids. Ids of reports that no longer exist stay in the list but are never shown, because every view intersects the list with `useAllReports`.
- Star / unstar toasts through the existing `@atlaskit/flag` `FlagsProvider`.

## 6. ReportTableRow

- Leave `src/react/components/ReportListing/ReportRow.tsx` alone, because the Add Report modal uses it as a picker. Add `ReportTableRow.tsx` and `ReportTableHeader.tsx` in the same folder. They share one exported grid constant so the header can't drift out of line with the rows: `grid-cols-[40px_minmax(0,1fr)_160px_140px_40px] gap-3 px-4` (star, name, owner, type, delete).
- Props: `described: DescribedReport`, `owner?: { accountId: string; displayName?: string; avatarUrl?: string; active?: boolean }`, `isMine`, `isStarred`, `onToggleStar`, `href` (a routing `Link`), `onDelete?`, `compact?`, `showJql?` (default true), `query?`, `isActive?`, `onMouseEnter?`.
- Owner cell: the 24×24 avatar when there is one, otherwise a circle with initials from the name. "You" when `isMine`, "Former user" when inactive, "Unknown" with no owner or no name.
- Reuse `ReportTypeIcon`, `HighlightedText` and `describeReport`.
- Only the name is the `Link`. The star and delete buttons are its siblings, not its children, so no interactive element is nested inside another and clicking them never opens the report.
- Delete shows on hover or focus (`opacity-0 group-hover:opacity-100 focus-within:opacity-100`) and renders whenever `onDelete` is passed. The page passes it when `isMine || !ownerId || owner is inactive`.
- Accessibility: the rows use `role="row"`/`"cell"` inside a `role="table"`. The star is an `IconButton` labeled "Star {name}" / "Unstar {name}", and delete is labeled "Delete {name}". The filled star is a small wrapper component around `StarStarredIcon`, because `IconButton` takes a component, not an element.
- Stories: `ReportTableRow.stories.tsx` covering a plain row, starred, mine, someone else's, unknown owner, former user, compact, no JQL, and every report type. Move `SAMPLE_REPORTS` out of `ReportRow.stories.tsx` into a shared `ReportListing/sample-reports.ts` fixture so both story files use it.

## 7. Home ("No Report") page

- `src/react/ReportHome/ReportHome.tsx`, presentational. Takes `recentReports`, `owners`, `currentAccountId`, `starredIds`, `onToggleStar`, `onViewAllReports`, `onCreateReport`, `onCreateReportOfReports`, `onOpenSources`.
- Layout:
  - a centered `max-w-[960px]` column with `py-16`;
  - heading "Pick up where you left off", and a subtitle whose "Sources" is a `LinkButton` that opens the Sources panel (`routeData.showSettings = 'SOURCES'`, as `SettingsSidebar`'s `changeSettings` does);
  - a "RECENTLY OPENED" label with "All saved reports →", which sets `showSettings = 'REPORTS'` like `onViewReportsButtonClicked` in `TimelineReport.tsx`;
  - a table card of up to 5 recents (compact rows), from `useRecentReports` + `useAllReports`, dropping ids that no longer exist;
  - a "Create new report" primary button and a "Create report of reports" secondary button.
- No recents: the same heading, a copy variant pointing to Sources / Create, and a plain "All saved reports" button. Both create buttons stay.
- **Create new report:** opens the Sources panel. Nothing can be saved without a JQL; once there is one, the existing Create flow in `SaveReports.tsx` takes over. Don't build a new creation flow.
- **Create report of reports:** sets `routeData.primaryReportType = 'report-of-reports'`. That type is in `SELF_MANAGED_REPORT_TYPES` (`TimelineReport.tsx:42`), so home's condition is no longer true and the report area renders it directly. This is the way in to the one report type that needs no JQL, since home hides the controls row that holds the Report type picker.
- `ReportHomeContainer.tsx` mounts its own providers (Storage, Routing, Flags, QueryClient, Jira) plus `ErrorBoundary` and `Suspense`, because it renders inside the report area, which has none. If saved reports fail to load, the fallback is the no-recents home, so the user can still start a report. Add `ReportHome.stories.tsx` (with and without recents).
- `src/react/TimelineReport/components/ReportArea.tsx`: add a `home?: ReactNode` **slot** and render it in the no-JQL branch (`!jql && isLoggedIn && !selfManagesData`) instead of `NoJqlMessage`. `TimelineReport` passes `<ReportHomeContainer storage linkBuilder />`. A slot keeps `ReportArea` pure, so its view-state tests don't need Jira or storage. They pass a stub and assert it renders, plus a new case: no home for a logged-out (sample data) session.
- Delete `NoJqlMessage` and its story from `ReportMessages.tsx` / `ReportMessages.stories.tsx`.
- **Hide the report controls row on home.** In `TimelineReport.tsx`, compute `showingHome` (same condition as `ReportArea`'s home branch, plus no unsupported report type) and give `#report-controls` `hidden` instead of `flex`. Hide it with CSS rather than unmounting, so the controls keep their state.
- The design's header and sidebar are already the app shell, so nothing to build there.

## 8. Saved Reports page

- Replace the body of `src/react/ViewReports/ViewReports.tsx`, keeping the component name so the wrapper keeps working. It keeps using `ViewReportsLayout` for the back link. Give the layout an `actions` slot on the title row for a "Create new report" button, which defaults to opening Sources as on home (injectable via an `onCreateReportClicked` prop for tests).
- **Tabs:** **Starred / My reports / All reports**, each with a count pill. My reports is `ownerId === currentAccountId`. Default to Starred when any existing report is starred, otherwise All. Decide this once on mount, so unstarring your last report doesn't switch tabs mid-click. Hand-rolled underline tabs (`role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`) match the design better than `@atlaskit/tabs`.
- **Search:** reuse `useReportSearch`. Add an optional `extraHaystack` option to `filterReports`/`matchesQuery`, which this page uses to add the JQL and the owner's display name (when it's loaded). Placeholder: "Search by name, JQL, or owner". The Add Report modal passes nothing and keeps searching name and type only. Keep the arrow-key navigation; ↵ opens the active row's link.
- **Table:** a card with a sticky `ReportTableHeader` and a scrolling body of `ReportTableRow`s, sorted by name. One `useUsers` call for every distinct `ownerId` across all reports (plus Space creators for reports with no `ownerId`).
- **Sign-in banner (web only):** when `useUsers` reports `needsReauth`, show a dismissible Atlaskit `SectionMessage` above the table: _"Sign in again to see who owns each report"_, with a **Sign in** button.
  - The button calls the existing `fetchAuthorizationCode(config)()` (`jira-oidc-helpers/auth.ts:8`). That function sends the user to Atlassian's consent screen with the current `VITE_JIRA_SCOPE` and returns them to the same page through `state`.
  - Inject it as an optional `onReauthorize` prop on the page, passed only by the web host. Forge passes nothing, so the banner never renders there; the manifest grants the scope, so a 401/403 on Forge is a real error, not an old token.
  - Dismissing it hides it until the next page load (component state, not storage). The banner stops for good once the user signs in again, because `needsReauth` stays false from then on.
  - Don't show it on home. Owner names don't appear there.
- **Paging:** only the All tab pages. Batch size is `ceil(panelHeight / rowHeight) + 1`, with a minimum of 6. Measure the flex-filled tab panel, not the table; the table is only as tall as the rows already in it. "Load more" adds one batch, with "Showing X of Y" next to it. Changing tab or query resets the page and the scroll.
- **Empty states**, each with an icon, title and body: no saved reports at all ("No saved reports yet" / "Save a report and it will show up here."), empty Starred ("No starred reports yet"), empty My reports ("You have not saved any reports"), and no search matches (`No reports match "{query}"`).
- **Delete:** reuse `DeleteReportModal` and `useDeleteReport`, with the row's trash button replacing the old "…" dropdown. On success, remove the report from recents (`removeFromRecentReports`) and from stars (`removeStar`).
- Update `ViewReport.test.tsx` to the new markup.

## Critical files

- New: `ReportListing/ReportTableRow.tsx`, `ReportListing/ReportTableHeader.tsx`, `ReportListing/sample-reports.ts`, `ReportHome/*`, `services/reports/useStarredReports.ts`, `services/reports/stars-store.ts`, `services/user/*` (`identity.ts`, `useCurrentAccountId.ts`, `useUsers.ts`)
- Modified: `manifest.yml`, `.env.example`, `forge.main.ts`, `web.main.ts`, `shared/main-helper.js` (host config: identity reader + stars store), `forge-resolver/contract.ts`, `forge-resolver/index.ts`, `jira/reports/fetcher.ts`, `SaveReports/SaveReports.tsx`, `TimelineReport/TimelineReport.tsx`, `TimelineReport/components/ReportArea.tsx`, `TimelineReport/components/ReportMessages.tsx`, `ViewReports/ViewReports.tsx`, `ViewReports/components/ViewReportsLayout`, `ReportListing/useReportSearch.ts` / `report-search.ts`, `ReportListing/ReportRow.stories.tsx`
- Not touched: `plugin.main.ts`, `index.plugin.ts`, `connect.html`, and anything else that only Connect uses.

## Verification

- **Unit tests (vitest):**
  - `forge-resolver`: `stars.get`/`stars.set` build the key from `context.accountId` and ignore any key in the payload; `stars.set` rejects anything that isn't a string array.
  - `identity`: `sub` from a JWT; `null` for a missing or non-JWT token; the Forge reader returns `getContext().accountId`.
  - `useUsers`: batching at 200; a 401/403 gives no names, no retry, and `needsReauth: true`; `active: false` comes through.
  - Sign-in banner: shown when `needsReauth` and `onReauthorize` are both present; hidden when no `onReauthorize` is passed (Forge); the button calls `onReauthorize`; dismissing hides it.
  - `useStarredReports`: toggle and remove against both stores; per-account localStorage keys.
  - `ReportTableRow`: star and delete clicks don't trigger the link; labels; JQL line hidden on request; the owner cell's states (You / name / Former user / Unknown).
  - `ViewReports`: tab counts and the default tab; the My reports filter; search by JQL and by owner; load-more paging; each empty state; delete only offered on mine / unowned / former-user reports; delete removes the report from stars and recents.
  - `ReportArea`: the home slot renders with no JQL, and not when logged out.
  - `ReportHome`: "Create report of reports" sets `primaryReportType`.
  - `describeReport`, still passing with `ownerId`.
- **Storybook:** run `npm run build:css` first, then check the new stories against the design screenshots.
- **Manually, web build** (using the `launch-dev` agent), signed in again so the token has `read:jira-user`:
  1. With no URL params, the home page shows recents and the report controls row is hidden.
  2. "Create report of reports" opens that report type.
  3. Star from home, reload, and the star is still there.
  4. "All saved reports" opens the page. Tabs, search (including by owner), and Load more all work.
  5. Create a report and confirm the saved JSON has `ownerId` matching your account id.
  6. With a token issued **before** the scope change, the page still loads: you see "You" on your reports and "Unknown" on others, with no error. The sign-in banner shows; "Sign in" goes through Atlassian's consent screen (listing the new permission) and lands back on Saved Reports, now with names and no banner.
- **Manually, Forge**: the user deploys and upgrades `prodcheck` (hand them the `forge deploy -e prodcheck` / `forge install --upgrade -e prodcheck` commands) and approves the new scope. Then:
  1. Repeat checks 1–5 above.
  2. Star in one browser, and the star shows in another.
  3. A second account sees its own stars, not yours, and sees your name on your reports.
- `npm run typecheck`, Prettier, and `npm test`.
