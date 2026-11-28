# spec/045 — Vibe-coded reports: handoff for implementation

Read this first. It summarises what the feasibility spikes proved, what was decided, and where to
start building the real feature. Details and evidence: [spec.md](./spec.md) (plan, trust model, results
log, open decisions) and [findings/README.md](../../spikes/vibe-reports-forge/findings/README.md)
(measurements, attack lists, gotchas). Background idea: [original-idea.md](./original-idea.md).

## 1. The feature in one paragraph

Someone builds a status report with an AI agent (any HTML/JS, optionally with our npm SDK and
TypeScript), the agent attaches the single-file `report.html` to the report's work item in Jira, and
our app runs it — in Forge and in the hosted web app — inside a locked-down sandbox. The report gets
Jira data only through a read-only bridge that queries Jira **as the viewer**, loads data the same way
the Sources panel does (children, blockers), and can run our roll-up code itself. Nothing is stored
outside Jira, and report code can never act as the user, write to Jira, or send data off the page.

## 2. What is proven

| Area                                        | Result                                                                                                                                             | Evidence                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Nested sandbox in Forge Custom UI (S1)      | ✅ `<iframe sandbox="allow-scripts" srcdoc>` works; all escape attempts blocked (33/33 deployed, 35/35 in the later local replay); origin `"null"` | Deployed spike app on `bitovi-training` + local replay of the real Forge CSP |
| Read-only bridge (S2)                       | ✅ allowlist, schema validation, source checks; malformed JQL handled. 1,000 issues ≈ 4 s, all Jira paging; `postMessage` < 4 ms                   | Deployed spike app                                                           |
| Bundle in a Jira attachment + hash pin (S4) | ✅ `requestJira` reads attachment content; 100 MB fetched + hashed + rendered in 13 s; site limit 1 GiB                                            | Deployed spike app, `RT-5`                                                   |
| Agent publishing via Atlassian's MCP (S5a)  | ✅ in **Claude Code**; ❌ in **GitHub Copilot** (masks the upload token, atlassian/atlassian-mcp-server#233)                                       | `findings/s5a-claude-code.md`                                                |
| npm + TypeScript authoring (S8)             | ✅ Vite + TS + React + Recharts → one 645 KB `report.html`, 0 CSP violations, roll-ups run inside the frame using a host-injected SDK              | `spikes/report-template/`                                                    |
| Web app sandbox origin (S9)                 | ✅ app → loader on a different site → `srcdoc` report; 35/35 blocked incl. reading the app's token; WebRTC bypass closed                           | `spikes/web-sandbox/` (local, Chromium)                                      |

**Not yet verified** — do not assume:

