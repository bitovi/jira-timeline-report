# spec/045 — Vibe-coded reports: feasibility spikes

Status: spike plan. The full idea is in [original-idea.md](./original-idea.md); this document only
covers what it takes to prove (or kill) it.

## Goal

Prove, as cheaply as possible, that an **untrusted, agent-built report** can run inside our Forge
app against **live Jira data as the viewer**, while being unable to act as the user, write to Jira,
or send data off the page — and that an agent can publish one without manual file handling.

Not in scope: roll-ups in a Forge function, scheduled snapshots, the snapshot permission gate, the
AutoScheduler.

## What "proven" means

S1, S2, S4 and S5a pass, and S6 confirms S1 inside the real app. If S5a fails, S5b or S5c passing
is acceptable.

Stop and reassess after **S1** if it fails — without a nested sandbox there is no safe way to run
untrusted code, and nothing else matters.

## Trust model (decided 27 Nov)

The **sandbox is the security control**: report code cannot act as the user, write to Jira, read
tokens or cookies, or send data off the page (S1, S2), and it runs as the viewer, so it only shows
data the viewer could already see. Approval is defence in depth, not the main control.

What still has to be controlled is **who can change the code that runs for other viewers**:

- **Default — publisher pinning.** Publishing records `{ attachmentId, sha256, manifest, publishedBy,
publishedAt }` in the report's saved settings. Only the pinned attachment runs, and only if its
  bytes hash to the pinned `sha256`; a newer or different attachment never runs on its own. Who may
  publish is governed by Jira permissions on the Reports project (Edit Issues / Create Attachments).
  Works identically on web and Forge, with no extra storage. Viewers see "Published by X on date".
- **Optional — admin approval (Forge only).** For organisations that want a smaller group to sign
  off, the pin is also recorded in Forge KVS by an approver, and the host requires both to match. KVS
  cannot be changed from Jira (S4).

Accepted risk of the default: anyone with Edit on the Reports project can publish code that runs for
every viewer of that report, so a sandbox escape (browser bug, missed channel such as WebRTC on an
untested browser) would run as those viewers. Mitigation: restrict the Reports project's permissions;
turn on admin approval.

The manifest copy in the pin lets the host start loading data before downloading the bundle. After
download, the host checks that the bundle's embedded manifest equals the pinned copy and refuses to
run otherwise.

## Setup

- A new, minimal Forge app in `spikes/vibe-reports-forge/`. It has its own `manifest.yml` and
  `package.json`, is not part of this repo's builds, tests or typecheck, and is deleted or archived
  when the spikes end.
- One test site with the app installed, two users (a full-access user and a user who cannot browse
  one of the test projects), and a **Reports** project containing one report work item.
- One hand-written report: a single self-contained `report.html` (inline JS and CSS, no external
  URLs) that lists issues and draws a simple SVG chart.

Why a throwaway app: adding CSP entries, `rovo:mcp`, web triggers or scopes to the real
[manifest.yml](../../manifest.yml) can force a major version, and prodcheck shares the production
app ID. S6 then checks that the riskiest result holds in the real app.

## Spikes

### S1 — Nested sandbox in Custom UI

**Build:** Custom UI page that loads `report.html` into `<iframe sandbox="allow-scripts">` (no
`allow-same-origin`), first via `srcdoc`, then via a `blob:` URL if `srcdoc` is blocked. Inject a
CSP `<meta>` into the report document: `default-src 'none'; script-src 'unsafe-inline'; style-src
'unsafe-inline'; img-src data: blob:`.

**Pass:**

- The report renders.
- From inside the report, each of these fails: `fetch` / `XMLHttpRequest` / `WebSocket` /
  `navigator.sendBeacon` / `<img src="https://…">` to an external host; reading `window.parent`
  or `top` properties; importing or reaching `@forge/bridge`; `localStorage`, `sessionStorage`,
  `document.cookie`, `indexedDB`; navigating `top`.
- `origin` inside the frame is `"null"`.

