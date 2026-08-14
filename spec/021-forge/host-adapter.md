# The compatibility layer

One port, three adapters. This document defines the port, shows what each host plugs into it, and
walks the six places where host knowledge currently escapes the seam.

Read [README.md](./README.md) first for why. This is the how.

> **Status: deferred, but still the design of record.**
>
> [plan.md](./plan.md) adds Forge as a third host _without_ introducing this port — a new
> `forge.main.ts` alongside `plugin.main.ts` and `web.main.ts`, following the pattern already in the
> repo. That gets a working Forge app in days instead of weeks, at the cost of three parallel host
> implementations that can drift. This document is what consolidating them later looks like.
>
> Four of the six leaks get closed on the way to Forge anyway, because Forge breaks without them:
>
> | Leak                                                | Fate under plan.md                                                                        |
> | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
> | 1 — `requestHelper` chosen by host string           | Closed. The host object gains `createRequestHelper`.                                      |
> | 2 — `AP` sniffing in `editJiraIssueWithNamedFields` | **Must** be closed — Forge writes fail otherwise.                                         |
> | 3 — module-scope `AP` sniff in `Link`               | **Must** be closed — wrong answer under Forge.                                            |
> | 4 — `config.host === 'jira'` field gate             | Closed as `!== 'hosted'`. Not the port, but correct.                                      |
> | 5 — localStorage token check inside web storage     | Closed as an injected predicate, so Forge reuses the backend verbatim.                    |
> | 6 — host branching in `mainHelper`                  | Partially. The login-button hide becomes `!== 'hosted'`; the temporary domain POST stays. |
>
> So the residual debt is narrower than it looks: mainly the absence of a _named_ port and its
> contract test suite, plus leak 6's remnant. The § history port section below is now load-bearing
> rather than speculative — plan.md Phase 4 implements exactly it.

## The shape we already have

`mainHelper` is already a host-adapter consumer — it just takes its adapter as five loose arguments
instead of one object, and reaches around it twice.

```js
// src/shared/main-helper.js:26
export default async function mainHelper(
  config,
  { host, createStorage, configureRouting, showSidebarBranding, isAlwaysLoggedIn, createLinkBuilder, licensingPromise },
) {
  let requestHelper;                                    // ← leak: the host should have supplied this
  if (host === 'jira') { requestHelper = getConnectRequestHelper(); }
  else                 { requestHelper = getHostedRequestHelper(config); }
  ...
  if (host === 'hosted') { /* temporary domain-reporting POST */ }
  ...
  if (host === 'jira')   { login.style.display = 'none'; }
}
```

Both call sites that build this object are ~30 lines and read cleanly (`src/plugin.main.ts:47-73`,
`src/web.main.ts:17-33`). The work is to name the type, absorb the leaks, and add the two ports Forge
needs that neither existing host required.

## The port

```ts
// src/host/types.ts

export type HostKind = 'web' | 'connect' | 'forge';

export interface HostAdapter {
  readonly kind: HostKind;

  /** Every Jira call in the app goes through this. Fragments are bare: `/api/3/field`. */
  request: RequestHelper;

  auth: AuthPort;
  storage: AppStorage; // unchanged — src/jira/storage/common.ts:3
  history: HistoryPort;
  navigation: NavigationPort;

  licensing(): Promise<LicensingInformation>;

  chrome: {
    showSidebarBranding: boolean;
    showLoginButton: boolean;
  };
}

export interface AuthPort {
  /** True when requests will carry credentials. Web: a valid token exists. Others: always true. */
  isAuthenticated(): boolean;
  /** Resolves once initial auth settles — the gate `Login.resolved` exists for today. */
  ready(): Promise<void>;
  login?(): Promise<void>;
  logout?(): void;
  /** Web reads it from localStorage; Forge from view.getContext(); Connect never needs it. */
  cloudId(): string | undefined;
}

export interface HistoryPort {
  /**
   * Runs before `route.start()`. Pulls the host container's params into `window.location.search`
   * so CanJS sees the real URL. No-op on the web, where the URL is already final.
   */
  reconcile(): void | Promise<void>;
  /**
   * Runs after `route.start()`. Installs the outbound mirror: every in-app `history.pushState`
   * is echoed to the host so refresh and deep links survive.
   */
  startMirroring(): void;
}

export interface NavigationPort {
  /** Replaces `window.open(url, '_blank')` and `<a target="_blank">`. */
  openExternal(url: string): void;
  /** Today's `createLinkBuilder(appKey)` result — turns in-app params into a shareable href. */
  buildLink(queryParams: string): string;
}
```