- S2 restricted-user check (a second user who can't browse a project gets fewer issues). Expected, untested.
- Firefox and Safari for any sandbox result. All runs were Chromium.
- S6/S7: the sandbox and declared-data loading inside **this repo's** Forge app (needs the manifest change, §6).
- Relay latency on web; roll-up time inside the frame for 1,000–5,000 issues.

## 3. Decisions made

1. **The sandbox is the security control; approval is optional.** Default is **publisher pinning**:
   publishing records `{ attachmentId, sha256, manifest, publishedBy, publishedAt }` with the saved
   report. Only that attachment runs, only if its bytes hash to `sha256`. Who may publish = Jira
   permissions on the Reports project. Optional, Forge-only **admin approval** additionally records the
   pin in Forge KVS (which users can't edit). See spec "Trust model".
2. **Host does I/O, report does compute.** The host (trusted) loads data through the existing
   `getRawIssues` loader with the report's saved Sources settings and sends **raw issues** (plain JSON)
   plus context. The report runs `normalizeIssue` → `deriveIssue` → `rollupAndRollback` itself (or not).
3. **Reports declare their data in a manifest** embedded in `report.html`
   (`<script type="application/json" id="report-manifest">`). It is copied into the pin at publish so
   the host can load data in parallel with the bundle; after download the host checks the embedded copy
   equals the pinned copy.
4. **The SDK runtime is injected by the host** when the manifest says `sdk.provide: "host"`, or bundled
   by the report (`"bundled"`). Authoring uses an npm package (types, mock data, dev server, Vite build
   plugin) either way.
5. **Web needs a loader on a different site** from the token-holding app page, serving one static file
   with our CSP header. **Which host is unresolved** (spec "Open decisions → Web sandbox host").
6. **Part of the core app** (not a separate add-on Forge app). The core [manifest.yml](../../manifest.yml)
   gains `permissions.content.scripts: [unsafe-inline]` — a **major version** that every customer admin
   must accept; plan to ship it with the next planned major. It also allows inline scripts in the main
   app UI; acceptable because `src/` renders no raw HTML from Jira (checked 27 Nov: no
   `dangerouslySetInnerHTML`, `innerHTML =`, `insertAdjacentHTML` or `{{{`). Keep it that way.
7. **Custom reports require a work item per report** (the `space` reports backend). The bundle is an
   attachment on the report's work item and the pin is stored with that report. Sites still on the
   legacy single-blob backend don't get custom reports until they move to a Reports space.

## 4. Architecture

```
FORGE
Jira page
  └─ Forge Custom UI iframe (*.cdn.prod.atlassian-dev.net — Atlassian's CSP)   ← our host code
       └─ <iframe sandbox="allow-scripts" srcdoc=…>                             ← report (opaque origin)

WEB
statusreports.bitovi.com (holds Jira tokens, runs host code)
  └─ <iframe sandbox="allow-scripts allow-same-origin" src="https://<sandbox-host>/loader.html">
       │  static loader, our CSP header (frame-src 'none', connect-src 'none', frame-ancestors = app)
       └─ <iframe sandbox="allow-scripts" srcdoc=…>                             ← report (opaque origin)
```

Host steps for one report view:

1. Read the saved report → its pin (`attachmentId`, `sha256`, `manifest`) and Sources settings.
2. In parallel: start the manifest's data loads (`getRawIssues`), and get the bundle (cache by
   `attachmentId`, else fetch `/rest/api/3/attachment/content/{id}`).
3. SHA-256 the bytes (`crypto.subtle`); refuse unless equal to the pin. Check the embedded manifest
   equals the pinned one.
4. Build the document: `injectCsp()` (CSP `<meta>` + prelude) + SDK runtime (if `provide: "host"`) +
   report HTML. Mount (Forge: `srcdoc`; web: post to loader).
5. Answer bridge messages whose `event.source` is that report's window. Stop answering if the frame
   navigates (second `load`).

## 5. Contracts to implement

### Report manifest (inside `report.html`)

```json
{
  "sdk": { "version": "1", "provide": "host" },
  "data": { "work": { "source": "settings", "fields": ["Summary", "Status", "Start date", "Due date"] } }
}
```

`source: "settings"` = this report's saved Sources configuration (`jql`, `loadChildren` + `childJQL`,
`loadBlockers` + `blockerJQL`). `fields` is unioned with `CORE_FIELDS`. Start with one source per
report.

### Bridge (report ⇄ host), all via `postMessage`

| Request `{ id, type, … }`            | Reply data                                     | Notes                                                       |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `getData { name }`                   | `{ issues: RawIssue[] }`                       | `name` must be in the pinned manifest's `data`              |
| `getContext {}`                      | `{ rollupLevels, normalizeConfig, compareTo }` | From the report's Timing / team configuration               |
| `getIssues { jql, fields?, limit? }` | `{ issues }`                                   | Follow-up loads (drill-down). Bounded JQL required in Forge |

Replies are `{ id, ok: true, data }` or `{ id, ok: false, error: { message, status? } }`. Reject unknown
`type`, extra properties, wrong types, oversized values — **with an error reply and no Jira call**.
Reference implementation: `validateRequest` / `getIssues` in
[sandbox.js](../../spikes/vibe-reports-forge/static/src/sandbox.js).

