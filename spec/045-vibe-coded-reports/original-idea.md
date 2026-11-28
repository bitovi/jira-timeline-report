# Spec: Vibe-Coded Jira Reports Runtime

Status: exploration / feasibility spikes
Base repo: `github.com/bitovi/jira-timeline-report` (Status Reports for Jira)

## 1. Summary

AI makes it easy for anyone to vibe code a status report, so selling individual reports is getting harder. The hard part people still can't do is **deploy** a report that loads live Jira data, respects Jira permissions, and can be shared. Their vibe-coded reports end up static.

This project turns Status Reports for Jira into a **runtime for vibe-coded reports**:

1. A person builds a report with an agent (Claude, Claude Design, etc.) against a small **Report SDK**.
2. The agent **publishes** the front-end bundle to the person's Jira through an MCP tool.
3. The report runs inside a **locked-down sandbox** in the Forge app (and the hosted web app), getting data only through a read-only bridge that queries Jira **as the viewer**.
4. A **scheduled job** saves dated **data snapshots** so people can view a report's history.
5. Everything is stored **in Jira** — no Bitovi database.

The AutoScheduler is out of scope and should not be part of the SDK.

## 2. Goals and non-goals

Goals:

- Untrusted report code can never act as the user, write to Jira, or send data off the page.
- Each viewer sees only data their own Jira permissions allow (live mode).
- No new database; reuse the existing reports-project storage.
- Agent-friendly authoring: local preview with mock data, one-call publish, shareable link.
- Report history via data snapshots, replayed through the same sandbox.

Non-goals (for now):

- Server-side rendering of report code.
- Write access to Jira from reports.
- The AutoScheduler.
- A marketplace or cross-tenant report sharing.

## 3. Current state of the repo (relevant pieces)

- `src/jira/storage/` — pluggable storage:
  - `index.web.ts` + `common.ts`: the web build stores config as a JSON blob inside a code block in a "configuration issue" Description, found by summary search.
  - `index.forge.ts`: the Forge build stores data in app properties (≈32 KB per value), not in issues.
- `src/jira/reports/backend/`:
  - `legacy.ts`: all saved reports in one shared blob.
  - `space.ts`: one work item per report in a Reports project; Description = generated banner + report JSON code block. Its own comment notes anyone with Edit Issues can modify it.
  - `types.ts`: the backend interface.
- Data layer: JQL loading plus roll-ups (dates from stories → sprints → epics → initiatives → releases; status mapping incl. QA / UAT / blocked). This is the core value to expose through the SDK.
- Browser calls Jira directly (`jiraFetch`); today only the access token passes through Bitovi servers.

Verify these paths before building; they were read from a shallow clone and may have moved.

## 4. Architecture

### 4.1 Report SDK (trusted, versioned)

A small JS package that report code imports. In the sandbox it is a thin `postMessage` client; the real implementation lives in the host.

Suggested surface (read-only):

```ts
getIssues(jql: string, opts?: { fields?: string[] }): Promise<Issue[]>
getRolledUp(jql: string, opts?: RollupOptions): Promise<RolledUpTree>   // epics/initiatives with derived dates + status
getStatuses(): Promise<StatusMapping>
getContext(): Promise<{ reportId: string; mode: "live" | "snapshot"; snapshotAt?: string; settings: unknown }>
```

Requirements:

- Roll-up logic extracted from the existing app into a module that runs in **both** the browser and a Forge function (Node). No DOM dependencies.
- A mock adapter with realistic fixture data for local preview.
- Versioned contract; the report manifest records which SDK version it targets.

### 4.2 Sandbox host (trusted)

Forge Custom UI (and the web app) acts as the host:

- Loads the report bundle into a **nested iframe** with `sandbox="allow-scripts"` (no `allow-same-origin`) → opaque origin, no access to the Forge bridge, storage, or cookies.
- Injects a strict CSP into the report document: no network (`connect-src 'none'`), no external scripts, inline/blob only as needed.
- Answers an **allowlist** of SDK messages only; validates every request; executes via `requestJira` (as the viewer) in live mode, or from snapshot data in snapshot mode.
- Verifies the bundle's SHA-256 against the approved hash before running it.

### 4.3 Storage (in Jira)

Extend the `space` reports backend:

- Report work item Description JSON gains:
  ```json
  {
    "bundle": { "attachmentId": "…", "sha256": "…", "sdkVersion": "1.x", "publishedAt": "…", "publishedBy": "…" },
    "approved": { "attachmentId": "…", "sha256": "…", "approvedBy": "…", "approvedAt": "…" },
    "settings": { "jql": "…", "…": "…" },
    "snapshots": { "schedule": "daily" | "weekly" | "off" }
  }
  ```
- The code bundle is an **attachment** on the report work item (never in the Description; rich-text fields cap around 32K characters).
- Each publish = new attachment (version history for free). The host only runs the attachment whose hash matches `approved.sha256`.
- On Forge, decide whether the Description JSON or app storage is the source of truth for the hash (app storage is not editable by users with Edit Issues — likely safer).

### 4.4 Publishing (MCP)

Preferred: a Forge `rovo:mcp` module exposing tools (Preview; admins must enable each tool under Atlassian Administration → Connected apps).

Tools:

- `publish_report({ reportId?, bundle, settings })` — validates (front-end only, size limit, single file), uploads attachment, writes hash, marks pending approval, returns link.
- `list_reports()` / `get_report(reportId)` — so agents iterate on existing reports.
- `approve_report(reportId, sha256)` — admin-only (or keep approval in the UI).

