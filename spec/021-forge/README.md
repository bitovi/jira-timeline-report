# Running as a Forge app

What it would take to add **Forge** as a third host alongside the website (OAuth) and the embedded
Connect app — and to stop the three from diverging by putting every host difference behind one
compatibility layer.

- [host-adapter.md](./host-adapter.md) — the compatibility layer: the `HostAdapter` port, a
  per-host implementation table, and a leak-by-leak remediation list
- [platform-constraints.md](./platform-constraints.md) — the researched Forge facts (sandbox, CSP,
  quotas, storage limits, egress) with sources, so nobody has to re-google them

## TL;DR

**The app is unusually well-positioned for this.** Everything host-specific already funnels through
one function — `mainHelper(config, hostAdapter)` (`src/shared/main-helper.js:26`) — which takes
`createStorage`, `configureRouting`, `createLinkBuilder`, `isAlwaysLoggedIn` and `licensingPromise`
as parameters. Adding Forge is mostly **writing a third implementation of an interface that already
exists**, plus widening it to cover four things it doesn't yet abstract.

**There is no Connect backend to port.** The descriptor says `"authentication": {"type": "none"}`
(`scripts/atlassian-connect/base-connect.json:7`) — the embedded app is pure frontend talking to
`AP.request`. Atlassian's migration guide spends most of its length on keeping your Connect server
alive during the transition; that entire chapter doesn't apply here.

