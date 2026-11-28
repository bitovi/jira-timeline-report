# spec/045 spike results

Site: `bitovi-training.atlassian.net`. App: throwaway `vibe-reports-spike-045` (development environment), installed only
there. Browser: Chromium (Playwright). Dates: 26–27 Nov 2026.

Reproduce the local part: `npm install && npm run build && node local/run-sandbox-tests.mjs chromium`. To replay the real
Forge CSP: `SPIKE_CSP="$(cat findings/forge-csp-header.txt)" MODES=srcdoc node local/run-sandbox-tests.mjs chromium`.

## S1 — Nested sandbox: pass

- `<iframe sandbox="allow-scripts">` + `srcdoc` works inside Forge Custom UI. **`blob:` frames do not load**: the real
  Forge `frame-src` has no `blob:` (see [forge-csp-header.txt](./forge-csp-header.txt)), so `srcdoc` is the only option.
- In the real app, all 33 attacks in [attack.html](../reports/attack.html) are blocked, including: `fetch`/XHR/WebSocket/
  EventSource/`sendBeacon`/`<img>`/CSS `url()`/`<script src>`/`import()` to external hosts and the host origin,
  `eval`, blob Workers, `__bridge` on self/parent/top, reading `parent`/`top`, `localStorage`/`sessionStorage`/cookies/
  `indexedDB`/`caches`, `document.domain`, navigating `top`/`parent`, `window.open`, `alert`.
  `self.origin === "null"`.
- **Self-navigation** to an external URL and to a self-made `blob:` URL are both blocked by the host's `frame-src`.
- **WebRTC is not covered by CSP or sandboxing** (Chromium also ignores CSP `webrtc 'block'`). Without mitigation a
  report reaches a STUN server (`srflx` candidate) — a real exfiltration channel. Mitigated by
  `REPORT_PRELUDE` in [sandbox.js](../static/src/sandbox.js): removes `RTC*` globals before report code runs and removes
  nested frames (whose fresh globals would bypass it). The remaining bypass, navigating the frame to a `blob:` document,
  is closed by Forge's `frame-src`. **Not yet checked in Firefox/Safari.** Treat this as defence-in-depth, not a
  guarantee.
- **Manifest:** `content.scripts: [unsafe-inline]` is required (inline report scripts inherit the host CSP). It also
  loosens the host page's `script-src`. `forge deploy` still reported the app eligible for **Runs on Atlassian**.
  Whether this is a major version for the real app is checked in S6.
- Note: CSP violations from the report frame are reported to Atlassian's `report-uri` (the blocked URL is in the
  report body). This goes to Atlassian, not to anything the report controls.

## S2 — Bridge and allowlist: pass (restricted-user check pending)

- All 12 cases in [bridge-tests.html](../reports/bridge-tests.html) pass in Forge: valid request answered; unknown
  `type`, extra properties, non-string JQL, bad `fields`, oversized `limit` rejected with an error reply and **no Jira
  call**; non-object messages rejected; malformed JQL returns Jira's error and the host keeps working.
- Messages from the host window, an unregistered frame, and a frame nested inside a registered report are ignored
  (0 Jira calls, 0 log entries). The bridge closes when the report frame navigates.
- Forge rejects unbounded JQL (`order by created`) — "Unbounded JQL queries are not allowed here". The SDK must
  document that a restriction is required.
- **Performance** (real Jira, `fields` = 8 defaults, 100 issues per page):

  | Requested | Issues | Jira pages | Round trip | `postMessage` | Payload |
  | --------- | ------ | ---------- | ---------- | ------------- | ------- |
  | 100       | 100    | 1          | 0.3 s      | 0.2 ms        | 205 KB  |
  | 1,000     | 1,000  | 10         | 4.0 s      | 1.7 ms        | 1.7 MB  |
  | 5,000     | 1,845¹ | 19         | 6.1 s      | 3.1 ms        | 3.2 MB  |

  ¹ every issue on the site. Time is all Jira paging (~0.35–0.4 s per page); handing data to the frame is negligible.
  **One message is fine; no chunking needed.** Progress events would help UX for large queries.

- **Pending:** the restricted user check (needs a second user who cannot browse one project).

