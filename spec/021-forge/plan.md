# Plan: adding Forge as a third host

The cut-down path to a **working** Forge app, and where it departs from the design in
[README.md](./README.md) and [host-adapter.md](./host-adapter.md).

> **Who does what.** Every step below is tagged:
>
> - 🤖 **AI** — code, config and docs. No Atlassian account needed.
> - 👤 **You** — anything requiring Atlassian credentials, a browser, or a decision: `forge login`,
>   `forge register`, `forge deploy`, `forge install`, and approving permission changes.
>
> The split is not arbitrary. The Forge CLI authenticates as _a person_, and `forge register` binds
> the app to your Atlassian account. Everything CLI stays with you.

## Context

The app runs on two hosts today: the standalone OAuth website (`src/web.main.ts`) and the embedded
Connect app (`src/plugin.main.ts`). We want a third — a Forge Custom UI app — that genuinely works:
installs on a real Jira site, renders real reports, saves, and survives a page refresh.

[README.md](./README.md) scoped this at ~5–7 engineer-weeks and framed it around Marketplace and
Connect end-of-support deadlines. **Those deadlines are not the driver here**, and neither is a
Marketplace release. Phase A (wrapping the Connect descriptor in a Forge manifest) exists only to
unblock Marketplace updates and is therefore **not part of this plan**.

### Decisions taken

|                  | Decision                                                | Consequence                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **App identity** | Brand-new standalone Forge app                          | `forge register` mints a fresh key. Cannot read Connect-era app properties, so Connect users' saved settings won't carry over. Nothing irreversible — the key only becomes permanent on first _production_ deploy. |
| **Architecture** | Bolt on a third host                                    | New `forge.main.ts` mirroring `plugin.main.ts`. Defers the `HostAdapter` port. Leaves three parallel host implementations.                                                                                         |
| **Done means**   | Boots + reads + writes + **URL state survives refresh** | Includes the `view.createHistory()` mirror (Phase 4), the lowest-confidence item.                                                                                                                                  |

### What Forge changes, in one line

Atlassian hosts your built assets instead of your server. `AP` — the global injected by Connect's
`all.js` — is replaced by the `@forge/bridge` npm package; a strict CSP blocks external assets
unless declared in `manifest.yml`; and the iframe sandbox omits `allow-popups`, so `window.open`
and `target="_blank"` are inert. See [platform-constraints.md](./platform-constraints.md).

---

## How this repo deploys today, and where Forge fits

**Web and Connect are the same deployment.** One build produces one `dist/`, which goes to S3 +
CloudFront. `index.html` is the website; `connect.html` is the Connect iframe; both are served from
the same bucket. `public/atlassian-connect.json` — regenerated at build time by
`npm run create:atlassian-connect` — ships in that same `dist/` and is what Jira reads at
`statusreports.bitovi.com/atlassian-connect.json`.

|                                     | Trigger                  | Builds                                                             | Deploys to                                                                              |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Staging** (`deploy-staging.yaml`) | push to `main`           | `create:atlassian-connect --environment=staging` + `npm run build` | S3/CloudFront → `statusreports-staging.bitovi.com`, plus the express auth server on EC2 |
| **Production** (`deploy-prod.yaml`) | GitHub release published | same, `--environment=production`                                   | S3/CloudFront → `statusreports.bitovi.com`, plus EC2                                    |

So shipping a new **Connect** version is just publishing static assets — Jira loads the new code on
the next iframe open. Only a _descriptor_ change (new modules, changed URLs) needs Atlassian to
re-fetch `atlassian-connect.json`.

**Forge does not use any of this.** No S3, no CloudFront, no EC2 — `forge deploy` uploads the built
assets to Atlassian, who serve them. It is a fourth, independent deployment path that happens to
build from the same repo. The express auth server stays exactly as it is; it exists for the
website's OAuth token exchange, which Forge does not use.

### Shipping subsequent Forge versions

| Situation                                  | What happens                                                                                                                                                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code-only change (the common case)         | `forge deploy` → existing installs pick it up automatically. No admin action.                                                                                                                                                               |
| Manifest adds scopes or egress permissions | Becomes a **major version**. `forge deploy` refuses until you pass `--approve MAJOR_VERSION_RULE`, and installs keep running on the _old_ permission set until an admin approves — via `forge install --upgrade` or the Manage apps screen. |

That second row is the one to plan around: adding a scope is not a silent deploy. Worth getting the
scope list right in Phase 1 rather than discovering it later.