Fallback if `rovo:mcp` payload limits are too small: a two-step upload (tool returns a short-lived Forge web-trigger URL; agent uploads the bundle there), or host the MCP tools in CascadeMCP using the user's Atlassian OAuth.

Also ship a **starter template + Claude skill** describing the SDK, mock preview, and publish flow.

### 4.5 Snapshots (history)

- Forge **scheduled trigger** (daily/weekly per report) runs **only trusted code**: executes the report's SDK queries via the shared roll-up module and saves the result.
- Saved as a dated JSON attachment on the report work item, tagged with `{ takenAt, bundleSha256, sdkVersion, projectKeys[] }`.
- Fetched as the app (no user context), so snapshots may contain more than a given viewer can see → gated below.
- Replay: viewer picks a date; host runs the bundle recorded in that snapshot (or current approved bundle) in the same sandbox, with the SDK serving snapshot data.

### 4.6 Snapshot permission gate

- On open, host calls `GET /rest/api/3/mypermissions?permissions=BROWSE_PROJECTS&projectKey=…` (as the viewer) for the snapshot's `projectKeys`.
- Show the full snapshot (including since-deleted issues) only if the viewer has Browse Projects on **all** of them.
- Deleted/archived projects: pass only if the viewer can view the report work item.
- Issue security levels: ignored for v1; flag as a known gap.

## 5. Feasibility spikes

Run these in order; each is small and answers one risk. Stop and reassess if any fails.

| #   | Spike                             | What to build                                                                                           | Pass criteria                                                                                                                         | Key unknowns                                                                                                                             |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Nested sandbox in Forge Custom UI | Custom UI that loads a hard-coded bundle into `sandbox="allow-scripts"` iframe via `srcdoc` or blob URL | Report renders; from inside it, `fetch` to any host fails, `window.parent` bridge calls fail, no access to Forge `view`/`requestJira` | Does Forge's CSP / manifest `permissions.content` allow nested srcdoc/blob frames and inline scripts? Which manifest entries are needed? |
| 2   | Bridge + allowlist                | `postMessage` protocol, host-side validation, `getIssues` via `requestJira`                             | Report gets issues as viewer; any non-allowlisted message is rejected; malformed JQL is handled                                       | Message size limits for large result sets; need pagination/streaming?                                                                    |
| 3   | Shared roll-up module             | Extract roll-up logic into a DOM-free package; run it in browser and in a Forge function                | Same input → identical output in both environments; existing app still passes its tests                                               | Hidden DOM/global dependencies in current code                                                                                           |
| 4   | Bundle storage                    | Upload a bundle as an attachment on a report work item from Forge; read it back; hash-verify in host    | Round trip works; tampered attachment is refused                                                                                      | Can a Forge function/resolver upload multipart attachments via `api.asUser()`? Attachment size limits per site                           |
| 5   | MCP publish                       | `rovo:mcp` module with `publish_report`; call it from Claude through Atlassian's MCP                    | Claude publishes a real bundle end to end and gets a working link                                                                     | Max tool input size; how binary/large strings are passed; admin enablement UX. If blocked, try the web-trigger two-step fallback         |
| 6   | Agent authoring loop              | Starter template + mock SDK + skill; have Claude build 3 different reports from scratch                 | Each runs unmodified after publish; no agent edits needed to the host                                                                 | Which chart libraries work under the CSP (canvas/SVG fine, anything needing network not)                                                 |
| 7   | Scheduled snapshots               | Scheduled trigger that saves snapshot JSON attachments for one report                                   | Daily run produces dated attachments; replay renders correctly in sandbox                                                             | Trigger time limits vs. large JQL; rate limits; attachment growth over time (retention policy)                                           |
| 8   | Snapshot permission gate          | `mypermissions` check on open                                                                           | User without Browse on any snapshot project is blocked; deleted issues still show for permitted users                                 | Handling deleted/archived projects                                                                                                       |
| 9   | Web build parity                  | Same host + SDK on the hosted web app with Jira OAuth                                                   | Same bundle runs on web and Forge                                                                                                     | Separate sandbox origin needed for the web build (serve report frames from a distinct domain)                                            |

## 6. Security checklist

- [ ] Report iframe has no `allow-same-origin`; opaque origin confirmed.
- [ ] CSP blocks all network from the report frame.
- [ ] Host never passes tokens or bridge objects into the frame.
- [ ] SDK messages allowlisted and schema-validated; read-only only.
- [ ] Forge app uses read-only Jira scopes where possible; no external egress declared (keep "Runs on Atlassian").
- [ ] Only approved, hash-matching bundles execute.
- [ ] Publish validates bundle: single self-contained JS/HTML, size cap, no external URLs.
- [ ] Report code never runs server-side; snapshots run only trusted SDK code.
- [ ] Snapshot access gated by project permissions.

## 7. Open questions

- Approval model: workspace-admin approval for every publish, or trust-on-publish for personal reports and approval only before sharing?
- Who can view a report's history beyond the permission gate — anyone who can see the report work item?
- Snapshot retention: keep all, or thin out (daily for 30 days, weekly after)?
- Is `rovo:mcp` stable enough to depend on, or should CascadeMCP be the primary publish path?
- Pricing: charge for the runtime (per site / per active report) rather than per report?

## 8. Suggested first milestone

Spikes 1–4 on Forge only, with one hand-written report. If the sandbox, bridge, shared roll-ups and attachment storage all work, the idea is viable; MCP publishing and snapshots are then incremental.
