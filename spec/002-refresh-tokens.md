# 002 — Support OAuth Refresh Tokens (Web / Hosted flow)

## Goal

Keep a user signed in without forcing a full re-authorization (redirect to Atlassian)
every time the access token expires (~1 hour). Instead, silently exchange the stored
**refresh token** for a new access token in the background.

This applies to the **web / hosted OAuth flow** (`src/web.main.ts` →
`getHostedRequestHelper`). The Atlassian **Connect plugin** flow authenticates via the
Connect iframe/JWT, not this OAuth token, so it is out of scope here (see Question 5).

## Background — how auth works today

The pieces already exist but are not wired together correctly.

### Auth server (already supports refresh)

- [server/server.js](../server/server.js#L31) exposes `GET /access-token?code=…&refresh=…`.
- [server/helper.js](../server/helper.js#L3) `fetchTokenWithAccessCode(code, refresh)` posts to
  `https://auth.atlassian.com/oauth/token`. When `refresh` is truthy it uses
  `grant_type=refresh_token` and sends the value of `code` as the `refresh_token`.
  It returns `{ accessToken, refreshToken, expiryTimestamp, scopeId }`.
- ✅ The backend can already perform a refresh. The gap is on the client and in config.

### Client (currently broken / incomplete)

1. [src/jira-oidc-helpers/auth.ts](../src/jira-oidc-helpers/auth.ts#L39) `refreshAccessToken` is broken:
   - It calls `fetchJSON(\`${config.env.JIRA_API_URL}/?code=${accessCode}\`)` — this points at
the **Jira API URL**, not the auth server (`VITE_AUTH_SERVER_URL`).
   - It never sends `refresh=true`.
   - It passes `code=<accessCode>` but the caller passes **no argument**, so `accessCode`
     is `undefined` and the stored refresh token is never used.
2. [src/jira-oidc-helpers/auth.ts](../src/jira-oidc-helpers/auth.ts#L89) `getAccessToken` calls
   `refreshAccessToken(config)()` with no refresh token argument.
3. [src/request-helpers/hosted-request-helper.js](../src/request-helpers/hosted-request-helper.js#L27)
   does **not** attempt a refresh. When the token has < 5s left it `alert()`s and calls
   `fetchAuthorizationCode(config)` — and because `fetchAuthorizationCode` is curried
   (`(config) => () => {…}`), calling it with just `(config)` returns the inner function but
   never invokes it, so even the redirect is a no-op.

### Storage

- [src/jira-oidc-helpers/storage.ts](../src/jira-oidc-helpers/storage.ts#L1)
  `saveInformationToLocalStorage` persists `accessToken`, `refreshToken`, `expiryTimestamp`.
  Note: it **removes** any key whose value is falsy, so a refresh response missing a
  `refreshToken` would wipe the stored one — relevant because Atlassian **rotates** refresh
  tokens (see below).

## The `offline_access` scope requirement (answers the scope concern)

From the reference implementation in `bitovi/cascade-mcp` and Atlassian's OAuth docs:

- **Atlassian only issues a refresh token when the authorization request includes the
  `offline_access` scope.** Without it, no refresh token comes back and refresh is impossible.
- Atlassian **rotates** refresh tokens: every successful refresh returns a _new_ refresh
  token, and the old one is invalidated. We must persist the new one each time.
- The authorize URL is built in
  [src/jira-oidc-helpers/auth.ts](../src/jira-oidc-helpers/auth.ts#L8) from
  `config.env.JIRA_SCOPE` (`VITE_JIRA_SCOPE`), so `offline_access` must be part of that value.

### Is there a default scope? (answering the staging concern)

**No — there is no hardcoded default scope in the code.**

- `VITE_JIRA_SCOPE` is required at build time:
  [scripts/generate-build-env.sh](../scripts/generate-build-env.sh#L8) aborts the build
  (`Need to set VITE_JIRA_SCOPE`) if it is empty.
- CI/CD reads it from `vars.VITE_JIRA_SCOPE`
  ([deploy-staging.yaml](../.github/workflows/deploy-staging.yaml#L36),
  [deploy-prod.yaml](../.github/workflows/deploy-prod.yaml#L44),
  [ci.yaml](../.github/workflows/ci.yaml#L42)).
- The staging **environment** screenshot only lists `VITE_AUTH_SERVER_URL`,
  `VITE_JIRA_CALLBACK_URL`, and `VITE_JIRA_CLIENT_ID`. Because the build succeeds and there
  is no code default, `VITE_JIRA_SCOPE` must be defined at the **repository** (or org) level
  variable scope rather than the environment scope. `vars.*` falls back
  environment → repository → org, so a repo-level value would still resolve.

**Action:** confirm the current value of the repo-level `VITE_JIRA_SCOPE` variable and add
`offline_access` to it (see Step 1). Do the same for local `.env` files.

## Incremental Plan

Each step is independently verifiable. Do them in order.

### Step 1 — Add `offline_access` to the scope and confirm a refresh token is issued

- Add `offline_access` to `VITE_JIRA_SCOPE` for: local `.env`, the repo/staging/prod GitHub
  variables, and any developer-console app config that needs it.
- No code change required for the authorize URL — it already interpolates `JIRA_SCOPE`.

**How we know it works:** log in fresh in the web app, then in DevTools check
`localStorage.getItem('refreshToken')` is a non-empty value. (Before this change it is
typically absent/empty.) Confirm the authorize URL in the network tab contains
`scope=…offline_access`.

### Step 2 — Fix `refreshAccessToken` to call the auth server correctly

In [src/jira-oidc-helpers/auth.ts](../src/jira-oidc-helpers/auth.ts#L39):

- Read the stored refresh token from localStorage.
- Call the auth server, not the Jira API:
  `${VITE_AUTH_SERVER_URL}/access-token?code=<refreshToken>&refresh=true`.
- On success, persist the returned `accessToken`, **new** `refreshToken`, and
  `expiryTimestamp`.
- On failure, clear auth and fall back to a full authorization redirect.

**How we know it works:** temporarily shorten the stored `expiryTimestamp` (set it to a past
value in DevTools), trigger a Jira request, and confirm a single `GET /access-token?...&refresh=true`
call succeeds and `accessToken` + `refreshToken` in localStorage both change to new values.

### Step 3 — Make `getAccessToken` pass the refresh token

In [src/jira-oidc-helpers/auth.ts](../src/jira-oidc-helpers/auth.ts#L89):

- When there is a stored refresh token and the access token is invalid, call the fixed
  `refreshAccessToken` with the refresh token (rather than `()` with no argument).
- If there is no refresh token, fall back to `fetchAuthorizationCode`.

**How we know it works:** with an expired access token but a valid refresh token, calling
`getAccessToken()` resolves to a fresh access token **without** a page redirect.

### Step 4 — Refresh silently in the hosted request helper (no more alert/redirect)

In [src/request-helpers/hosted-request-helper.js](../src/request-helpers/hosted-request-helper.js#L23):

- When the access token is expired/near-expiry, `await getAccessToken()` (or
  `refreshAccessToken`) to obtain a fresh token, then continue the original request with the
  new token instead of `alert()`-ing and redirecting.
- Only fall back to `fetchAuthorizationCode(config)()` (note: **invoke** the returned
  function) when refresh fails or no refresh token exists.
- Guard against a refresh storm: ensure concurrent requests share a single in-flight refresh
  (a module-level promise) so N parallel requests trigger one refresh, not N.

**How we know it works:** let a session sit until the access token expires, then interact with
the app. Requests succeed transparently with no alert and no redirect; the network tab shows
one refresh call followed by retried Jira requests.

### Step 5 — Handle refresh failure / expired refresh token gracefully

- If the refresh call returns an error (expired/revoked refresh token), clear stored auth
  ([clearAuthFromLocalStorage](../src/jira-oidc-helpers/storage.ts#L20)) and redirect to
  authorization so the user re-consents.

**How we know it works:** put a garbage value in `localStorage.refreshToken`, trigger a
request, and confirm the app clears auth and sends the user to Atlassian to re-authorize
rather than silently failing or looping.

### Step 6 — Regression pass on the plugin/Connect flow

- Confirm adding `offline_access` and the refresh wiring does not change behavior for the
  Atlassian Connect plugin build (it uses the Connect iframe/JWT, not this token). See
  Question 5.

**How we know it works:** load the plugin build (`dev.html`) and confirm data still loads and
no refresh logic interferes.

## Out of scope (unless we decide otherwise)

- Proactive background refresh on a timer (we only refresh on demand / just-in-time).
- Encrypting or moving refresh tokens out of `localStorage` (see Question 4).

## Questions

1. Confirm the current value of the repo-level `VITE_JIRA_SCOPE` GitHub variable — is
   `offline_access` already present, or do we need to add it to repo + staging + prod? (My
   read: it is set at the repository variable level, not per-environment, which is why it
   isn't in the staging environment screenshot.)

2. Do we also need to add/enable anything in the Atlassian developer console app, or is adding
   `offline_access` to the authorize request scope sufficient for your app registration?

3. For refresh UX: is on-demand (just-in-time) refresh acceptable, or do you want a proactive
   timer that refreshes shortly before expiry so long-idle tabs stay warm?

4. Storing the (now longer-lived, rotating) refresh token in `localStorage` — acceptable for
   now, or do you want a follow-up to harden storage?

5. Should the Atlassian **Connect plugin** flow be considered at all here, or is refresh
   strictly a web/hosted concern? (I currently treat it as web-only.)

6. On a failed/expired refresh, is redirecting the user to full re-authorization the desired
   fallback, or would you prefer an in-app "please sign in again" prompt first?