## S4 — Bundle storage and hash check: pass

- Upload via `requestJira` multipart and read via `requestJira('/rest/api/3/attachment/content/{id}')` both work under
  the Custom UI CSP. The media redirect is handled by the bridge; `?redirect=false` was never needed.
- Approved hash lives in Forge KVS (resolver `approve`, approver list in a Forge variable). A newer or modified upload is
  "pending approval" and has no Run button. Editing the Description (including a fake `approved` JSON block) changed
  nothing.
- The host runs exactly the bytes it hashed (no re-fetch between check and run).
- Browser SHA-256 matches `shasum -a 256` of the local file, so an agent can compute the hash before publishing.
- **Size** (random base64 content inside one JS string, i.e. hard to compress and fully parsed):

  | Bundle | Upload (browser → Jira) | Fetch via `requestJira` | SHA-256 | Render in sandbox |
  | ------ | ----------------------- | ----------------------- | ------- | ----------------- |
  | 3.7 KB | –                       | 0.8 s                   | 0 ms    | –                 |
  | 1 MB   | 1.5 s                   | 0.8 s                   | 1 ms    | 22 ms             |
  | 5 MB   | 3.5 s                   | 0.9 s                   | 3 ms    | 42 ms             |
  | 10 MB  | 5.5 s                   | 1.0 s                   | 5 ms    | 78 ms             |
  | 25 MB  | 12.8 s                  | 1.9 s                   | 12 ms   | 204 ms            |
  | 100 MB | 51.9 s                  | 11.5 s                  | 43 ms   | 1.3 s             |

  Site attachment limit (`/rest/api/3/attachment/meta`): 1 GiB. No practical size limit for report bundles; fetch has a
  ~0.8 s floor. A publish-time cap (e.g. 10 MB) is a policy choice, not a platform constraint.

## S5a — Atlassian's MCP: pass in Claude Code, fail in GitHub Copilot

- `uploadAttachmentToJiraIssue` (found via `discover`, called via `executeWrite`) works in two phases: phase 1 returns
  a `curl` command with a short-lived (~20 min) media token; the agent runs it locally (bytes go straight to
  `api.media.atlassian.com`, never through the model); phase 2 attaches the returned `fileId`.
- **Claude Code: pass.** One prompt → attachment 10272 on RT-5, 5 MCP calls, under a minute. Approved in the spike app;
  hash matched the local file; rendered with live data. Details: [s5a-claude-code.md](./s5a-claude-code.md).