**Environments** are `development` (default), `staging`, `production`. Development and staging
deploys are unmetered; only production draws on the weekly upload quota.

**CI happens in two stages** — manual while Forge is unproven, then folded into the existing
workflows once it is. See [Phase 7](#phase-7--ci-in-two-stages). The end state is that one push to
`main` deploys all three hosts, so they cannot drift.

---

## Prerequisites

**👤 You:**

1. A Jira Cloud site you can install apps on. A free `<name>.atlassian.net` is fine.
2. An Atlassian API token — <https://id.atlassian.com/manage-profile/security/api-tokens>
3. ```bash
   npm i -g @forge/cli
   forge login          # email + API token
   ```
4. The first `forge register` prompts you to accept Forge developer terms in the browser. One time.

The developer console (<https://developer.atlassian.com/console>) is where the app appears once
registered — useful for logs and install counts, not required to work in.

---

## Phase 1 — Scaffolding and a first deploy (~2–3 hrs)

Goal: an empty-but-real Forge module opens in Jira. Do this **first** — you need it installed to
test anything, and it surfaces CSP problems immediately.

### 🤖 AI

**Dependencies:** `@forge/bridge` (prod), `@forge/cli` (dev).

**`manifest.yml`** at the repo root. No `resolver` and no `function` module — this app needs no
backend, which is what makes day-one Forge storage free:

```yaml
modules:
  jira:globalPage:
    - key: status-reports-global
      resource: main
      title: Status Reports for Jira
      layout: blank
  jira:projectPage:
    - key: status-reports-project
      resource: main
      title: Status Reports for Jira
      layout: blank

resources:
  - key: main
    path: dist-forge
    tunnel:
      port: 5173 # lets `forge tunnel` proxy to the Vite dev server

permissions:
  scopes:
    - read:jira-work
    - write:jira-work
  content:
    styles:
      - unsafe-inline # Atlaskit is Emotion-based and injects styles at runtime
```

Scopes come from `VITE_JIRA_SCOPE` in `.env.example`, minus `offline_access` (OAuth-only).
Connect's coarse `["read","write"]` has no Forge equivalent. Get this list right now — adding a
scope later forces a major-version upgrade that admins must approve.

**Forge entry HTML.** Mirror `connect.html`, but:

- drop `all.js` (no `AP` on Forge), Google Tag Manager, gtag, and the Google Fonts `<link>`
- keep the `#mainContent` / `#login` / `#loadingJira` divs — `src/shared/main-helper.js:144,163,169`
  reaches for those IDs as implicit globals
- reference assets **relatively** (`./production.css`); Forge serves from a path prefix

Forge expects `index.html` at the root of `resources.path`, so the cleanest wiring is a dedicated
source dir (`forge/index.html`) with its own Vite config using `root: 'forge'`, `base: './'`,
`build.outDir: '../dist-forge'`, `emptyOutDir: true`.

**Do not point `resources.path` at `dist/`.** It carries ~700 `tsc` transpile artifacts
(`tsconfig.json:7` sets `outDir: ./dist` with no `noEmit`) plus a 27 MB unminified dev build that
`vite.dev.config.ts` never clears (`emptyOutDir: false`). It clears the structural quota but wastes
the production weekly upload allowance and slows cold loads.

**Tailwind:** `build:css` writes to `dist/production.css`. Add a Forge variant writing into
`dist-forge/`, or copy as a post-build step.

**npm scripts:** `build:forge`, `dev:forge`, `deploy:forge`.

### 👤 You

```bash
forge register                       # pick a name; writes app.id into manifest.yml — commit it
npm run build:forge
forge deploy                         # development environment
forge install --site <you>.atlassian.net --product jira
```

`forge install` prints the scopes and asks you to confirm.

✅ **Checkpoint:** the module appears in Jira's app nav and opens. Blank is fine.

---

## Phase 2 — Host wiring (~2–3 hrs) — 🤖 AI

**Widen the host type.** `src/jira-oidc-helpers/types.ts:100` — `host: 'jira' | 'hosted'` becomes a
named `Host` type including `'forge'`. Threads through `src/jira-oidc-helpers/index.ts:63`.

**Request helper** — `src/request-helpers/forge-request-helper.ts`. Modelled on the _hosted_
helper, not the Connect one: `requestJira` resolves to a WHATWG `Response`, so the existing
`responseToJSON` (`src/utils/fetch/response-to-json.ts`) drops straight in. Connect is the odd host
— it resolves `{body: string}` and rejects with `{err}` holding a JSON _string_, which is why
`connect-request-helper.js` hand-rolls its parsing.

Callers pass bare fragments (`api/3/search/jql`), so the only transform is prefixing `/rest/`.
Normalize the pre-existing leading-slash inconsistency here — `'/api/3/serverInfo'`
(`serverInfo.ts:8`) vs `'api/3/search/approximate-count'` — rather than fixing 12 call sites.
Absolute URLs should throw: the only one the app issues is
`api.atlassian.com/oauth/token/accessible-resources`, which is OAuth-only and meaningless on Forge.

**Storage — reuse, don't duplicate.** `createWebAppStorage` (`src/jira/storage/index.web.ts`) is
already host-neutral; it touches Jira only through `fetchJiraIssuesWithJQLWithNamedFields` and
`editJiraIssueWithNamedFields`. Its one host-specific line is a private localStorage token check
(`:24-30`) detecting logged-out preview mode. Make that an injected predicate, then export two
factories from the same implementation — web passes the localStorage check, Forge passes
`() => true` (Jira authenticates the iframe). This is leak #5, closed for a few lines.

This means a Forge site needs a configuration work item, same as the web app — that's also where
the `storage-config` pointer from [spec/026](../026-storage-saved-reports/plan.md) lives. See
[Saved-reports storage on Forge](#saved-reports-storage-on-forge-spec026) below, which is the part
of this that is _not_ just "reuse the web factory".

**Routing + link builder** — `src/routing/index.forge.ts`. Phase 4 fills in the history mirror; for
now a link builder returning the query string unchanged (like `createWebLinkBuilder`) is enough.

**Licensing** — `view.getContext()` returns `license`, which is `undefined` for free apps and for
anything in development or staging. So _absent license object must mean allowed_, matching the
existing Connect bypass at `plugin.main.ts:17`.

**`src/forge.main.ts`** — mirrors `plugin.main.ts`: `host: 'forge'`, `isAlwaysLoggedIn: true`,
`showSidebarBranding: true`.

**Two small `src/shared/main-helper.js` edits:**

- `:44` picks the request helper by branching on `host`. Pass `createRequestHelper` in the host
  object instead — three lines, and it closes leak #1 for free.
- `:176` hides the login button on `host === 'jira'`. Becomes `host !== 'hosted'`.

`#select-cloud` is absent from the Forge HTML, so the site picker no-ops on its own (`:120`).

**Sentry** disables itself — `initSentry` sets `enabled: !!FRONTEND_SENTRY_DSN`
(`src/shared/sentry.js:14`), so leaving `VITE_FRONTEND_SENTRY_DSN` unset for the Forge build needs
no egress declaration.

---

## Saved-reports storage on Forge (spec/026)

[spec/026](../026-storage-saved-reports/plan.md) put Forge out of scope by name ("Out: Forge (see
spec/021)", § Scope) and deferred it here, so this section is the missing half rather than a
restatement. Read against the shipped code, the split is clean: **the reports survive the Forge jump;
the pointer that says where they live does not.**

### What needs no Forge work at all

`createSpaceReportsBackend` (`src/jira/reports/backend/space.ts`) reaches Jira through exactly three
helpers — `fetchJiraIssuesWithJQLWithNamedFields`, `createJiraIssue`, `editJiraIssueWithNamedFields`.
After Phase 3 all three go through `config.requestHelper`, so the space backend is host-neutral by
construction and needs no Forge branch. spec/026 predicted this in its own open question 3:
_"Issue-backed reports are the one storage option that survives the Forge jump unchanged."_

Two more things already landed in shared code rather than per-host:

- **`initReportsStorage` is called from `main-helper.js`**, not from the host entries. spec/026 § The
  backend seam expected it "alongside the existing `createStorage` call sites (`plugin.main.ts:49`,
  `web.main.ts:19`)"; it moved. Forge inherits it — `forge.main.ts` wires nothing. Don't go looking
  for a missing third call site.
- **Deletion is a tombstone, not a `DELETE`** (`space.ts`, `remove`). spec/026 chose that because a
  Connect app's DELETE scope is separate from `write`. The same reasoning holds on Forge —
  `write:jira-work` does not imply delete, and adding a delete scope later is a **major version**
  needing admin re-approval. So the tombstone is load-bearing for Forge too, and the scope list in
  Phase 1 stays as it is because of it.

### What does not survive: the pointer

`reports-storage-config` is written through the **per-host** `AppStorage`
(`src/jira/storage/reports-config.ts`), and the three hosts keep it in three different places:

| Host    | Pointer lives in                               | Readable by Forge?                  |
| ------- | ---------------------------------------------- | ----------------------------------- |
| Connect | app property, via `AP`                         | **No** — Connect-only REST resource |
| Web     | configuration work item                        | Yes                                 |
| Forge   | configuration work item (`createForgeStorage`) | —                                   |

The user-visible consequence, which is worth stating plainly because it will look like a bug:

> **A site already using Reports Space on Connect will open the Forge app in `legacy` mode.** The
> pointer does not come across, and Forge's `legacy` is the _configuration issue_, not Connect's app
> property — so the Forge app reads the web build's legacy store, which on a Connect-only site is
> empty. The reports are not lost; the Forge app is simply looking somewhere else.

The fix is one admin action, not a migration: open **Storage** in the Forge app's settings sidebar
and point it at the same space the Connect app uses. Both hosts then read the same work items, which
is precisely the cross-host sharing spec/026 was built for. Nothing needs copying.

That also means **the Storage panel is not optional for Forge** — without it there is no way to leave
`legacy`. See Phase 5.

### spec/026's open questions, answered for Forge

| spec/026 asks                                                                    | Forge answer                                                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q1 — does `GET /api/3/issue/createmeta/{spaceKey}/issuetypes` work on this host? | Yes, covered by `read:jira-work`.                                                                                                    |
| Q2 — does `POST /api/3/issue` work with the descriptor's scopes?                 | Yes, covered by `write:jira-work`. This was genuinely uncertain on Connect's coarse `["read","write"]`; Forge's scopes are explicit. |
| Q3 — does issue-backed storage survive Forge?                                    | Yes for the reports, no for the pointer — above.                                                                                     |

### One stale instruction to ignore

spec/026 § New Jira helpers says to add create/delete "copying the host branch in
`editJiraIssueWithNamedFields` (`:710`) — `AP.request` when `AP?.history?.getState` is present,
`fetch` otherwise." **Phase 3 deletes that branch.** Following spec/026 literally would reintroduce
the exact sniff that breaks writes on Forge. `deleteJiraIssue` was never built (tombstone instead),
so only the `createJiraIssue` half of that instruction was ever acted on.

---

## Phase 3 — The two `AP` sniffs (~1 hr) — 🤖 AI — not optional

Both ask "am I in Connect?" by probing for the `AP` global, and both answer **wrong** under Forge:
it _is_ an embedded iframe, but `AP` is undefined, so both conclude "standalone web build."

1. **`src/jira-oidc-helpers/jira.ts:765`** — `isConnectHost()`. Under Forge this routes every write
   through the OAuth path at `:774`, which builds a URL from `localStorage.scopeId` that doesn't
   exist. **Issue edits and creates fail** — and since `editJiraIssueWithNamedFields` is how all
   config-issue storage writes happen, saving is dead without this. The function's own comment calls
   it "quick and dirty"; route it through `config.requestHelper` like every other call and both
   branches disappear. (Leak #2.)

2. **`src/react/services/routing/Link.tsx:11`** — `isIFrame`, a module-scope constant baked at
   import time. The question it actually asks is "should a click be intercepted into the SPA
   router?", which is true for Connect _and_ Forge. Move it off module scope and off `AP`.
   (Leak #3 — already a live testability problem; it's why the component renders differently in
   Storybook.)

Also **`src/jira-oidc-helpers/fields.ts:68`** — `config.host === 'jira' || hasAccessToken()` becomes
`config.host !== 'hosted' || hasAccessToken()`. Left alone, `fieldsRequest` stays permanently
undefined on Forge and field lookups crash. (Leak #4.)

**👤 You:** redeploy (`npm run build:forge && forge deploy`) and try it.

✅ **Checkpoint:** a real report renders from a real site, and saving round-trips.

---

## Phase 4 — URL state (~3–4 hrs, highest risk) — 🤖 AI

CanJS owns the URL (`route.urlData = pushStateObservable`, `src/canjs/routing/state-storage.js:21`)
and every report's configuration is query-string state. A Forge iframe can't write the parent URL —
but neither can Connect's, and `src/routing/index.plugin.ts` already solves it with a two-way
mirror. Port that, substituting `view.createHistory()` for `AP.history`:

- **inbound** `reconcile()` — `forgeHistory.location.search` → `history.replaceState`, before
  `route.start()`
- **outbound** `startMirroring()` — patch `history.pushState` to echo into `forgeHistory.replace`,
  attached as `route._onStartComplete`

**Three existing ordering constraints must be preserved** (documented at `plugin.main.ts:58-67` and
`src/jira/reports/migrations/url.ts`); getting them wrong causes silent state loss:

1. `reconcile()` before the legacy-param rewrite — it replaces the _entire_ search string
2. `migrateUrlParams()` before `route.start()` — after, it's invisible to `pushStateObservable`
3. `startMirroring()` after start

**One structural difference from Connect:** `view.createHistory()` is async and `AP.history` isn't,
so the Forge entry must `await` before `configureRouting` runs. That changes the bootstrap's shape,
not just its contents.

**Test the risk in the first 30 minutes.** `location.search` is documented as populated, but no
length ceiling is stated and this app's report URLs run to hundreds of characters. Push a
representative long URL through and read it back before building the rest.

**Contingency if long strings don't round-trip:** mirror a short opaque key instead and keep the
payload in storage, resolving it on load. Costs a round trip on cold open; keeps refresh and
sharing working.

---

## Phase 5 — CSP and externalities (~2 hrs) — 🤖 AI

- **Popups.** 35 `target="_blank"` / `window.open` sites across 23 files silently do nothing under
  the Forge sandbox. The full fix is a `router.open()` indirection everywhere; day-one triage is a
  small `openExternal` helper applied to the handful of links users actually hit.
- **Poppins** — self-host rather than declaring `external.fonts` + `external.styles`.
- **GTM / gtag** — dropped from the Forge HTML in Phase 1. Re-adding means an analytics egress
  declaration customers see at install, _and_ a major-version upgrade. 👤 Product call.
- **`src/react/SettingsSidebar/components/Storage/Storage.tsx:56`** — `isConnect = jira.host ===
'jira'` drives the two-card UI from spec/026 § The panel, which assumes exactly two hosts. Forge
  makes it three. Minimum: the Forge card renders the web (configuration issue) option, since that
  is what `createForgeStorage` actually writes.
  **Not cosmetic.** Per [Saved-reports storage on Forge](#saved-reports-storage-on-forge-spec026),
  the pointer does not carry over from Connect, so this panel is the only way a Forge install can
  leave `legacy` and reach a Reports Space. Without it, a site whose reports live in a space sees an
  empty Forge app and no way to fix it.
- **CSV export** (`EstimationProgress.tsx:309-314`) should still work — the sandbox grants
  `allow-downloads` — but only from a user gesture. Verify.

---

## Phase 6 — Iterate and promote

**👤 You**, throughout:

```bash
npm run dev:forge & forge tunnel     # live reload against a real site
forge deploy                          # development
forge deploy -e staging               # when it holds together
```

`forge tunnel` serves the app from your local Vite dev server, so you get HMR inside real Jira
without redeploying. This is the loop to work in for Phases 2–5.

---

## Phase 7 — CI, in two stages

> **Superseded for the fully-Forge app by [next-steps/ci-cd.md](./next-steps/ci-cd.md).** This section was written while Forge was a
> third host alongside the website and Connect. Once Forge is the host customers use, Stage 2's
> "the Forge job must not gate the others" is backwards. The two-stage shape below still holds.

Deliberately staged: automating a deploy path that hasn't been proven by hand just moves the
debugging into GitHub Actions, where the feedback loop is minutes instead of seconds. But leaving it
manual permanently guarantees drift between the three hosts, which defeats the point of host parity.

### Stage 1 — manual (during Phases 1–6) — 👤 You

`forge deploy` from your machine, as in Phase 6. No secrets, no workflow changes. The existing
`deploy-staging.yaml` and `deploy-prod.yaml` are untouched and keep shipping web + Connect exactly
as they do today.

**Accept the drift while this lasts.** Staging S3 deploys on every push to `main`, so between manual
Forge deploys the Forge app is running older code than the website. Expect "it reproduces on staging
but not on Forge" and check the deployed Forge version before chasing it.

### Promotion gate

Move to Stage 2 once all of these hold:

- Every row of [Verification](#verification) passes on a real site
- Two or three consecutive manual `forge deploy`s have gone out uneventfully
- The scope list in `manifest.yml` has settled — no pending permission changes

### Stage 2 — fold into the existing workflows — 🤖 AI + 👤 secrets

**Not** a separate `deploy-forge.yaml`. Add a Forge job to each existing workflow so one trigger
ships all three hosts:

| Workflow              | Trigger                  | Added job                                            |
| --------------------- | ------------------------ | ---------------------------------------------------- |
| `deploy-staging.yaml` | push to `main`           | `npm run build:forge` → `forge deploy -e staging`    |
| `deploy-prod.yaml`    | GitHub release published | `npm run build:forge` → `forge deploy -e production` |

**👤 You:** add `FORGE_EMAIL` and `FORGE_API_TOKEN` as repository secrets.

**🤖 AI**, with three constraints that matter:

1. **The Forge job must not gate the others.** No existing job takes `needs:` from it. A Forge
   failure should be loud but must never block the S3 or EC2 deploys — they serve the two hosts that
   are already in production.
2. **Pin the CLI major version** (`npm i -g @forge/cli@^<major>`). An unpinned global install means
   a CLI release can break the pipeline on an unrelated day.
3. **Expect deliberate failures on permission changes.** `forge deploy` refuses a major version
   without `--approve MAJOR_VERSION_RULE`. Do _not_ add that flag to CI — a scope change should stop
   the pipeline and get a human's attention, because 👤 an admin then has to approve the upgrade
   before installs pick up the new permissions anyway.

The Forge build is a separate output directory (`dist-forge/`), so it needs its own build step and
artifact rather than reusing the `./dist` upload the existing jobs share.

---

## Verification

| Check                   | How                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module opens in Jira    | Apps menu → Status Reports for Jira                                                                                                                                     |
| No CSP violations       | Browser console, on each report type                                                                                                                                    |
| Reads real data         | A report renders from a real JQL query                                                                                                                                  |
| Fields resolve          | Settings sidebar lists real Jira fields (catches the `fields.ts` gate)                                                                                                  |
| **Writes work**         | Save a report, reload, confirm it persisted (catches `jira.ts:765`)                                                                                                     |
| Reports Space works     | Point the Forge app's Storage panel at a space the Connect app already uses; confirm the same saved reports appear in both (spec/026's cross-host claim, now three-way) |
| **URL state**           | Configure a report → refresh → same state. Copy the URL into a new tab → same report.                                                                                   |
| Existing hosts unbroken | `npm run test`, `npm run typecheck`, `npm run build`; load the web and Connect builds                                                                                   |

The last row matters most — Phases 2 and 3 touch shared code (`main-helper.js`, `jira.ts`,
`Link.tsx`, `fields.ts`, `index.web.ts`) that both shipping hosts depend on. Staging deploys on
every push to `main`, so a regression there ships to `statusreports-staging.bitovi.com`
immediately.

---

## Risks

| Risk                                                                      | Mitigation                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long query strings don't round-trip through Forge history                 | Test in Phase 4's first 30 min. Fallback: short key + payload in storage.                                                                                                                                                          |
| Atlaskit or the JQL editor breaks under CSP                               | `content.styles: [unsafe-inline]` is the documented escape hatch. If the JQL editor needs `unsafe-eval`, add `content.scripts` — but note that's a permission change, so a major version. Surfaces in Phase 1.                     |
| CanJS `RoutePushstate` misbehaves in the sandbox                          | Unverified. Connect is the existence proof; the sandbox grants `allow-same-origin`, so history and `localStorage` should behave.                                                                                                   |
| Shared-code edits regress web or Connect                                  | Full suite plus a manual load of both builds before merging. Staging auto-deploys from `main`.                                                                                                                                     |
| Scope list wrong, discovered late                                         | Every addition is a major version needing admin approval. Settle scopes in Phase 1, and treat it as the promotion gate for Phase 7 Stage 2.                                                                                        |
| Forge install looks empty on a site whose reports live in a Reports Space | Expected, not a data loss — the spec/026 pointer is per-host and does not cross from Connect. Ship the Forge Storage card (Phase 5) so an admin can re-point it, and say so in the release note before anyone reports it as a bug. |
| Forge drifts behind web/Connect while deploys are manual                  | Expected during Phase 7 Stage 1 — staging ships on every push, Forge doesn't. Check the deployed Forge version before debugging a host-specific bug. Stage 2 removes the drift entirely.                                           |
| Three parallel host implementations drift                                 | Accepted cost of the bolt-on decision. [host-adapter.md](./host-adapter.md) stays the design of record for consolidating later.                                                                                                    |

## Explicitly out of scope

Phase A (the Connect-descriptor manifest wrap), the Marketplace listing, Connect→Forge data
migration, the `HostAdapter` refactor, a Forge backend function or KVS storage, and retiring the
OAuth website, its express server, or the existing S3/EC2 deployment path.