`AppStorage` deliberately does not change. Widening it from blob-shaped to record-shaped is
[spec/020](../020-report-and-team-data/plan.md)'s job and is orthogonal to which host is running.

## Per-host implementations

| Port method               | `web`                                                                                                        | `connect`                                                                               | `forge`                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `request`                 | `fetch(\`${JIRA_API_URL}/${scopeId}/rest/${frag}\`)`+ Bearer + refresh-on-expiry —`hosted-request-helper.js` | `JSON.parse((await AP.request('/rest/' + frag)).body)` — `connect-request-helper.js:34` | `requestJira('/rest/' + frag, opts).then(responseToJSON)`               |
| `auth.isAuthenticated`    | `!!localStorage.accessToken`                                                                                 | `true`                                                                                  | `true`                                                                  |
| `auth.ready`              | `Login.resolved` (OAuth 3LO)                                                                                 | resolves immediately                                                                    | resolves immediately                                                    |
| `auth.cloudId`            | `localStorage.scopeId`                                                                                       | n/a                                                                                     | `(await view.getContext()).cloudId`                                     |
| `storage`                 | config-issue code block                                                                                      | Connect app property                                                                    | **config-issue code block** (reused verbatim)                           |
| `history.reconcile`       | no-op                                                                                                        | `AP.history.getState('all').query` → `history.replaceState`                             | `(await view.createHistory()).location.search` → `history.replaceState` |
| `history.startMirroring`  | no-op                                                                                                        | patch `history.pushState` → `AP.history.replaceState`                                   | patch `history.pushState` → `forgeHistory.replace`                      |
| `navigation.openExternal` | `window.open(url, '_blank')`                                                                                 | `window.open(url, '_blank')`                                                            | `router.open(url)`                                                      |
| `navigation.buildLink`    | identity                                                                                                     | `ac.{appKey}.*` prefixing + `project.id`/`project.key` — `index.plugin.ts:38`           | app URL + query string                                                  |
| `licensing`               | `{active: true, evaluation: false}`                                                                          | `AP.request('/rest/atlassian-connect/1/addons/{key}')`                                  | `view.getContext().license`                                             |
| `chrome.showLoginButton`  | `true`                                                                                                       | `false`                                                                                 | `false`                                                                 |

Two things fall out of this table:

**The Forge `request` adapter is a near-copy of the hosted one, not the Connect one.** Both are
`fetch`-shaped and both end in `responseToJSON` (`src/utils/fetch/response-to-json.ts`), which returns
parsed JSON and throws an `Error` decorated with the payload on `!response.ok`. `requestJira` returns
a WHATWG `Response`, so it drops straight in. Connect is the odd host — it returns `{body: string}`
and needs the `JSON.parse` dance. Roughly:

```ts
// src/host/forge/request.ts
import { requestJira } from '@forge/bridge';
import { responseToJSON } from '../../utils/fetch/response-to-json';

export const forgeRequestHelper: RequestHelper = (fragment, options = {}) =>
  requestJira(fragment.startsWith('/') ? `/rest${fragment}` : `/rest/${fragment}`, {
    method: options.method ?? 'GET',
    headers: { Accept: 'application/json', ...options.headers },
    ...(options.body ? { body: options.body } : {}),
  }).then(responseToJSON);
```

Watch the leading-slash inconsistency in the existing fragments — `'/api/3/serverInfo'`
(`serverInfo.ts:8`) vs. `'api/3/search/approximate-count'`
(`fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:58`). Both hosts tolerate it today by accident;
normalize it in the adapter rather than fixing 12 call sites.