**The clock is the problem, not the code.** Connect's Phase Two enforcement (**March 2026**) already
passed: a Marketplace app with a Connect descriptor and no Forge manifest **can no longer ship
updates**. This repo has no `manifest.yml`. Phase Three — end of support — enforces in **Q4 2026**.
See [platform-constraints.md § Timeline](./platform-constraints.md#the-connect-timeline).

**So there are two separable pieces of work, and the cheap one unblocks shipping:**

|       | What                                                                             | Cost                | Buys                                                                 |
| ----- | -------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- |
| **A** | Wrap today's Connect descriptor in a Forge `manifest.yml` using `connectModules` | ~1–2 days           | The ability to ship Marketplace updates again. Zero app-code change. |
| **B** | A real Forge Custom UI host behind a compatibility layer                         | ~5–7 engineer-weeks | Survives Q4 2026. Kills the OAuth backend for embedded users.        |

Do **A** now regardless. It buys the runway for **B**. Note that A does _not_ make this a Forge app —
"an app that has a Forge manifest and a mix of Connect and Forge modules will be considered a Connect
app until all Connect modules are removed."

**The hardest single item is routing**, and it's already half-solved. CanJS owns the URL
(`route.urlData = pushStateObservable`, `src/canjs/routing/state-storage.js:21`) and every report's
entire configuration lives in the query string. Forge's iframe can't write the parent URL — but
neither can Connect's, and `src/routing/index.plugin.ts` already implements a two-way mirror between
`window.history` and `AP.history`. Forge needs the same adapter with `view.createHistory()`
substituted for `AP.history`. Confirmed workable: Forge's history object exposes `location.search`.

**Storage is the easiest part, and spec/020 makes it easier.** Today's _website_ backend — the JSON
code block in the configuration issue's description (`src/jira/storage/index.web.ts`) — is already
host-neutral. It only uses `fetchJiraIssuesWithJQLWithNamedFields` and `editJiraIssueWithNamedFields`,
so it runs unchanged on Forge the moment the request helper is abstracted. **Forge needs no backend
function to have working storage on day one.** See [§ Storage](#storage-and-spec020).

---

## What Forge actually changes

Eight host concerns. Four are already parameters of `mainHelper`, one is half-covered, three aren't
abstracted at all.

| Concern                     | Website (OAuth)                                                 | Connect                                                | Forge                                                     | Abstracted today?                                                 |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- |
| HTTP to Jira                | `fetch` + Bearer token to `api.atlassian.com/ex/jira/{cloudId}` | `AP.request('/rest/…')`                                | `requestJira('/rest/…')` from `@forge/bridge`             | **No** — chosen by a `host` string inside `mainHelper` (`:41-46`) |
| Auth                        | OAuth 3LO + refresh + site picker                               | implicit                                               | implicit                                                  | Partly (`isAlwaysLoggedIn`)                                       |
| Storage                     | code block in a config issue                                    | Connect app property                                   | KVS (needs a resolver) _or_ reuse the config issue        | **Yes** (`createStorage`)                                         |
| URL / routing               | real browser history                                            | mirror to `AP.history`                                 | mirror to `view.createHistory()`                          | **Yes** (`configureRouting`)                                      |
| Deep links                  | identity function                                               | `ac.{appKey}.*` prefixed params                        | Forge app URL + `location.search`                         | **Yes** (`createLinkBuilder`)                                     |
| Licensing                   | n/a                                                             | `AP.request('/rest/atlassian-connect/1/addons/{key}')` | `view.getContext().license`                               | **Yes** (`licensingPromise`)                                      |
| Opening external URLs       | `window.open` / `target="_blank"`                               | works                                                  | **blocked** — no `allow-popups`; must use `router.open()` | **No** — 34 call sites                                            |
| Third-party assets & egress | unrestricted                                                    | unrestricted                                           | CSP-gated, must be declared in the manifest               | **No**                                                            |

Everything in the "No" column is what the compatibility layer has to grow.

## Where the current seam leaks

The seam is good. It has exactly six holes, all small, all worth closing **before** any Forge work —
they're the difference between "add a third adapter" and "add a third adapter and then chase
`if (host === …)` through 850 source files."

| #   | Leak                                                                                                                                             | Location                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| 1   | `requestHelper` is picked by branching on the `host` string instead of being supplied by the host                                                | `src/shared/main-helper.js:41-46`             |
| 2   | `editJiraIssueWithNamedFields` sniffs `AP?.history?.getState` and hand-rolls a second request path — comment already calls it "quick and dirty"  | `src/jira-oidc-helpers/jira.ts:625-641`       |
| 3   | `Link` decides iframe-ness by sniffing `AP` at **module scope** — unmockable, and wrong under Forge (it _is_ an iframe, but `AP` is undefined)   | `src/react/services/routing/Link.tsx:8`       |
| 4   | Field loading gates on `config.host === 'jira' \|\| hasAccessToken()`                                                                            | `src/jira-oidc-helpers/fields.ts:68`          |
| 5   | Web storage detects "logged out preview mode" by reading `accessToken`/`scopeId` out of `localStorage` — a host concern inside a storage backend | `src/jira/storage/index.web.ts:43-48`         |
| 6   | `mainHelper` hides the login button and fires a temporary `hosted`-only telemetry POST by branching on `host`                                    | `src/shared/main-helper.js:51-63`, `:164-166` |

Leak 3 is the only one that's actively a bug generator: a module-scope constant means the value is
baked at import time, which is why it can't be tested and why Storybook renders it differently.

## The compatibility layer

One port, three adapters, chosen at build time by the entry module — the pattern the repo already
uses for `plugin.main.ts` / `web.main.ts`, just widened and named.

```ts
export interface HostAdapter {
  readonly kind: 'web' | 'connect' | 'forge';

  request: RequestHelper; // (urlFragment, options) => Promise<json>
  auth: AuthPort; // isAuthenticated / login / logout / cloudId
  storage: AppStorage; // unchanged from src/jira/storage/common.ts
  history: HistoryPort; // read + mirror the host's URL
  navigation: NavigationPort; // openExternal, buildDeepLink
  licensing: () => Promise<LicensingInformation>;
  chrome: { showSidebarBranding: boolean; showLoginButton: boolean };
}
```

Full definition, the per-host implementation of every method, and how each of the six leaks resolves
into it: **[host-adapter.md](./host-adapter.md)**.

Two design notes worth surfacing here:

- **`request` is the keystone.** Every Jira call in the app already goes through
  `config.requestHelper` with a bare fragment — `/api/3/search/jql`, `/agile/1.0/sprint/{id}`,
  `/api/3/field` (`src/jira-oidc-helpers/jira.ts:38-262`). Forge's `requestJira` takes exactly that
  shape and returns a WHATWG `Response`, which makes the Forge adapter a near-copy of the _hosted_
  one, not the Connect one. The only fragment that doesn't map is
  `https://api.atlassian.com/oauth/token/accessible-resources`, which is OAuth-only by definition.
- **`history` is the risky one.** It's a port, not a passthrough, because CanJS insists on owning
  `window.history`. The adapter's job is to reconcile inbound (host URL → `window.location.search`,
  before `route.start()`) and mirror outbound (patched `history.pushState` → host). That is
  precisely what `src/routing/index.plugin.ts` does for Connect today.

## Storage, and spec/020

[spec/020](../020-report-and-team-data/plan.md) Phase 3 already separates _how we talk to Jira_
(build-time host choice) from _where the data sits_ (a runtime `storage-config` pointer). Forge slots
into the first axis without touching the second. The combinations:

| Where data lives                                | web | connect     | forge                                         |
| ----------------------------------------------- | --- | ----------- | --------------------------------------------- |
| Config-issue code block (today's web backend)   | ✅  | ✅ (unused) | ✅ **works as-is, no resolver**               |
| Connect app property (today's embedded backend) | ❌  | ✅          | ❌ Connect-only REST resource                 |
| Forge KVS — 240 KiB/value                       | ❌  | ❌          | ✅ but needs a `function` module + `invoke()` |
| Jira project records (spec/020 Phase 4)         | ✅  | ✅          | ✅ **no resolver**                            |

Three conclusions:

1. **Forge's day-one bootstrap backend is the existing config-issue backend.** No new storage code,
   no Forge function, no resolver. It inherits the ~32 KB shared ceiling, which is exactly the
   problem spec/020 Phase 1 is already fixing for everyone.
2. **Forge KVS is a real upgrade** (240 KiB per value vs. 32 KB per key) but it costs the app its
   first backend function, and it's Forge-only — so it can't be the shared path. Treat it as an
   optional fourth backend behind the same pointer, not as the migration target.
3. **Doing spec/020 Phases 4–5 first materially de-risks this project.** Atlassian is explicit that
   a Forge app and a Connect app "have no direct communication path… although they may share data
   via entity or content properties." Data in Connect **app properties** may not survive the jump;
   data in **Jira issues** is host-independent by construction. Migrating customers onto
   issue-backed storage while the Connect app still runs turns the Forge cutover from a data
   migration into a code deploy.

**This is the sequencing recommendation:** spec/020 Phase 1 → Phase 2 → Phase 4/5, after which Forge
Phase B3 below reduces to "point the factory at the same record store."

## Phases

### Phase A — Forge manifest wrapping the Connect descriptor (do this now)

Not part of the compatibility layer; unblocks Marketplace releases. Generate `manifest.yml` with the
two `generalPages` and one `jiraProjectPages` module moved into `connectModules`, alongside
`core:connectToForgeMigration`. The existing `scripts/atlassian-connect/index.ts` already templates
the descriptor per environment — extend it rather than hand-writing YAML.

**Done when:** `forge deploy` succeeds, the staging install renders the existing app unchanged, and a
Marketplace version can be submitted.

### Phase B0 — Spike (2–3 days, before committing to B)

Six questions, all answerable in a scratch app against a real site. Each one changes a later phase:

1. Does the production bundle render under Forge's CSP? Atlaskit is Emotion-based, so this is really
   "does `content.styles: [unsafe-inline]` cover it" — plus whether anything needs `unsafe-eval`.
2. Does `requestJira('/rest/api/3/search/jql?…')` behave identically to the hosted path for the
   app's real fragments, including the 400/403 error shapes `responseToJSON` expects?
3. Does `view.createHistory()` round-trip a **long** query string? Report state can run to hundreds
   of characters; the docs only demonstrate pathnames.
4. Does CanJS's `RoutePushstate` operate normally on the iframe's own `window.history` under the
   sandbox, so the mirror pattern from `index.plugin.ts` transfers?
5. Can the Forge app read Connect-era app properties at
   `/rest/atlassian-connect/1/addons/{addonKey}/properties/{key}`? **This is the data-migration
   question** — see Risks.
6. Does `localStorage` work? (Expected yes — the sandbox includes `allow-same-origin` — but 12
   modules depend on it, so confirm rather than assume.)

**Done when:** a findings note in this folder answers all six, and Phase B4's design is decided.

### Phase B1 — Formalize the host adapter (~1–1.5 weeks)

Pure refactor, no Forge. Introduce `HostAdapter`, move `requestHelper` into it, close all six leaks,
and rewrite `plugin.main.ts` / `web.main.ts` as adapter constructions. Both existing hosts must be
observably unchanged.

**Done when:** `grep -r "host === " src/` returns nothing outside the adapter modules, `AP` appears
only in `src/host/connect/`, and the existing test suite passes untouched.

### Phase B2 — Forge shell (~3–5 days)

`manifest.yml` with `jira:globalPage` + `jira:projectPage`, `src/forge.main.ts` + `forge.html` as a
third build input, `forge tunnel` in the dev script, and the CSP/egress permissions the spike
identified. Scopes: `read:jira-work`, `write:jira-work` (matching `VITE_JIRA_SCOPE`) — Connect's
coarse `["read","write"]` doesn't carry over.

`resources.path` cannot point at `dist/`: it's 806 files and 60 MB against a 500-file cap, because
`tsconfig.json:7` sets `"outDir": "./dist"` with no `noEmit` (so `npm run typecheck` dumps ~700
compiled modules there) and `vite.dev.config.ts` sets `emptyOutDir: false` (so they never get
cleared). Build the Forge target into its own directory. Details in
[platform-constraints.md § Static resource quotas](./platform-constraints.md#static-resource-quotas).

**Done when:** the app boots inside Forge and renders a report from mock data.

### Phase B3 — Request, auth, storage adapters (~2–4 days)

`requestJira` wrapper; auth becomes the trivial always-logged-in implementation (no OAuth, no site
picker, no refresh, `cloudId` from `view.getContext()`); storage reuses the config-issue backend.

**Done when:** a real report loads from a real site, and saving a report round-trips.

### Phase B4 — Routing (~3–5 days, highest risk)

The `view.createHistory()` mirror. Inbound reconcile before `route.start()`, outbound mirror on
`pushState`, `location.search` as the transport.

**Done when:** a shared report URL opens the right report after a full page reload, browser back
moves between report states, and the legacy-param rewrite (`migrateUrlParams`) still lands in the
right order.

### Phase B5 — Externalities (~3–5 days)

34 `target="_blank"` / `window.open` sites move to a `navigation.openExternal` port backed by
`router.open()`. Decide per-item on Sentry (declare `external.fetch.client` egress), GTM/gtag
(recommend dropping for Forge — it's an analytics egress declaration plus a privacy-review
conversation), and Poppins (self-host instead of `fonts.googleapis.com`). Confirm the CSV export in
`EstimationProgress.tsx:309-314` still downloads — the sandbox allows it, but only on a user gesture.

**Done when:** no console CSP violations on any report type, and every external link opens.

### Phase B6 — Licensing, migration, listing

`view.getContext().license.active` replaces the `AP.request` licensing probe — note it's `undefined`
in dev/staging and for free apps, so the "no license object" case must mean _allowed_, matching
today's staging/local bypass in `plugin.main.ts:17`. Then: Connect module removal, data migration
per the Phase B0 spike, Marketplace release.

## Effort

| Phase                     | Estimate                | Confidence                                      |
| ------------------------- | ----------------------- | ----------------------------------------------- |
| A — manifest wrap         | 1–2 days                | High                                            |
| B0 — spike                | 2–3 days                | High                                            |
| B1 — host adapter         | 1–1.5 weeks             | High — mechanical, well-bounded                 |
| B2 — Forge shell          | 3–5 days                | Medium — build/deploy plumbing always surprises |
| B3 — request/auth/storage | 2–4 days                | High                                            |
| B4 — routing              | 3–5 days                | **Low** — CanJS + a 15 MB vendored bundle       |
| B5 — externalities        | 3–5 days                | Medium                                          |
| B6 — licensing/migration  | 1–2 weeks               | Low — mostly not code                           |
| **Total (B)**             | **~5–7 engineer-weeks** |                                                 |

Phase B1 is worth doing on its own merits even if Forge is deferred: it's the refactor that stops
the two existing hosts from drifting.

## Risks

| Risk                                                                              | Mitigation                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connect-era app-property data is unreachable from the Forge app**               | Spike question 5. Fallback: complete spec/020 Phases 4–5 first so customer data lives in Jira issues, which both hosts can read                                                                                                                                                                       |
| CanJS's URL ownership doesn't survive the Forge history mirror                    | Spike question 4 answers this before B1 starts. The Connect mirror is the existence proof; if it fails, B4 becomes "finish the react-rewrite keystone first" and the estimate doubles                                                                                                                 |
| Forge CSP breaks Atlaskit or the JQL editor                                       | Spike question 1. `content.styles: [unsafe-inline]` is the documented escape hatch and is widely used                                                                                                                                                                                                 |
| Resource quota — `dist/` is 806 files / 60 MB against a 500-file, 150 MB paid cap | Real but shallow: 27 MB is the unminified dev build and ~700 files are `tsc` transpile spill from `outDir: ./dist`. Phase B2 needs a curated resource directory (~75 files / 29 MB), not a bundle diet. The 15 MB main chunk is still slow on Forge's CDN — a pre-existing problem this makes visible |
| Q4 2026 arrives before B lands                                                    | Phase A decouples the two. A Connect-modules-in-a-Forge-manifest app keeps shipping and keeps working; it just stops receiving platform guarantees                                                                                                                                                    |
| Three hosts, one test suite                                                       | The contract suite spec/020 Phase 2 introduces for storage is the right model — extend it to the `HostAdapter` port so all three adapters are tested against the same cases                                                                                                                           |
| Losing the website build                                                          | Non-negotiable requirement here: `kind: 'web'` stays a first-class adapter. Forge is additive                                                                                                                                                                                                         |

## Open questions

1. **Is the Marketplace listing currently blocked from updates?** Phase Two enforced in March 2026
   and there's no `manifest.yml` in this repo. If releases have been going out, something is in place
   outside this repo and this document's Phase A needs rewriting.
2. **Can the Forge app read Connect app properties?** Determines whether customers on the embedded
   app lose their saved reports at cutover. Highest-value spike question.
3. **Does the website build stay?** Forge only serves embedded users. The OAuth website, its express
   server, and `SelectCloud` remain the only path for anyone not installing from the Marketplace.
   Assumed yes; if it's ever retired, roughly a third of B1's scope evaporates.
4. **GTM and Sentry inside a Forge iframe** — a data-egress declaration customers can see in the
   install screen. Product call, not an engineering one.
5. **One codebase or two entry points?** This document assumes one repo, three entries. The
   alternative — a separate Forge repo consuming the app as a package — is worse for exactly the
   reason the compatibility layer exists.

## Sources

- [Announcing Connect End of Support: Timeline and Next Steps](https://www.atlassian.com/blog/developer/announcing-connect-end-of-support-timeline-and-next-steps)
- [Adopting Forge from Connect](https://developer.atlassian.com/platform/adopting-forge-from-connect/)
- [Redirecting URLs from Connect to Forge](https://developer.atlassian.com/platform/adopting-forge-from-connect/migrate-page-module-urls/)
- [Forge bridge: view](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/) ·
  [requestJira](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/requestJira/) ·
  [router](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/router/)
- [Custom UI iframe](https://developer.atlassian.com/platform/forge/custom-ui/iframe/) ·
  [Manifest permissions](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/) ·
  [KVS and Custom Entity Store limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/)