- **GitHub Copilot (VS Code): fail.** Copilot masks the bearer token as `******` in tool output, so the `curl` returns 401. Known issue [atlassian/atlassian-mcp-server#233](https://github.com/atlassian/atlassian-mcp-server/issues/233),
  open since 2 Sep 2026; no workaround inside Copilot.
- **Claude Desktop:** expected to fail (no shell to run `curl`). Not tested.
- Token cost scales with tool calls, not file size, because the bytes don't pass through the model.
- No documented size or file-type limit on the tool; the transport is the same Media upload as the Jira UI (S4 sizes
  apply).
- Downside: the token appears in the agent transcript (it has to be in the shell command). Scope is narrow and it
  expires in ~20 minutes.

## S8 — npm authoring template: pass (local)

Template: [spikes/report-template/](../../report-template/). `npm run dev` / `npm run typecheck` /
`npm run build` / `npm run build:sdk` / `npm run test:sandbox`.

- **Stack:** Vite 7 + TypeScript 5.9 + React 19 + Recharts 3, `vite-plugin-singlefile`. A stand-in
  `@bitovi/report-sdk` (`sdk/`) gives types re-exported from `src/jira/` (raw, derived, rolled-up
  issues), a runtime accessor, a dev mock backed by `src/examples/bitovi-training.json`, and a Vite
  plugin that embeds `report.manifest.json` as `<script type="application/json" id="report-manifest">`.
- **Types:** the template typechecks cleanly against the app's own pipeline types. A deliberate mistake
  (`rollupDates.dueDate`) fails `tsc` with `Property 'dueDate' does not exist on type
'Partial<StartData & DueData>'`.
- **Output:** one `report.html`, 645 KB (192 KB gzip) — almost all React + Recharts. No `eval` /
  `new Function`; the only URLs are SVG/XML namespace strings and error-message links (never fetched).
  The pipeline is **not** in the report: with `sdk.provide: "host"` the host injects
  `report-sdk-runtime.js` (101 KB) ahead of the report.
- **Sandbox run** (local Chromium, real Forge CSP from [forge-csp-header.txt](./forge-csp-header.txt),
  S1 `injectCsp` + prelude): 0 CSP violations, 0 console errors. The report asked for `getData('work')`,
  received raw issues, ran `normalizeIssue` → `deriveIssue` → `rollupAndRollback` in the frame and drew
  11 bars / 12 rows ([screenshot](./s8-report.png)). The host loaded bundle, runtime and data in
  parallel, using the manifest to know what data to fetch.
- **Dev loop:** `npm run dev` renders the same report from mock data with no Jira.
- **Gotchas found:**
  - The runtime needed a `localStorage` stand-in (esbuild banner) because `src/shared/feature-flag.js`
    reads it at import time. Fix belongs in `src/` (S7).
  - Hosts must not splice report or runtime text with `String.replace(pattern, string)`: `$'`, `` $` ``
    and `$&` in minified code are treated as replacement patterns and corrupt the script. Use a
    replacer function.
  - The mock imports `src/examples/bitovi-training.json` directly, skipping the date shift the app
    applies (`bitoviTrainingData` → `adjustDateStrings`), so all sample work is in 2024 and shows complete.
    The published mock should shift dates the same way.

## S9 — Web sandbox origin: pass (local)

Prototype: [spikes/web-sandbox/](../../web-sandbox/). Run: `node spikes/web-sandbox/run.mjs` from the repo
root (uses the repo's Playwright).

- **Setup:** app on `http://localhost:4470` with **no CSP** and fake tokens in `localStorage` + a cookie
  (as the web app does today) → iframe `http://127.0.0.1:4471/loader.html` (a different _site_),
  `sandbox="allow-scripts allow-same-origin"` → `srcdoc` report, `sandbox="allow-scripts"`, with the S1
  `injectCsp` + prelude. The app holds the token and answers the bridge; the loader relays.
- **Loader CSP header:** `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src
'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none';
worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors <app origin>`. `srcdoc`
  children still load under `frame-src 'none'`.
- **Results (Chromium):**
  - Attack suite: **35/35 blocked**, including two new attacks on the top-level app —
    `top.localStorage.getItem('accessToken')` and `top.document.cookie` (SecurityError).
  - Self-navigation to an external URL and to a self-made `blob:` document: both blocked by the
    loader's `frame-src 'none'`; the `blob:` + WebRTC bypass from S1 never ran. Without the loader (a
    `srcdoc` frame directly in an app with no CSP), S1 showed that bypass reaches a STUN server.
  - Sample report rendered with data relayed report → loader → app (200 issues).
  - S2 allowlist: **12/12** through the relay.
  - A page other than the app cannot embed the loader (`frame-ancestors`).
  - No external responses.
- **Hosting needs:** a separate registrable domain (not `*.bitovi.com`), DNS + TLS, and one static
  `loader.html` / `loader.js` with the header above (CDN or a second hostname). No server logic, no
  storage, no tokens, no report code or Jira data on the server.
- **Not measured:** relay latency (two extra `postMessage` hops; S2 measured a hop at a few ms for
  3 MB). Firefox/Safari.

## Not yet done

- S2 restricted-user check.
- S5b/S5c — not needed for "proven" since S5a passed, but S5b would cover Copilot and Claude Desktop.
- S6 — real app on prodcheck.
- Web: the approval-free publisher pin (Trust model in the spec) in the web app's storage backend.
- Firefox/Safari runs of the S1 attack suite (`node local/run-sandbox-tests.mjs firefox webkit` after
  `npx playwright install firefox webkit`).

## Artifacts on the test site

- Forge app `vibe-reports-spike-045` (development) installed on `bitovi-training`; Forge variable
  `APPROVER_ACCOUNT_IDS`.
- `RT-5` "Vibe report spike 045 (throwaway)": attachments 10269–10275, 10272 approved. The 25 MB and 100 MB test files
  were deleted.
