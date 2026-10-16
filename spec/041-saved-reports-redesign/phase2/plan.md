# Phase 2: Owner names and avatars (`read:jira-user`, a Forge major)

## Context

[Phase 1](../phase1/plan.md) shipped the home page, the Saved Reports page, stars, `ownerId`, "My reports" and "Last updated", all without a scope change. Its owner column can only say "You", "Someone else" or "—", because turning an account id into a name needs `read:jira-user`.

Phase 2 adds that scope and puts **names and avatars** on every report, plus the things that depend on them: "Former user", search by owner, and the web sign-in banner for tokens that predate the scope.

The code already exists. Phase 1 removed it in a single commit titled `spec/041 phase 1: defer owner names to phase 2`. Phase 2 starts on a new branch from `main` with **`git revert <that commit>`**, then adapts the restored code to what phase 1 added after it (the "Last updated" column and `updatedAt` props on `ReportTableRow`, `isOwnedBy`, the phase 1 owner cell). Expect conflicts in `ReportTableRow.tsx` and its stories and tests, `ViewReports.tsx` and `ViewReport.test.tsx`.

Targets are the web and Forge builds only, as in phase 1. The Connect build is out of scope.

## One release, and it is a major

`read:jira-user` is needed by every API that turns an account id into a name (`/myself`, `/user`, `/user/bulk`):

- **Forge:** adding a scope to `manifest.yml` is a **major version**, and every site admin has to approve the upgrade. Until a site approves it, it keeps running phase 1, which is fully working, just without names. Plan the deploy and release notes as a major.
- **Web:** add `read:jira-user` to `VITE_JIRA_SCOPE` (`.env`, `.env.example`, and the deployed environment). Only **new** authorizations get the scope. A user who is already signed in keeps refreshing a token with the old scopes (`refreshAccessToken` in `jira-oidc-helpers/auth.ts` never asks for scopes again), so `/user/bulk` fails for them until they sign in again. Name lookups must degrade quietly to the phase 1 owner cell; never block the page on them.

**Decisions** (carried from phase 1, plus):

- **Names are always looked up at render time, never stored.** The phase 1 rule stands: never store a name, email, avatar or other profile field next to an account id, in reports, star values or any KVS cache. That's what keeps the app out of personal data reporting (see phase 1 § Decisions for sources).

## 1. Scopes

- `manifest.yml` `permissions.scopes`: add `read:jira-user`, with a comment saying what it is for (owner names through `/rest/api/3/user/bulk`) and that adding it made this release a major.
- `.env.example` (and `.env`): `VITE_JIRA_SCOPE="read:jira-work write:jira-work read:jira-user offline_access"`. Flag the deployed-environment change in the PR description.
- The OAuth app in the Atlassian developer console must have `read:jira-user` enabled for the web client id, or the authorize redirect fails. Add it to the PR checklist.
- Forge commands (`forge deploy`, `forge install --upgrade`) are run by the user. List them in the PR; don't run them.

## 2. Names: `useUsers`

Restored by the revert: `src/react/services/user/useUsers.ts` + `useUsers.test.tsx`:

- `useUsers(accountIds)` calls `GET /rest/api/3/user/bulk?accountId=…&maxResults=200` in batches of up to 200, through the existing request helper (`requestJira` on Forge, the hosted helper on web).
- **Non-suspending** (names are decoration), cached per id, returns `{ displayName, avatarUrl, active, accountType }` by id. Use `avatarUrls['24x24']`. Don't rely on `emailAddress`, `timeZone` or `locale`; they depend on each user's privacy settings.
- **On a 401/403** (a web user still on a token without `read:jira-user`): return no names, don't retry, and return `needsReauth: true`.

The revert also restores `useReportOwners` (phase 1 renamed its file to `report-owner.ts` and kept only `effectiveOwnerId`, `isOwnedBy` and `canDeleteReport`; keep `isOwnedBy`): one `useUsers` call for every distinct `effectiveOwnerId` across all reports (so Space creators are looked up too).

## 3. Avatars