**Record:** which `permissions.content` entries the manifest needed (if any), and whether adding
them counts as a major version. A `srcdoc`/`blob:` frame inherits the host's CSP, and the injected
`<meta>` can only tighten it — so if inline report scripts need `content.scripts: unsafe-inline`,
record that it also loosens the **host** page's CSP.

**If it fails:** try a Forge UI Kit host with a Custom UI child, then a separately-hosted sandbox
origin. If none work, the idea is not viable on Forge.

### S2 — Bridge and allowlist

**Build:** `postMessage` protocol between report and host. One allowed request:
`{ id, type: "getIssues", jql: string, fields?: string[] }`. The host validates the shape, calls
`requestJira('/rest/api/3/search/jql', …)` as the viewer, paginates, and replies `{ id, ok, data |
error }`. The host only accepts messages whose `event.source` is the report frame.

**Pass:**

- The report receives issues; the restricted user gets fewer issues for the same JQL.
- Rejected with an error reply and no Jira call: unknown `type`, extra properties, non-string JQL,
  messages from any other source.
- Malformed JQL returns Jira's error to the report without breaking the host.

**Record:** time and message size for 100, 1,000 and 5,000 issues. Whether a single message is
acceptable or results need chunking.

### S4 — Bundle storage and hash check

**Build:** `report.html` stored as an attachment on the report work item. The host lists
attachments, fetches the content via `requestJira('/rest/api/3/attachment/content/{id}')`,
computes SHA-256 with `crypto.subtle`, and compares it to the **approved hash** stored in the Forge
Key-Value Store (via a resolver). An **Approve** button (shown to the spike's approver only) saves
the current attachment's hash.

**Pass:**

- The approved attachment runs in the S1 sandbox.
- A newer attachment, or a modified one, shows as "pending approval" and does not run.
- Editing the work item's Description cannot change what runs.

**Record:** whether `requestJira` follows the attachment content redirect to the media service
under the Custom UI CSP (biggest risk here); size limits; whether `?redirect=false` helps.

**If it fails:** store the bundle in KVS in chunks (240 KiB per value) instead of an attachment.

The spike built the **admin approval** variant (hash in KVS). The default publisher pin (see Trust
model) uses the same attachment fetch and hash check, with the pin read from the report's saved
settings instead.

### S5 — Agent publishing

Run in order; stop at the first that passes.

#### S5a — Atlassian's own MCP

**Build:** Claude Code connected to `https://mcp.atlassian.com/v2/mcp`. Prompt it to create or find
the report work item (`createJiraIssue` / `searchJiraIssuesUsingJql`) and attach `report.html`
(`uploadAttachmentToJiraIssue`). Approve in our app (S4).

**Pass:** from one prompt to a running report, with no manual download/upload by the person.

**Record:** how `uploadAttachmentToJiraIssue` transfers the file (local `curl` command vs. content
through the model), size limit, accepted file types, token cost, and whether Claude Desktop (no
shell) can do it.

#### S5b — Our own `rovo:mcp` tool

**Build:** `rovo:mcp` module with a `publish_report({ reportKey, bundle })` action that writes the
attachment as the user. Requires a site admin to enable the tool for external clients.

**Record:** maximum tool input size, token cost for a 100 KB and a 500 KB bundle, admin enablement
steps.

#### S5c — One-time-token upload

**Build:**

1. `begin_publish({ reportKey, sha256, size })` (a `rovo:mcp` tool, so it runs as the user) checks
   the user can edit the report, then stores a token in KVS bound to
   `{ accountId, reportKey, sha256, maxSize, expiresAt: now + 5 min }`.
2. The agent runs `curl -T report.html -H "Authorization: Bearer <token>" <webtrigger-url>`.
3. A `static` web trigger deletes the token on first use, then checks expiry, size and SHA-256
   before storing the bundle as pending.

**Record:** where the bundle can be stored without `asApp()` (KVS chunks vs. attachment), and
whether a `static` web trigger keeps the app eligible for Runs on Atlassian.

### S6 — Real-app check

**Build:** port S1 (and the S2 `getIssues` bridge) into this repo's Forge app on **prodcheck**,
behind a dev-only route.

**Pass:** same S1 results under the real CSP, real `unsafe-inline` styles and the real bundle.

**Record:** the `manifest.yml` diff and whether `forge deploy -e prodcheck` reports a major
version.

### S7 — Declared data on the existing loader, roll-ups in the report

Runs together with S6, because the loader lives in the real app.

**Design direction.** Split the work: the **host does I/O** (trusted, needs the bridge) and the
**report does compute** (untrusted, sandboxed).

- **Loading — host.** A report declares its data the same way the Sources panel does. The request
  object is the one `getRawIssues` ([jira-data-requests.js](../../src/stateful-data/jira-data-requests.js))
  already takes:

  ```json
  {
    "sdk": { "version": "1", "provide": "host" },
    "data": { "work": { "source": "settings", "fields": ["Summary", "Status", "Due date"] } }
  }
  ```

  `sdk.provide` tells the host whether to inject the SDK library (`"host"`) or not (`"bundled"`, the
  report carries its own copy).

  `source: "settings"` means this report's saved Sources configuration — `jql`, `loadChildren` +
  `childJQL`, `loadBlockers` + `blockerJQL` — stored with the report and edited with the existing
  Sources sidebar. Changing settings does not need re-approval: Jira still limits results to the
  viewer. `fields` is unioned with `CORE_FIELDS`. The host loads through `getRawIssues`, so reports
  share the `rawIssuesCacheKey` singleflight cache with each other and with built-in reports, and
  Report of Reports can group them like any child report. Progress events are forwarded to the frame.

- **Processing — report.** The host sends **raw issues** (plain Jira JSON) plus the context the
  pipeline needs (field/team configuration, rollup levels and calculations, status mapping). The
  report runs `normalizeIssue` → `deriveIssue` → `rollupAndRollback` itself, or not at all, using a
  **Report SDK library** built from `src/jira/`. Running this code in the sandbox grants nothing: the
  security boundary is the bridge, not which code the report holds. Only plain JSON crosses
  `postMessage`.
- **Declaration and parallel load.** The manifest is a
  `<script type="application/json" id="report-manifest">` inside `report.html`, so it is covered by
  the pinned hash. At publish it is copied into the pin (see Trust model), so the host starts loading
  data **before** downloading the bundle, and checks the embedded copy matches after download.
- Imperative `sdk.getIssues` stays for follow-up loads (drill-down). A call matching a declared
  request returns the in-flight result.

**SDK library delivery — decide in this spike:**

| Option                                                                           | For                                                                               | Against                                                                                   |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Host injects it into the `srcdoc`, by declared `sdk.version` (`provide: "host"`) | Small reports; roll-up fixes reach every report; same numbers as built-in reports | What runs is "approved bundle + SDK version", so record the SDK version with the approval |
| Report bundles it (npm package)                                                  | Approved hash covers exactly what runs; reproducible                              | Fixes need a republish; agent needs a bundler                                             |

The manifest makes this per report, so both can be supported. The same package is published for
authoring either way (S8).

**Pre-check (27 Nov, local Chromium):** `normalizeIssue` + `deriveIssue` + `rollupAndRollback`
bundle to **100 KB minified** (50 KB `jstat`, 26 KB `semver`), with no CanJS. Inside the sandbox
it **fails to load**: `shared/feature-flag.js` reads `localStorage` at import time
(`historical-adjusted-estimated-time.js` → `defineFeatureFlag`), which throws without
`allow-same-origin`. With an in-memory `localStorage` stub injected first, the full pipeline runs and
returns rolled-up issues. Fix needed in `src/`: feature flags passed in (or read lazily with a
fallback) rather than read from `localStorage` at import. Also `rolledup/work-status/work-status.ts`
imports `canjs/routing/utils/round.ts`, which imports `routeData`; not on the `rollupAndRollback`
path, but it must be cut before work-status helpers go in the SDK.

**Build:** host reads the declaration from the pin, calls `getRawIssues` with the report's
saved Sources settings, and sends raw issues + context to the frame. The SDK library is injected (or
bundled); the sample report rolls up in the frame.

**Pass:**

- A report declaring `loadChildren` and `loadBlockers` gets the same issue set as a built-in report
  with the same Sources settings, and the same rolled-up dates and statuses.
- Bundle download and data load overlap (timeline shows both starting before either finishes).
- Two reports with the same settings on one page make one set of Jira requests.

**Record:**

- Which context the pipeline needs beyond raw issues, and where each piece comes from today.
- Roll-up time in the frame vs. the host for 1,000 and 5,000 issues.
- Whether `expand: ['changelog']` (always on today) should be opt-in for reports that don't compare to
  past data.
- Cold vs. warm load, with the bundle cached in IndexedDB by attachment ID (attachments are immutable)
  and re-hashed before running.

### S8 — npm authoring template

Runs locally; no deploy.

**Why:** agents build better reports with `npm`, TypeScript and a dev server: types give compile errors
before publishing, and mock data gives a preview without Jira. The npm package is for **authoring**;
at runtime the host can still inject the SDK (`sdk.provide: "host"`), which also keeps hand-written,
no-build reports (Claude Desktop, Claude.ai artifacts) working.

**Build:** a starter (`create-report` template): Vite + TypeScript + React, one chart library
(Recharts), types from `src/jira/` (raw, derived, rolled-up issues), a mock `sdk` backed by the
logged-out sample data, and a build step that:

1. inlines everything into one `report.html` (no external URLs, no lazily loaded chunks),
2. leaves the SDK out of the bundle when `provide: "host"`, pointing at the injected global,
3. embeds the manifest.

**Pass:** the built `report.html` runs in the S1 sandbox under the real Forge CSP (replayed locally)
with zero CSP violations, and renders a chart from mock data. `tsc` catches a deliberate type error in
the report.

**Record:** output size; any library that needs `eval`, `new Function`, Web Workers or external
assets; dev-loop steps an agent needs.

### S9 — Web sandbox origin

The hosted web app differs from Forge in two ways that matter: the page holding the report frame
keeps the user's Jira **access and refresh tokens** in `localStorage`
([storage.ts](../../src/jira-oidc-helpers/storage.ts)), and it sends **no CSP**. In Forge, the report
frame sits inside Atlassian's per-app CDN iframe, which holds no token and has a strict CSP — the
CSP that closed S1's `blob:`-navigation WebRTC bypass. On web we provide that middle layer ourselves:

```
statusreports.bitovi.com      app: holds the token, fetches + hash-checks the bundle, answers the bridge
  └─ iframe https://<sandbox-domain>/loader.html   sandbox="allow-scripts"
       │  static file; CSP *header* we control (no network, no frame navigation,
       │  frame-ancestors = the app only)
       └─ srcdoc report      opaque origin, injected CSP + prelude (same as Forge)
```

- **The loader must be on a different _site_ (registrable domain) from the app page.** A different
  subdomain already blocks every attack S9 tested (that is origin separation). A different site adds
  separate browser processes (defence against browser bugs and Spectre-style attacks on the page
  holding the token) and no shared cookies. **Where it lives is unresolved** — see Open decisions.
- The app sends the hash-checked HTML and SDK runtime to the loader by `postMessage` (checking the
  loader's origin). Bridge messages are relayed report → loader → app; the token never leaves the app.
- The sandbox domain serves one static file. It never sees report code, Jira data or tokens.

**Build (local):** app on `http://localhost:<port>`, sandbox domain on `http://127.0.0.1:<port>`
(different sites), app with no CSP (as today), loader served with the CSP header.

**Pass:** the S1 attack suite (including self-navigation to an external URL and to a `blob:` document
running WebRTC) is fully blocked through the loader; the report cannot read the app's `localStorage`
token; the sample report renders and the S2 allowlist tests pass through the relay.

**Record:** the loader's CSP header; anything the relay adds to latency; what hosting the sandbox
domain needs.

## Decided (27 Nov)

- **Core app.** Custom reports ship in this repo's Forge app, not a separate add-on. The core
  [manifest.yml](../../manifest.yml) gains `permissions.content.scripts: [unsafe-inline]` — a major
  version, and it allows inline scripts in the main app UI (acceptable: `src/` renders no raw HTML from
  Jira).
- **Work item per report.** Custom reports require the `space` reports backend: the bundle is an
  attachment on the report's work item and the pin is stored with that report. Legacy single-blob sites
  don't get custom reports.

## Open decisions

### Web sandbox host

The web app is served from one CloudFront distribution under two hosts, `statusreports.bitovi.com` and
`status-reports.bitovi.tools` (staging: `statusreports-staging.bitovi.com`,
`status-reports-staging.bitovi.tools`; see `.github/workflows/deploy-*.yaml`). Any loader host on
`bitovi.com` or `bitovi.tools` shares a site with one of them unless the app hosts change.

| Option                                                    | Loader host                                                                                             | Separate site for every app host?         | Work                                                                                                       | Downsides                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A. Reuse the `.tools` host                                | `status-reports.bitovi.tools` (staging: `status-reports-staging.bitovi.tools`)                          | ✅ once the app stops serving there       | Remove the alias from the app's distribution; serve only the loader there (other paths redirect to `.com`) | Must confirm the OAuth callback and Jira OAuth app don't use the `.tools` host. Name doesn't say "sandbox" |
| B. New `.tools` subdomain, retire the app's `.tools` host | e.g. `report-sandbox.bitovi.tools`                                                                      | ✅ once the app stops serving on `.tools` | New alias; redirect `status-reports.bitovi.tools` to `.com`                                                | Same OAuth check as A                                                                                      |
| C. Cross-pick                                             | `report-sandbox.bitovi.com` and `report-sandbox.bitovi.tools`; the app uses the one on the other domain | ✅                                        | Two aliases; app picks the loader by its own host                                                          | Two loader hosts; unusual                                                                                  |
| D. New domain                                             | e.g. `bitovi-reports.net`                                                                               | ✅                                        | Register domain, DNS zone, certificate                                                                     | One more domain to own                                                                                     |
| E. Plain subdomain                                        | `report-sandbox.bitovi.com` only                                                                        | ❌ for `.com` users                       | Least                                                                                                      | Loses process and cookie separation; still blocks every tested attack                                      |

## Security assertions

| Assertion                                                                | Proved by |
| ------------------------------------------------------------------------ | --------- |
| Report frame has an opaque origin (no `allow-same-origin`)               | S1, S6    |
| Report frame cannot reach the network                                    | S1, S6    |
| Report frame cannot reach the Forge bridge, tokens, storage, cookies     | S1, S6    |
| Only allowlisted, schema-valid, read-only requests are answered          | S2        |
| Data returned is limited to the viewer's Jira permissions                | S2        |
| Only the pinned bundle runs, and only if its bytes match the pinned hash | S4        |
| With admin approval on, the pin cannot be changed from Jira at all       | S4        |
| On web, the report frame is on a different site from the token holder    | S9        |
| Publishing never needs a long-lived secret or a public, open URL         | S5        |

## Results log

| Spike | Date        | Result                                      | Findings                                                                                                                                                                                                                                                                                                                                                        | Link                                                                                                                          |
| ----- | ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| S1    | 26 Nov 2026 | Pass                                        | `srcdoc` works, `blob:` frames don't (Forge `frame-src`). 33/33 escape attempts blocked; origin `"null"`. Needs `content.scripts: unsafe-inline` (loosens host too); still Runs on Atlassian. WebRTC bypasses CSP: mitigated by an injected prelude.                                                                                                            | [findings](../../spikes/vibe-reports-forge/findings/README.md#s1--nested-sandbox-pass)                                        |
| S2    | 26 Nov 2026 | Pass (restricted-user check pending)        | All allowlist/source checks pass. Forge rejects unbounded JQL. 1,000 issues: 4 s / 1.7 MB, all Jira paging; `postMessage` under 4 ms, so no chunking needed.                                                                                                                                                                                                    | [findings](../../spikes/vibe-reports-forge/findings/README.md#s2--bridge-and-allowlist-pass-restricted-user-check-pending)    |
| S4    | 27 Nov 2026 | Pass                                        | `requestJira` reads attachment content fine (no redirect problem). KVS hash can't be changed from the Description. 100 MB fetched, hashed and rendered in 13 s; 10 MB in about 1 s. Site limit 1 GiB.                                                                                                                                                           | [findings](../../spikes/vibe-reports-forge/findings/README.md#s4--bundle-storage-and-hash-check-pass)                         |
| S5a   | 27 Nov 2026 | Pass in Claude Code; fail in GitHub Copilot | Two-phase upload: local `curl` to Media, bytes never go through the model. Copilot masks the upload token (atlassian/atlassian-mcp-server#233). Claude Desktop has no shell.                                                                                                                                                                                    | [findings](../../spikes/vibe-reports-forge/findings/README.md#s5a--atlassians-mcp-pass-in-claude-code-fail-in-github-copilot) |
| S5b   |             | Not run                                     | Would cover Copilot and Claude Desktop.                                                                                                                                                                                                                                                                                                                         |                                                                                                                               |
| S5c   |             | Not run                                     |                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                               |
| S6    |             | Not run                                     |                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                               |
| S7    |             | Not run                                     |                                                                                                                                                                                                                                                                                                                                                                 |                                                                                                                               |
| S8    | 27 Nov 2026 | Pass (local, real Forge CSP replayed)       | Vite + TS + React + Recharts builds to one 645 KB `report.html` (192 KB gzip); runs in the sandbox with 0 CSP violations using the host-injected SDK (101 KB) and rolls up in the frame. `tsc` against `src/jira` types catches mistakes; `npm run dev` previews from sample data.                                                                              | [findings](../../spikes/vibe-reports-forge/findings/README.md#s8--npm-authoring-template-pass-local)                          |
| S9    | 27 Nov 2026 | Pass (local, Chromium)                      | App on `localhost` (no CSP, tokens in `localStorage`) → loader on `127.0.0.1` with our CSP header → `srcdoc` report. 35/35 attacks blocked incl. reading the app's token; self-navigation to external and `blob:` blocked by the loader's `frame-src 'none'` (WebRTC bypass closed); 12/12 allowlist tests through the relay; loader refuses non-app embedders. | [findings](../../spikes/vibe-reports-forge/findings/README.md#s9--web-sandbox-origin-pass-local)                              |

## Deferred

| Item (original spike #)      | Why deferred                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Shared roll-up module (3)    | Only needed to run roll-ups server-side for snapshots; the browser already runs them. |
| Scheduled snapshots (7)      | Needs `asApp()`, which the app avoids on purpose. Separate decision.                  |
| Snapshot permission gate (8) | Only matters once snapshots exist.                                                    |
| Admin approval policy        | Optional mode (see Trust model); who may approve is a product decision.               |

## Background

Corrections to [original-idea.md](./original-idea.md) against the repo today:

- **Forge storage:** [index.forge.ts](../../src/jira/storage/index.forge.ts) is not limited to app
  properties. The `storage-resolver` function ([src/forge-resolver/](../../src/forge-resolver/))
  reaches the Forge Key-Value Store (240 KiB per value), which users cannot edit from Jira — the
  home for the optional admin approval.
- **No `asApp()`:** [manifest.yml](../../manifest.yml) keeps every Jira call in the iframe as the
  user, so the app cannot exceed the viewer's permissions. Scheduled snapshots would break this.
- **CSP:** Forge's default CSP blocks inline scripts, and a `srcdoc` frame inherits its parent's
  CSP — the main reason S1 is the gating spike. See
  [platform-constraints.md](../021-forge/platform-constraints.md#csp-and-external-egress).
- **Publishing:** Atlassian's MCP server already has `uploadAttachmentToJiraIssue`
  ([supported tools](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/supported-tools/)),
  which may remove the need for our own MCP tools (S5a).

Market note: the same tool list includes `createConfluenceMauiApp` (Beta), "Generate an
interactive visualization for a Confluence page" — Atlassian building its own version of
agent-generated reports.