### Pin (stored with the saved report)

`{ attachmentId, sha256, manifest, sdkVersion, publishedBy, publishedAt }` — a new optional field on
`Report` ([fetcher.ts](../../src/jira/reports/fetcher.ts)), alongside `queryParams`.

## 6. Where it plugs into this repo

| Need                                                      | Existing code                                                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data loading (children, blockers, progress, shared cache) | `getRawIssues` in [jira-data-requests.js](../../src/stateful-data/jira-data-requests.js); key in [raw-issues-cache-key.ts](../../src/stateful-data/raw-issues-cache-key.ts) |
| Pipeline for the SDK                                      | [rollup-and-rollback.ts](../../src/jira/rolledup-and-rolledback/rollup-and-rollback.ts), `normalizeIssue`, `deriveIssue`                                                    |
| Saved reports / one work item per report                  | [backend/space.ts](../../src/jira/reports/backend/space.ts), interface in [backend/types.ts](../../src/jira/reports/backend/types.ts)                                       |
| New report type + feature flag                            | [configuration/reports.ts](../../src/configuration/reports.ts), [features.ts](../../src/configuration/features.ts)                                                          |
| Sources UI to reuse for report settings                   | [SettingsSidebar/components/IssueSource](../../src/react/SettingsSidebar/components/IssueSource/)                                                                           |
| Forge KVS (optional admin approval)                       | [src/forge-resolver/](../../src/forge-resolver/)                                                                                                                            |
| Forge permissions                                         | [manifest.yml](../../manifest.yml) — needs `permissions.content.scripts: [unsafe-inline]` (§8)                                                                              |
| Token storage on web (why web needs the loader)           | [jira-oidc-helpers/storage.ts](../../src/jira-oidc-helpers/storage.ts)                                                                                                      |

Repo rules apply: new UI is React (no new CanJS components); services follow
`src/react/services/{domain}/` with injected providers; tests colocated; Prettier.

## 7. Spike code: what to reuse

All under `spikes/` (not built, tested or typechecked by the repo; throwaway).

| Path                                                                                                                                    | Reuse?                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `vibe-reports-forge/static/src/sandbox.js` — `REPORT_CSP`, `REPORT_PRELUDE`, `injectCsp`, `validateRequest`, `getIssues`, `mountReport` | **Port** (to TypeScript, with tests). Security-critical; keep the comments.                                                           |
| `vibe-reports-forge/reports/attack*.html`, `bridge-tests.html`                                                                          | **Port as tests.** The attack suite is the regression test for the sandbox; run it under Playwright for Forge and web.                |
| `vibe-reports-forge/local/run-sandbox-tests.mjs` + `findings/forge-csp-header.txt`                                                      | Pattern for a local Playwright test that replays the real Forge CSP.                                                                  |
| `vibe-reports-forge/src/index.js` (resolver approve/getApproved)                                                                        | Reference for optional admin approval.                                                                                                |
| `report-template/sdk/*`                                                                                                                 | Starting point for the SDK package: types re-exported from `src/jira/`, runtime accessors, host runtime entry, dev mock, Vite plugin. |
| `web-sandbox/sandbox-domain/loader.*`, `run.mjs` (`LOADER_CSP`)                                                                         | **Port** as the web loader and its test.                                                                                              |
| `vibe-reports-forge/static/src/host.js`, `mock-jira.js`                                                                                 | Spike UI only; don't port.                                                                                                            |

## 8. Gotchas found (each cost time)

- **`src/shared/feature-flag.js` reads `localStorage` at import time**; the roll-up pipeline imports it
  (historically-adjusted estimates), so the SDK crashes in the sandbox. Fix in `src/`: inject flags /
  read lazily. **Also** `rolledup/work-status/work-status.ts` → `canjs/routing/utils/round.ts` imports
  `routeData`; cut that before work-status helpers go in the SDK.
