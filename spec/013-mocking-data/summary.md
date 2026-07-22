# spec/013 — Mocking data (capture → fixture → replay)

**Status:** early brainstorm, paused for handoff. Direction chosen; details TBD by next agent.

## Goal

A **dev-only** pipeline that lets us capture real Jira data into local fixture
folders and replay a chosen fixture instead of calling Jira — **even while logged
in**. Purpose:

1. Let an AI agent iterate on reports without Jira credentials (inject/cycle data).
2. Let a client hand us a captured dataset to reproduce an issue.
3. Later: power logged-out demo experiences.

## Decision made

**Interception layer: the app-function seam, thin custom code — NOT a framework.**

Rationale (evaluated MSW and PollyJS):
- The app already funnels all Jira reads through a few functions in
  `src/stateful-data/jira-data-requests.js` (`getRawIssues`, `getServerInfo`,
  `getSimplifiedIssueHierarchy`, plus the fields fetch), and these **already branch
  on `isLoggedIn`** (logged-out → `bitoviTrainingData()` / example JSON). A fixture
  replay is a natural generalization of that existing branch.
- **PollyJS** is the closest off-the-shelf record/replay tool (fetch adapter + fs
  persister, works in-browser) but captures Jira's raw *paginated* REST responses —
  bulky, coupled to REST shapes, extra dependency.
- **MSW** serves mocks well but recording is DIY anyway.
- Because the seam already exists, capturing the handful of **assembled** results the
  reports actually consume is ~50 LOC, produces small readable fixtures, and matches
  what a report needs. Frameworks earn their keep when there's no seam and many
  varied endpoints — not the case here.

## Sketch of the shape (to be refined)

- **Capture:** in dev, forward the assembled results at the `jira-data-requests.js`
  seam to a **dev-only endpoint on the existing express server** (`server/server.js`,
  already running for OAuth token exchange), which writes them to
  `.temp/fixtures/<name>/` (one file per input).
- **Replay:** a fixture "source" that overrides the Jira calls at the same seam,
  active even when logged in, selected by some dev-only mechanism (URL param like
  `?fixture=<name>`, env var, or a dev UI picker — **not yet decided**).

## Open questions for the next agent

1. **Capture scope** — the question that was being asked when we paused. Options:
   - **Full replay bundle** (recommended): raw issues + serverInfo + issueTypes/
     hierarchy + fields list + teams/normalize config → fully offline/logged-out.
   - **Issues only**: capture just `getRawIssues`; reuse existing logged-out
     fallbacks for the rest.
   - (Raw HTTP responses was rejected along with the framework approach.)
2. **Capture trigger** — always-on in dev vs an explicit "capture now" toggle/button.
   (User noted there's an existing debug field that `console.log`s the data.)
3. **Fixture selection** — URL param vs env var vs dev-only UI picker.
4. **Redaction/sanitization** — real client data may be sensitive; relevant once
   fixtures back logged-out demos. Likely out of scope for v1; confirm.

## Key code references

- Seam: `src/stateful-data/jira-data-requests.js` (`getRawIssues:95`, `getServerInfo:37`,
  `getSimplifiedIssueHierarchy:45`) — already `isLoggedIn`-branched.
- Request wiring: `src/canjs/controls/timeline-configuration/state-helpers.js:28`
  (`rawIssuesRequestData`) and `route-data.js` `rawIssuesRequestData` /
  `allFieldsToRequest` (`:266`, `:375`).
- Dev server: `server/server.js` (express, port 3000). `npm run dev` runs css + vite
  (`dev:js`) + this server (`start-local`) concurrently.
- Existing sample-data precedent: `src/examples/bitovi-training`, wired at
  `jira-data-requests.js:5-6,100`.