**Forge storage is free.** `createWebAppStorage` (`src/jira/storage/index.web.ts`) touches Jira only
through `jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields` and
`jiraHelpers.editJiraIssueWithNamedFields`. Point those at the Forge request helper and the whole
backend — code block, TR-133 team table and all — works unmodified. The one thing to extract first is
its private localStorage check (leak 5, below).

## Closing the six leaks

### 1. `requestHelper` chosen by host string — `main-helper.js:41-46`

Delete the branch; `adapter.request` is passed to `JiraOIDCHelpers`. This is the whole point of the
refactor: the request helper is _the_ host difference, and it's the one thing the current adapter
object doesn't carry.

While here: `createJiraHelpers(config, requestHelper, host)` (`src/jira-oidc-helpers/index.ts:55`)
takes `host: 'jira' | 'hosted'` (`types.ts:100`) purely to feed leak 4. Once leak 4 is fixed, the
parameter goes away rather than growing a third member.

### 2. `AP` sniffing in `editJiraIssueWithNamedFields` — `jira.ts:625-641`

The function's own comment says it's a "quick and dirty fix while we work on getting a more robust
request helper." That work is this document. The Connect branch exists because the generic
`requestHelper` didn't handle `PUT` with a body when it was written — `connect-request-helper.js:26-33`
now does. Route it through `config.requestHelper` like every other call and both special cases
disappear.

This is the only place in the app that bypasses the request helper. It matters for Forge because
`editJiraIssueWithNamedFields` is how _all_ web/Forge storage writes happen
(`index.web.ts:157`) — leave it and Forge saves fail with `AP is not defined`.

### 3. Module-scope `AP` sniff in `Link` — `Link.tsx:8`

```ts
const isIFrame = !!(AP?.history?.getState ?? false); // evaluated once, at import
```

Replace with a value read from the adapter through the existing `RoutingProvider` context. The
question the code is actually asking is "should a click be intercepted into the SPA router rather
than following the href?" — which is true for Connect _and_ Forge and false for the web. Name it
that: `navigation.interceptsLinkClicks`.

### 4. `config.host === 'jira' || hasAccessToken()` — `fields.ts:68`

The condition means "can we make authenticated requests yet?" Becomes
`adapter.auth.isAuthenticated()`, which is `true` for both embedded hosts by definition.

### 5. localStorage token check inside the web storage backend — `index.web.ts:43-48`

```ts
const accessToken = window.localStorage.getItem('accessToken');
const scopeId = window.localStorage.getItem('scopeId');
if (!accessToken || !scopeId) return null; // logged-out preview mode
```

A storage backend knowing how the web host stores OAuth tokens is what makes it _look_ host-specific
when it isn't. Replace with `auth.isAuthenticated()`; the backend becomes genuinely host-neutral and
Forge can reuse it as-is.

### 6. Host branching in `mainHelper` — `:51-63`, `:164-166`

The login-button hide becomes `chrome.showLoginButton`. The temporary domain-reporting POST is marked
"will be removed in two weeks" and is dated — check whether it can just go; if not, it belongs in the
web adapter's construction, not in shared bootstrap.

## The history port, in detail

This is the port that isn't a passthrough, so it gets its own section.

**Why it's hard.** CanJS owns the URL: `route.urlData = pushStateObservable` and
`route.urlData.root = window.location.pathname` (`src/canjs/routing/state-storage.js:21-22`), with
`RoutePushstate` binding `popstate` and wrapping `history.pushState` inside a 15 MB vendored
`src/can.js`. Every report's configuration is query-string state. And a Forge Custom UI iframe cannot
write the parent URL — so left alone, in-app navigation works until the user refreshes or shares a
link, at which point everything is lost.

**Why it's already solved.** Connect has the identical constraint, and `src/routing/index.plugin.ts`
solves it with a two-way mirror:

