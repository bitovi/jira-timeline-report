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

### Why two phases

Everything in the owner column needs to know other people's names. On the web build and on Forge, every API that turns an account id into a name (`/myself`, `/user`, `/user/bulk`) needs the `read:jira-user` scope. Adding a scope to the Forge manifest is a **major version**: every site admin has to approve the upgrade. That must not happen in the middle of the Connect → Forge release.

The signed-in user's **account id**, on the other hand, is available with no new scope in every build. So:

- **Phase 1** ships the new layout and pages now, using only what needs no new scope: the new screens, stars, and silently recording `ownerId` on new reports.
- **Phase 2** comes after Forge ships, as a planned major that adds `read:jira-user`. It turns on everything that needs names: the Owner column, the "My reports" tab, and owner-only delete. It also moves stars to Forge KVS.

Recording `ownerId` in phase 1 (without showing it) means reports created between the phases already have an owner when phase 2 turns the column on. Atlassian account ids are global, so ids recorded now stay valid on Forge.

**Decisions made:**

- **Owner key:** the Jira `accountId`, never email or name. Email usually isn't returned (profile visibility), can change, and can be reused; names change too. The account id is always available and never changes, and it is what every Jira user API takes. Names are always looked up when the page renders, never stored.
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

## Phase 1 — layout and pages (ships now, no scope change)

Targets today's builds (web and Connect). No change to `VITE_JIRA_SCOPE`, `base-connect.json` or any Forge manifest.

### 1.1 Current user id (no API call)

- Add `src/react/services/user/identity.ts` with one function, `readCurrentAccountId(): Promise<string | null>`:
  - **Web:** decode the payload of the OAuth access token in `localStorage.accessToken` (Atlassian 3LO access tokens are JWTs) and return its `sub` claim, the Atlassian account id. Read the payload only, with no signature check; it is only a hint about who's signed in, and the API still authorizes every request on the real token. Never log the token.
  - **Connect:** `AP.user.getCurrentUser(cb)` → `atlassianAccountId`, with a short timeout so the create flow can't hang.
  - Returns `null` when neither is available (sample data, tests).
- Add `useCurrentAccountId()` in `src/react/services/user/`: a `useSuspenseQuery` over `readCurrentAccountId`. Only cache a found id for good (`staleTime: (q) => (q.state.data ? Infinity : 0)`), so one miss isn't cached for the whole session.
- **Do not call `/myself`.** It needs `read:jira-user` on the web build, so it would only 401.

### 1.2 Record `ownerId` (not shown)

- `src/jira/reports/fetcher.ts`: add optional `ownerId?: string` to `Report`. Document that reports saved before it exists have none.
- `src/react/SaveReports/SaveReports.tsx` `handleCreate`: `await queryClient.fetchQuery(...)` the account id and spread `ownerId` in when there is one. "Copy report" goes through here too, so a copy is owned by whoever copied it.
- `SaveReportsWrapper.tsx` needs nothing extra; the id doesn't go through Jira helpers.
- Both backends keep unknown fields (verified): `legacy.ts` stores the whole map, `space.ts` writes `JSON.stringify(report)` and its `parseReport` spreads the payload back. Migrations spread `...report`. No backend changes.
- Nothing reads `ownerId` in phase 1. Delete stays open to everyone, as today.

### 1.3 Stars (localStorage)

There's no scope-free server store before Forge: Jira user properties are probably behind `read:jira-user` on the web build, and Forge KVS doesn't exist yet. So phase 1 keeps stars in localStorage, next to recents. Stars are per browser, not per user, the same trade-off recents already make.

- Key: `${JIRA_APP_KEY ?? scopeId}-starred-reports-${accountId}` (mirrors `useRecentReports.getReportKey`). The account id keeps two people on one browser apart, and makes the phase 2 copy into KVS trivial. With no id, fall back to the key without the suffix.
- Value: `string[]` of saved-report ids. Ids of reports that no longer exist stay in the list but are never shown, because every view intersects the list with `useAllReports`.
- `src/react/services/reports/useStarredReports.ts` returns `{ starredIds: Set<string>, toggleStar(id), removeStar(id) }`, built on the existing `useLocalStorage` hook like `useRecentReports`.
- Star / unstar toasts through the existing `@atlaskit/flag` `FlagsProvider`.