- Web: the `avatarUrls` from `/user/bulk` load in a plain `<img>`.
- Forge: check them on `prodcheck`. If they're gateway URLs a plain `<img>` can't authenticate to, render them through `JiraImage` / `createForgeImageResolver` (spec/040), which fetches through `requestJira` and needs no extra scope. Don't add a resolver proxy or `read:avatar:jira`.
- No avatar URL → a circle with initials from the display name.

## 4. ReportTableRow owner cell

Owner cell states, replacing phase 1's:

| Case                                                                | Shows                               |
| ------------------------------------------------------------------- | ----------------------------------- |
| Mine                                                                | avatar + "You"                      |
| Someone else, name loaded                                           | avatar (or initials) + display name |
| Someone else, `active: false`                                       | "Former user"                       |
| Someone else, name not loaded (still loading, 401/403, or no match) | phase 1's "Someone else"            |
| No owner                                                            | "—"                                 |

The `owner` prop gets back `displayName?`, `avatarUrl?`, `active?`. Restore the avatar, initials and "Former user" stories and tests. The grid keeps phase 1's "Last updated" column; check the owner column (120px in phase 1) still fits a name and avatar, and widen it if needed.

## 5. Delete

`canDeleteReport` gets back its third case: offered when the report is mine, has no `ownerId`, **or its owner is a former user** (`active === false`), so reports left behind by people who've gone can be cleaned up. Still a UI convenience, not a permission.

## 6. Saved Reports page

- **Search by owner:** add the owner's display name (when loaded) back into `extraHaystack`. Placeholder: "Search by name, JQL, or owner".
- **Sign-in banner (web only):** when `useReportOwners` reports `needsReauth`, show a dismissible Atlaskit `SectionMessage` above the table: _"Sign in again to see who owns each report"_, with a **Sign in** button.
  - The button calls the existing `fetchAuthorizationCode(config)()` (`jira-oidc-helpers/auth.ts:8`), which sends the user to Atlassian's consent screen with the current `VITE_JIRA_SCOPE` and returns them to the same page through `state`.
  - Injected as an optional `onReauthorize` prop, passed only by the web host (`web.main.ts` `createUserServices` → `reauthorize`, `ViewReportsWrapper.tsx`). Forge passes nothing, so the banner never renders there; the manifest grants the scope, so a 401/403 on Forge is a real error, not an old token.
  - Dismissing hides it until the next page load (component state, not storage). It stops for good once the user signs in again.
  - Not on home; home shows no names. Home's rows do get names and avatars through the same `useReportOwners` call in `ReportHomeContainer`, with no banner.

## Critical files

- Restored by the revert: `services/user/useUsers.ts` + test, `useReportOwners` (in `services/user/report-owner.ts`), the `status` on errors in `utils/fetch/response-to-json.ts`, the banner and `onReauthorize` in `ViewReports/ViewReports.tsx`, `ViewReports/ViewReportsWrapper.tsx`, `web.main.ts`.
- Modified: `manifest.yml`, `.env.example`, `ReportListing/ReportTableRow.tsx` (+ stories, tests), `ReportHome/ReportHomeContainer.tsx`, `ViewReports/ViewReport.test.tsx`.

## Verification

- **Unit tests (vitest):**
  - `useUsers`: batching at 200; a 401/403 gives no names, no retry, and `needsReauth: true`; `active: false` comes through.
  - `ReportTableRow`: owner cell for every row of the table in § 4.
  - `canDeleteReport`: former-user reports are deletable.
  - `ViewReports`: search by owner name; banner shown when `needsReauth` and `onReauthorize` are both present, hidden without `onReauthorize` (Forge), the button calls `onReauthorize`, dismissing hides it.
- **Manually, web build** (`launch-dev` agent):
  1. With a token issued **before** the scope change: the page loads with phase 1's owner cell ("You" / "Someone else"), no error, and the sign-in banner. "Sign in" goes through Atlassian's consent screen (listing the new permission) and lands back on Saved Reports, now with names and avatars and no banner.
  2. Search by an owner's name finds their reports.
- **Manually, Forge**: the user deploys and upgrades `prodcheck` (`forge deploy -e prodcheck` / `forge install --upgrade -e prodcheck`) and approves the new scope. Then a second account sees your name and avatar on your reports, and avatars render (see § 3).
- `npm run typecheck`, Prettier, and `npm test`.