```js
reconcileRoutingState: () => {                       // inbound, before route.start()
  const query = AP?.history.getState('all')?.query ?? {};
  history.replaceState(null, '', '?' + objectToQueryString(query));
},
syncRouters: () => {                                 // outbound, after route.start()
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    AP?.history.replaceState({ query: queryStringToObject(window.location.search), state: {...} });
  };
}
```

The Forge adapter is the same two functions with `view.createHistory()` in place of `AP.history`:

```ts
const forgeHistory = await view.createHistory();

reconcile: () => {
  history.replaceState(null, '', forgeHistory.location.search || window.location.pathname);
},
startMirroring: () => {
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    forgeHistory.replace({ search: window.location.search });
  };
}
```

**Three ordering constraints that already exist and must be preserved.** They're documented in
`plugin.main.ts:58-67` and `src/jira/reports/migrations/url.ts`, and getting them wrong produces
silent, hard-to-diagnose state loss:

1. `reconcile()` before the legacy-param rewrite — `reconcile` replaces the _entire_ search string,
   so anything written earlier is discarded. This is why the legacy URL fixes historically never
   worked in the Connect host.
2. The legacy rewrite (`migrateUrlParams`) before `route.start()` — after it, the rewrite is
   invisible to `pushStateObservable`.
3. `startMirroring()` attached as `route._onStartComplete`, i.e. after start.

Because `view.createHistory()` is async and `AP.history` isn't, the Forge adapter has to be
constructed with an `await` before `configureRouting` runs. That's a change to the bootstrap's shape,
not just its contents — worth knowing before Phase B1 starts.

**Still open, and the first thing [plan.md](./plan.md) Phase 4 measures:** the docs demonstrate
`createHistory` with pathnames and confirm `location.search` is populated (that's how the
`x_atlassian_cf` Connect-redirect param is read), but they don't state a length ceiling. Report URLs
here are long. If they don't fit, the fallback is to mirror a short opaque key and keep the payload
in storage.

## Proposed layout

```
src/host/
  types.ts             HostAdapter, AuthPort, HistoryPort, NavigationPort
  web/                 index.ts, request.ts, auth.ts, history.ts, navigation.ts
  connect/             ← src/request-helpers/connect-request-helper.js,
                         src/routing/index.plugin.ts, src/jira/storage/index.plugin.ts move here
  forge/               new
  shared/              storage backends that are host-neutral (the config-issue one)
```

Entry modules shrink to adapter construction:

```ts
// src/forge.main.ts
import mainHelper from './shared/main-helper.js';
import { createForgeAdapter } from './host/forge';

main(await createForgeAdapter(env));
```

The invariant this buys, and the one to enforce in review: **`AP` appears only under
`src/host/connect/`, `@forge/bridge` only under `src/host/forge/`, and `localStorage` access for auth
only under `src/host/web/`.** All three are greppable, so they're CI-enforceable.

## Testing

The port is small enough to test as a contract, and there's precedent: spec/020 Phase 2 introduces
exactly this pattern for storage ("one contract suite, every backend"). Extend it rather than
inventing a second one.

Cases worth naming per adapter:

- `request` normalizes a fragment with and without a leading slash to the same URL.
- A `!response.ok` from any host produces the same decorated `Error` shape the app's error handling
  expects (`responseToJSON`).
- `history.reconcile()` is idempotent and survives an empty container query.
- `openExternal` never calls `window.open` on Forge.
- `licensing()` returns `active: true` when the host reports no license object at all — the
  dev/staging/free-app case, which today is a string check on the app key (`plugin.main.ts:17`).

A fake adapter for tests and Storybook comes for free once the port exists, which is a second reason
to do Phase B1 whether or not Forge happens: several components currently reach for `AP` or
`localStorage` at module scope and can't be rendered in isolation because of it.

## Explicitly out of scope

- **Changing the storage _format_.** That's spec/020. This layer only decides which implementation is
  wired up.
- **Finishing the CanJS→React migration.** The history port is designed to work with `route-data.js`
  as it exists. If the keystone lands first the port gets simpler; it isn't a prerequisite.
- **A Forge backend function.** Nothing in the day-one Forge host needs one. It becomes necessary
  only if KVS is adopted as a fourth storage backend.