### 1.4 ReportTableRow (no owner column yet)

- Leave `src/react/components/ReportListing/ReportRow.tsx` alone, because the Add Report modal uses it as a picker. Add `ReportTableRow.tsx` and `ReportTableHeader.tsx` in the same folder. They share one exported grid constant so the header can't drift out of line with the rows: `grid-cols-[40px_minmax(0,1fr)_140px_40px] gap-3 px-4` (star, name, type, delete). Phase 2 adds a `160px` owner column before type.
- Props: `described: DescribedReport`, `isStarred`, `onToggleStar`, `href` (a routing `Link`), `onDelete?`, `compact?`, `showJql?` (default true), `query?`, `isActive?`, `onMouseEnter?`.
- Reuse `ReportTypeIcon`, `HighlightedText` and `describeReport`.
- Only the name is the `Link`. The star and delete buttons are its siblings, not its children, so no interactive element is nested inside another and clicking them never opens the report.
- Delete shows on hover or focus (`opacity-0 group-hover:opacity-100 focus-within:opacity-100`) and renders whenever `onDelete` is passed.
- Accessibility: the rows use `role="row"`/`"cell"` inside a `role="table"`. The star is an `IconButton` labeled "Star {name}" / "Unstar {name}", and delete is labeled "Delete {name}". The filled star is a small wrapper component around `StarStarredIcon`, because `IconButton` takes a component, not an element.
- Stories: `ReportTableRow.stories.tsx` covering a plain row, starred, compact, no JQL, and every report type. Move `SAMPLE_REPORTS` out of `ReportRow.stories.tsx` into a shared `ReportListing/sample-reports.ts` fixture so both story files use it.

### 1.5 Home ("No Report") page