- **`blob:` frames don't load in Forge** (no `blob:` in `frame-src`): use `srcdoc` only.
- **Inline report scripts need `content.scripts: unsafe-inline`** in Forge (srcdoc inherits the host
  CSP). Decided: add it to the core app (§3.6). It was inferred, not tested without it — a quick check
  (spike app deployed without the line) is cheap if anyone doubts it.
- **WebRTC ignores CSP and sandboxing.** The prelude removes `RTC*` APIs and strips nested frames, but a
  report can navigate itself to a `blob:` document with fresh globals; only a `frame-src` that excludes
  `blob:` (Forge's, or the web loader's) closes that. Never mount reports directly in a page without
  such a `frame-src` (e.g. the web app today, which has no CSP).
- **Identify bridge callers by `event.source === iframe.contentWindow`**, never by origin (every
  sandboxed frame is `"null"`). Close the bridge when the frame navigates.
- **Don't splice report/runtime text with `String.replace(re, string)`** — `$'`, `` $` ``, `$&` in
  minified code are replacement patterns. Use a replacer function.
- **Forge rejects unbounded JQL** (`order by created`); require a restriction.
- **Playwright `waitForFunction` uses `eval`** and fails under our CSP; poll with `page.evaluate`.
- **Atlassian MCP upload in Copilot** fails (token masked). Claude Code works; Claude Desktop can't (no shell).
- **Mock data** from `src/examples/bitovi-training.json` must be date-shifted like
  `bitoviTrainingData` does, or everything looks complete.

## 9. Open decisions (need a human)

1. **Web sandbox host** — options A–E in spec "Open decisions".
2. **When to ship the major version** carrying `scripts: unsafe-inline` (bundle with the next planned
   major?).
3. Multiple data sources per report (start with one); `expand: ['changelog']` opt-in; whether to cache
   data (stale-while-refresh) and bundles (IndexedDB by `attachmentId`).
4. Admin approval policy (who approves) — product decision, only if the optional mode ships.

## 10. Suggested build order

1. **Make the pipeline sandbox-safe** (feature-flag injection, cut `round.ts`'s `routeData` import) and
   add an SDK build: types + host runtime IIFE built from `src/jira/`. Unit tests; existing tests stay green.
2. **Port the sandbox core** (`injectCsp`, prelude, bridge validation) to TypeScript with tests, plus a
   Playwright test running the attack suite under the replayed Forge CSP.
3. **Custom report type** behind a feature flag (`configuration/reports.ts`): a React component that
   reads the pin, fetches + hash-checks the attachment, loads declared data via `getRawIssues`, mounts
   the sandbox and answers the bridge. Forge mount first.
4. **Publish / pin UI** on a saved report (space backend only; hide or explain for legacy sites): list `.html` attachments, "Publish this version" writes the
   pin; show "Published by X on date".
5. **Forge verification on prodcheck** (S6/S7 pass criteria): add `scripts: unsafe-inline` to the core
   manifest and `forge deploy -e prodcheck`; record that it reports a major version.
6. **Web loader** — after decision §9.1: deploy the static loader, mount via loader on web, Playwright test.
7. **Authoring kit** — npm SDK package + template (from `spikes/report-template/`) + a Claude skill
   describing the manifest, mock preview and publishing via Atlassian's MCP.
8. Later: optional admin approval (KVS), bundle/data caching, progress streaming to the report.

## 11. Test environment and artifacts

- Spike Forge app `vibe-reports-spike-045` (`ari:cloud:ecosystem::app/aa079544-7567-46dc-94ac-1f35e7b3f280`),
  `development` environment, installed on `bitovi-training.atlassian.net`; Forge variable
  `APPROVER_ACCOUNT_IDS`. Forge CLI needs Node ≥ 22.23.4 (`nvm use 22.23.4`).
- Jira `RT-5` "Vibe report spike 045 (throwaway)" in project RT: report attachments 10269–10275
  (10272 is the MCP-published one).
- Branch `045-vibe-reports-spikes`; nothing committed yet. Clean up the spike app and `RT-5` when done.
