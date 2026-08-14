# Forge platform constraints

Researched August 2026. Everything here is from Atlassian's docs and is stated with a source; the
things that are _not_ documented are called out as such, and each one maps to a spike question in
[README.md § Phase B0](./README.md#phase-b0--spike-23-days-before-committing-to-b).

## The Connect timeline

Three phases, from [Announcing Connect End of Support](https://www.atlassian.com/blog/developer/announcing-connect-end-of-support-timeline-and-next-steps):

| Phase                                   | Notice      | **Enforced** | Effect                                                                              |
| --------------------------------------- | ----------- | ------------ | ----------------------------------------------------------------------------------- |
| 1 — no new Connect apps                 | Mar 17 2025 | Sep 17 2025  | New Marketplace apps must be Forge                                                  |
| 2 — no updates via a Connect descriptor | Sep 2025    | **Mar 2026** | A Marketplace app with a Connect descriptor **can no longer be updated**            |
| 3 — end of support                      | Q4 2025     | **Q4 2026**  | Connect modules keep running "at your own risk"; no patches, no platform guarantees |

Two clarifications that shape the plan:

- Phase 2 is satisfied by **adopting a Forge manifest**, not by rewriting: "apps using Connect
  modules will still be able to receive updates, as long as they have adopted the Forge manifest."
- But that doesn't make it a Forge app: "an app that has a Forge manifest and a mix of Connect and
  Forge modules will be considered a Connect app until all Connect modules are removed."

Incremental adoption is available for Jira and Confluence Marketplace-listed Connect apps (not
Bitbucket), and the app "will keep its existing listing with its reviews and installations."
— [Adopting Forge from Connect](https://developer.atlassian.com/platform/adopting-forge-from-connect/)

## The Custom UI iframe

Static resources are bundled and hosted by Atlassian; the app renders in a sandboxed iframe on an
`*.atlassian-dev.net` origin. — [Custom UI](https://developer.atlassian.com/platform/forge/custom-ui/)

**Sandbox attributes granted** ([Custom UI iframe](https://developer.atlassian.com/platform/forge/custom-ui/iframe/)):

`allow-downloads` · `allow-forms` · `allow-modals` · `allow-pointer-lock` · `allow-same-origin` ·
`allow-scripts`

What that means for this app:

|                                |                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allow-same-origin` is present | **`localStorage` / `sessionStorage` / cookies work.** Twelve modules depend on this (`useLocalStorage`, `useRecentReports`, `state-storage.js`, the OAuth helpers, `feature-flag.js`). Without the flag they'd throw `SecurityError`. Confirm in the spike anyway. |
| `allow-popups` is **absent**   | `window.open()` and `<a target="_blank">` are blocked — the docs say scripts may run "but not create pop-up windows". 34 call sites in `src/` are affected. Use `router.open()` from `@forge/bridge`.                                                              |
| `allow-downloads` is present   | The CSV export (`EstimationProgress.tsx:309-314`, `createObjectURL` + `link.click()`) works, but only from a user gesture.                                                                                                                                         |
| `allow-modals` is present      | Atlaskit modals are React, not `window.confirm`, so this is moot either way.                                                                                                                                                                                       |

Feature policies additionally restrict camera, microphone, clipboard-write, display-capture and
fullscreen. None are used here.

## CSP and external egress

A restrictive CSP applies by default: no external scripts or assets, no inline scripts, no direct
network calls from static assets. Relaxations are declared in the manifest and are visible to the
customer at install time.
— [Manifest permissions](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/)

| Manifest key                         | CSP directive           | Needed here for                                                                    |
| ------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------- |
| `content.styles: [unsafe-inline]`    | `style-src`             | **Atlaskit** — it's Emotion-based and injects styles at runtime. Assume required.  |
| `content.scripts`                    | `script-src`            | Only if something needs `unsafe-eval` / `unsafe-hashes`. Check the JQL editor.     |
| `external.fetch.client`              | `connect-src`           | Sentry (`sentry.io`), and the temporary `VITE_AUTH_SERVER_URL` POST if it survives |
| `external.scripts`                   | `script-src`            | Google Tag Manager / gtag — recommend dropping instead                             |
| `external.fonts` + `external.styles` | `font-src`, `style-src` | Poppins from `fonts.googleapis.com` — self-hosting is simpler than declaring both  |
| `external.images`                    | `img-src`               | Custom logos users upload for report branding, if they're remote URLs              |

`external.fetch.backend` is for Forge functions. This app has none.

```yaml
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
  content:
    styles: ['unsafe-inline']
  external:
    fetch:
      client:
        - address: 'https://*.ingest.sentry.io'
          category: analytics
```

Scopes: the Connect descriptor's coarse `["read", "write"]`
(`scripts/atlassian-connect/base-connect.json:11`) has no Forge equivalent. Use the granular scopes
the website already requests — `VITE_JIRA_SCOPE="read:jira-work write:jira-work offline_access"` —
minus `offline_access`, which is OAuth-only.

## Static resource quotas

There are **two** separate limit sets, and conflating them overstates the problem.

**Structural limits** — hard ceilings on what a resource bundle may contain, identical across
environments and app tiers.
— [Resource limits](https://developer.atlassian.com/platform/forge/limits-resource/)

|                         |               |
| ----------------------- | ------------- |
| Files per bundle        | 5,000         |
| Size per bundle         | 100 MB        |
| Bundles per app         | 50            |
| Cumulative files / size | 25,000 / 1 GB |

**Weekly production upload quota** — metered per deployment to _production_ only. Development and
staging are unmetered.
— [Custom UI](https://developer.atlassian.com/platform/forge/custom-ui/)

|                     | Paid   | Free / distributed |
| ------------------- | ------ | ------------------ |
| Total file capacity | 150 MB | 75 MB              |
| Files per upload    | 500    | 250                |

**`dist/` as it stands today clears the structural limits comfortably** (806 files / 60 MB against
5,000 / 100 MB) and is unmetered in development, so it is not the blocker an earlier draft of this
document implied. It would, however, consume the entire weekly production allowance in one deploy,
and it is a cold-load problem regardless — for three reasons, none of them about the app itself:

| What's in `dist/`                                                 | Files | Size   | Ships to Forge? |
| ----------------------------------------------------------------- | ----- | ------ | --------------- |
| `assets/`, minus the dev chunks — Vite production output          | ~60   | 26 MB  | Yes             |
| `assets/dev-*` — unminified dev build with inline sourcemaps      | ~9    | 27 MB  | **No**          |
| `react/`, `jira/`, `utils/`, … — `tsc` transpile spill            | ~700  | 3.6 MB | **No**          |
| `examples/`, `images/`, `production.css`, entry HTML, canjs shims | ~37   | 3 MB   | Yes             |

The `tsc` spill is the surprising one: `tsconfig.json:7` sets `"outDir": "./dist"` with no
`noEmit`, so `npm run typecheck` writes ~700 compiled modules into the build directory, and
`vite.dev.config.ts` sets `emptyOutDir: false` so nothing ever clears them.

The build therefore needs a dedicated, clean resource directory rather than pointing
`resources.path` at `dist/`. Once curated it's roughly **75 files / 29 MB** — inside the paid weekly
quota, tight against the free one. Separately, `index-*.js` alone is 15 MB, which is a load-time
problem on Forge's CDN in the same way it's a load-time problem today, just more visible.

## Calling Jira

`requestJira(uri, options?) => Promise<Response>` from `@forge/bridge` (v2.0+), available in Custom UI
and UI Kit. — [requestJira](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/requestJira/)

- Runs **as the current user**. There is no frontend `asApp()`.
- Accepts any Jira Cloud platform REST path, so the app's existing fragments (`/api/3/search/jql`,
  `/agile/1.0/sprint/{id}`, `/api/3/field`, `/api/3/issue/{id}`) map 1:1 onto `/rest` + fragment.
- Returns a WHATWG `Response`, so `responseToJSON` works unchanged.
- The user needs the Jira permission for the operation _in addition_ to the app's scopes; otherwise
  403 even with correct scopes.

`api.atlassian.com/oauth/token/accessible-resources` — the only non-Jira fragment the app requests
(`jira.ts:38`) — is OAuth-specific and simply doesn't exist on Forge. The cloud ID comes from
`view.getContext()` instead, and the site picker (`SelectCloud`) has no meaning.

## Routing

`view.createHistory()` returns a history object (`push`, `replace`, `go`, `goBack`, `goForward`,
`listen`, `action`, `location`) whose `location` carries `pathname`, `search`, `hash` and `state`,
relative to the app's URL. Available in full-page modules across Jira, Confluence, Bitbucket and
Compass. — [view](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/)

`location.search` **is** populated — Atlassian's own Connect-redirect guide reads the
`x_atlassian_cf` param out of it with `new URLSearchParams(location.search)`.
— [Redirecting URLs from Connect to Forge](https://developer.atlassian.com/platform/adopting-forge-from-connect/migrate-page-module-urls/)

Not documented, hence spike question 3: **whether a long query string round-trips**. The examples are
all short pathnames, and this app's URLs are neither.

Also from that page: old Connect bookmarks
(`{baseUrl}/plugins/servlet/ac/{appKey}/{moduleKey}?…`) are redirected to the Forge module URL with
the original path, query and fragment base64-encoded into `x_atlassian_cf`. Every report link a
customer has ever shared goes through that path, so decoding it is a real Phase B4 requirement, not a
nicety.

`router.navigate(url)` moves the host page; `router.open(url)` opens a new tab.
— [router](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/router/)

## Storage

Four options. — [Storage API](https://developer.atlassian.com/platform/forge/runtime-reference/storage-api/)

**Key-Value Store** ([limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/)):

|                           |                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| Max key length            | 500 chars, `^(?!\s+$)[a-zA-Z0-9:._\s-#]+$`                                      |
| **Max value size**        | **240 KiB**                                                                     |
| Rate                      | 1,000 RPS; 4,000 reads/min and 4,000 writes/min per installation (10 KB sizing) |
| Retention after uninstall | 28 days                                                                         |

240 KiB vs. the 32 KB the app lives with today is a ~7× headroom increase — but it's Forge-only, and
it's server-side: `@forge/kvs` runs in a function, so Custom UI reaches it through `invoke()`. That
means a `function` module and a resolver, which this app otherwise doesn't need at all.

**Custom Entity Store**: 20 entities per app, 7 indexes and 50 attributes each, 100 conditions per
query, 25 operations / 4 MB per transaction. Genuinely record-oriented — the natural Forge answer to
spec/020's `RecordStore` — and also resolver-bound and Forge-only.

**App properties**: Forge apps use `/rest/forge/1/app/properties/{key}` and it is `asApp()`-only,
i.e. also resolver-bound. Connect's `/rest/atlassian-connect/1/addons/{addonKey}/properties/{key}`
is a different resource.

**Spike question 5 is answered, conditionally.** A Forge app _can_ access Connect app properties —
but only "as long as they are stored against the same `app.connect.key`."
— [Extending your app with Forge](https://developer.atlassian.com/platform/adopting-forge-from-connect/extending-your-app/)

So the answer turns entirely on app identity:

| Path                                                                     | Connect-era app properties |
| ------------------------------------------------------------------------ | -------------------------- |
| Adopt the existing Connect app (`app.connect.key: bitovi.status-report`) | Readable                   |
| Register a brand-new standalone Forge app                                | **Unreachable**            |

[plan.md](./plan.md) takes the second path deliberately, which means Connect users' saved settings
do not carry over to the Forge host. That is the main thing the standalone decision trades away,
and the reason to revisit identity if Forge ever becomes the shipping app rather than a third host.

What Atlassian _does_ say about sharing data across the boundary: an app "has no direct communication
path between the Forge and Connect parts, although they may share data via entity or content
properties." That's the argument for landing [spec/020](../020-report-and-team-data/plan.md)'s
issue-backed storage before the Forge cutover — issue and entity properties are reachable from both
worlds via `requestJira`, with no resolver on either side.

## Licensing

`view.getContext()` returns `{ accountId, cloudId, extension, license?, localId, locale, moduleKey,
siteUrl, timezone }`, with `license: { active, isEvaluation, type, billingPeriod, trialEndDate, … }`.
— [view](https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/view/)

**`license` is `undefined` for free apps, unlisted apps, and anything in development or staging.**
The current Connect implementation already has the equivalent bypass — it returns
`{active: true, evaluation: true}` when the app key contains `staging` or `local`
(`plugin.main.ts:17`) — so the Forge port is "absent license object means allowed", which happens to
be both correct and simpler.

## Confirmed vs. unverified

| Claim                                                                   | Status                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `localStorage` works (sandbox has `allow-same-origin`)                  | Documented; verify on first boot                                                                                                   |
| `window.open` blocked (no `allow-popups`)                               | Documented                                                                                                                         |
| `requestJira` accepts arbitrary Jira REST paths as the current user     | Documented                                                                                                                         |
| `location.search` exists on the Forge history object                    | Documented (used by Atlassian's own migration guide)                                                                               |
| A Forge app can read Connect-era app properties                         | **Documented — but only with a shared `app.connect.key`.** See § Storage. Moot for the standalone app [plan.md](./plan.md) builds. |
| Long query strings round-trip through Forge history                     | **Unverified** — [plan.md](./plan.md) Phase 4 tests this first                                                                     |
| Atlaskit renders under Forge CSP with `content.styles: [unsafe-inline]` | **Unverified** — surfaces in Phase 1                                                                                               |
| CanJS `RoutePushstate` works on the iframe's own history                | **Unverified** — surfaces in Phase 4                                                                                               |