- `src/react/ReportHome/ReportHome.tsx`, presentational. Takes `recentReports`, `starredIds`, `onToggleStar`, `onViewAllReports`, `onCreateReport`, `onOpenSources`.
- Layout:
  - a centered `max-w-[960px]` column with `py-16`;
  - heading "Pick up where you left off", and a subtitle whose "Sources" is a `LinkButton` that opens the Sources panel (`routeData.showSettings = 'SOURCES'`, as `SettingsSidebar`'s `changeSettings` does);
  - a "RECENTLY OPENED" label with "All saved reports →", which sets `showSettings = 'REPORTS'` like `onViewReportsButtonClicked` in `TimelineReport.tsx`;
  - a table card of up to 5 recents (compact rows), from `useRecentReports` + `useAllReports`, dropping ids that no longer exist;
  - a "Create new report" primary button.
- No recents: the same heading, a copy variant pointing to Sources / Create, and a plain "All saved reports" button.
- **Create new report:** opens the Sources panel. Nothing can be saved without a JQL; once there is one, the existing Create flow in `SaveReports.tsx` takes over. Don't build a new creation flow.
- `ReportHomeContainer.tsx` mounts its own providers (Storage, Routing, Flags, QueryClient, Jira) plus `ErrorBoundary` and `Suspense`, because it renders inside the report area, which has none. If saved reports fail to load, the fallback is the no-recents home, so the user can still start a report. Add `ReportHome.stories.tsx` (with and without recents).
- `src/react/TimelineReport/components/ReportArea.tsx`: add a `home?: ReactNode` **slot** and render it in the no-JQL branch (`!jql && isLoggedIn && !selfManagesData`) instead of `NoJqlMessage`. `TimelineReport` passes `<ReportHomeContainer storage linkBuilder />`. A slot keeps `ReportArea` pure, so its view-state tests don't need Jira or storage. They pass a stub and assert it renders, plus a new case: no home for a logged-out (sample data) session.
- Delete `NoJqlMessage` and its story from `ReportMessages.tsx` / `ReportMessages.stories.tsx`.
- **Hide the report controls row on home.** In `TimelineReport.tsx`, compute `showingHome` (same condition as `ReportArea`'s home branch, plus no unsupported report type) and give `#report-controls` `hidden` instead of `flex`. Hide it with CSS rather than unmounting, so the controls keep their state.
  - **Open question:** that row holds the only way to start a **Report of Reports**, the one type that needs no JQL. Hiding the whole row means setting a JQL just to reach the Report type picker. Proposal: keep only the Report type picker on home and hide the rest of the row. To decide before building.
- The design's header and sidebar are already the app shell, so nothing to build there.

### 1.6 Saved Reports page

- Replace the body of `src/react/ViewReports/ViewReports.tsx`, keeping the component name so the wrapper keeps working. It keeps using `ViewReportsLayout` for the back link. Give the layout an `actions` slot on the title row for a "Create new report" button, which defaults to opening Sources as on home (injectable via an `onCreateReportClicked` prop for tests).
- **Tabs:** **Starred / All reports** (no "My reports" until phase 2), each with a count pill. Default to Starred when any existing report is starred, otherwise All. Decide this once on mount, so unstarring your last report doesn't switch tabs mid-click. Hand-rolled underline tabs (`role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`) match the design better than `@atlaskit/tabs`.
- **Search:** reuse `useReportSearch`. Add an optional `extraHaystack` option to `filterReports`/`matchesQuery`, which this page uses to add the JQL. Placeholder: "Search by name, type, or JQL". The Add Report modal passes nothing and keeps searching name and type only. Keep the arrow-key navigation; ↵ opens the active row's link.
- **Table:** a card with a sticky `ReportTableHeader` and a scrolling body of `ReportTableRow`s, sorted by name.
- **Paging:** only the All tab pages. Batch size is `ceil(panelHeight / rowHeight) + 1`, with a minimum of 6. Measure the flex-filled tab panel, not the table; the table is only as tall as the rows already in it. "Load more" adds one batch, with "Showing X of Y" next to it. Changing tab or query resets the page and the scroll.
- **Empty states**, each with an icon, title and body: no saved reports at all ("No saved reports yet" / "Save a report and it will show up here."), empty Starred ("No starred reports yet"), and no search matches (`No reports match "{query}"`).
- **Delete:** reuse `DeleteReportModal` and `useDeleteReport`, with the row's trash button replacing the old "…" dropdown. On success, remove the report from recents (`removeFromRecentReports`) and from stars (`removeStar`).
- Update `ViewReport.test.tsx` to the new markup.

### Phase 1 critical files

- New: `ReportListing/ReportTableRow.tsx`, `ReportListing/ReportTableHeader.tsx`, `ReportListing/sample-reports.ts`, `ReportHome/*`, `services/reports/useStarredReports.ts`, `services/user/*`
- Modified: `jira/reports/fetcher.ts`, `SaveReports/SaveReports.tsx`, `TimelineReport/TimelineReport.tsx`, `TimelineReport/components/ReportArea.tsx`, `TimelineReport/components/ReportMessages.tsx`, `ViewReports/ViewReports.tsx`, `ViewReports/components/ViewReportsLayout`, `ReportListing/useReportSearch.ts` / `report-search.ts`, `ReportListing/ReportRow.stories.tsx`

### Phase 1 verification

- **Unit tests (vitest):**
  - `ReportTableRow`: star and delete clicks don't trigger the link; labels; JQL line hidden on request.
  - `ViewReports`: tab counts and the default tab, search by JQL, load-more paging, each empty state, delete flow (removes from stars and recents).
  - `useStarredReports`: toggle, remove, and per-account keys.
  - `identity`: `sub` from a JWT, `null` for a missing or non-JWT token.
  - `ReportArea`: the home slot renders with no JQL, and not when logged out.
  - `describeReport`, still passing with `ownerId`.
- **Storybook:** run `npm run build:css` first, then check the new stories against the design screenshots.
- **Manually,** using the `launch-dev` agent, in both the web build and the Connect plugin build:
  1. With no URL params, the home page shows recents and the report controls row is hidden.
  2. Star from home, reload, and the star is still there.
  3. "All saved reports" opens the page. Tabs, search and Load more work.
  4. Create a report and confirm the saved JSON has `ownerId` matching your account id, with no `/myself` request in the network tab.
- `npm run typecheck`, Prettier, and `npm test`.

---

## Phase 2 — owners (after the Forge release, as a planned major)

Ships only after the Connect → Forge move. Connect is out of scope. This is the release that adds `read:jira-user` to the Forge manifest, a major version that admins have to approve, so plan it as its own release.

### 2.1 Identity and `ownerId` on Forge

- Current user id: `view.getContext()` (`@forge/bridge`) on the front end; `req.context.accountId` in the resolver. Neither needs a scope.
- **Stamp `ownerId` in the resolver** from `req.context.accountId` on create, never from the client. On update, keep the stored value, so a client can't change the owner. A copy is a create, so the copier owns it.
- `ownerId` in the report JSON is the **source of truth** for both storage backends. Phase 1 reports already carry one.

### 2.2 Names

- With `read:jira-user`, `GET /rest/api/3/user/bulk?accountId=…&maxResults=200` (batches of up to 200) returns `accountId`, `displayName`, `avatarUrls`, `active` and `accountType` for every user. `emailAddress`, `timeZone` and `locale` depend on each user's privacy settings, so don't rely on them.
- `useUsers(accountIds)`: non-suspending (names are decoration), cached per id, returns `displayName`s by id. Initials come from the name, and the `24x24` avatar can replace the initials circle.
- `active: false` → show "Former user". Consider letting anyone delete reports whose owner has left.
- **Fallback for reports with no `ownerId`:**
  - Reports Space backend: use the work item's **`creator`** (not `reporter`, which anyone with edit permission can change). Readable with `read:jira-work`. Reports moved into the Space by the Connect → Forge migration have the migrator as creator, so only show the creator's name when the creator's `accountId` equals `ownerId`, or when there's no `ownerId` at all.
  - KVS reports backend: no per-report creator exists, so reports with no `ownerId` show "Unknown".

### 2.3 Owner column, "My reports", owner-only delete

- `ReportTableRow`: add `owner?: { accountId; displayName? }` and `isMine` props, and the `160px` owner column (avatar/initials + name, "You" when it's yours, "Unknown" with no `ownerId`). The grid becomes `grid-cols-[40px_minmax(0,1fr)_160px_140px_40px]`.
- Saved Reports page: add the **My reports** tab (`ownerId === accountId`) with its empty state ("You have not saved any reports"). Add the owner name to the search haystack and change the placeholder to "Search by name, JQL, or owner".
- Delete only renders when `isMine || !ownerId`. For the KVS backend, the resolver also **refuses** to delete a report unless its `ownerId` matches `req.context.accountId`. For the Reports Space, Jira's issue permissions already govern this.

### 2.4 Stars → Forge KVS

- One key **per user**, not a shared `Map<userId, ids[]>`:
  ```
  key:   starred-reports:{accountId}
  value: string[]   // saved-report ids
  ```
  - A shared map is a read-modify-write race between users (one user's star silently erases another's, the same class of bug `index.web.ts`'s `enqueue` comment describes). It grows without bound against KVS's per-value size limit, and it makes deleting one user's data (personal data reporting) an edit to a shared blob.
  - The resolver builds the key from `req.context.accountId`, **never** from an id the client sends, or anyone could read or write anyone's stars.
  - Needs only `storage:app`, which is already granted.
- On first load, if the user's KVS key is empty, copy this browser's phase 1 localStorage stars (`…-starred-reports-${accountId}`) into it, then clear them.

### Phase 2 open items

- Confirm the exact KVS limits and key-character rules for `starred-reports:{accountId}` against the Forge docs.
- Check whether storing `ownerId` (and per-user star keys) brings the app under Atlassian's personal data reporting API requirements, and plan for account-closure cleanup if so.
