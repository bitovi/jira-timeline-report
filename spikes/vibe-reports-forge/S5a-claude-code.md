# S5a in Claude Code — publish a report through Atlassian's MCP

Hand this file to Claude Code from the repo root: `claude "Follow spikes/vibe-reports-forge/S5a-claude-code.md"`.

## Context

We are testing spike **S5a** from [spec/045](../../spec/045-vibe-coded-reports/spec.md): can an agent publish a
report bundle to Jira using only Atlassian's own MCP server, with no manual download or upload by a person?

The same attempt from GitHub Copilot (VS Code) failed: Copilot masks the bearer token in
`uploadAttachmentToJiraIssue`'s `uploadCommand` (known bug
[atlassian/atlassian-mcp-server#233](https://github.com/atlassian/atlassian-mcp-server/issues/233)). This run checks
whether Claude Code, which does not mask the token, can finish the flow.

## Setup (once)

If the Atlassian MCP server is not already connected in Claude Code:

```sh
claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp
```

Then run `/mcp` inside Claude Code and authenticate as a user with access to `bitovi-training.atlassian.net`.

## Task

1. Using the Atlassian MCP tools only (no Jira REST calls with your own credentials), find the work item on
   `bitovi-training.atlassian.net` whose summary is **"Vibe report spike 045 (throwaway)"** (expected: `RT-5`).
2. Attach the file `spikes/vibe-reports-forge/reports/report-mcp.html` (use its **absolute** path) to that work item with
   `uploadAttachmentToJiraIssue`. The tool is not in the primary tool list; find it with `discover` and call it through
   `executeWrite`. It works in two phases:
   - Phase 1: call with `issueIdOrKey` + absolute `filePath`. It returns an `uploadCommand` (`curl`).
   - Run that `curl` from the shell exactly as returned. Take `data.id` from its JSON output as the `fileId`.
   - Phase 2: call again with `issueIdOrKey` + `fileId` to attach it as a standalone attachment. Do **not** also use the
     inline-in-body route — that would create a duplicate.
3. Verify: read the work item's attachments through the MCP and confirm a new `report-mcp.html` exists with size
   **3707** bytes. Report its attachment ID.
4. Do **not** approve or run anything — approval happens in the spike Forge app (S4) afterwards.

## Rules

- Do not print, log, or write the upload token anywhere. Do not commit anything.
- If the `curl` returns 401 or the `Authorization` header reads `******`, stop and record that — do not try to obtain a
  token some other way.
- Do not modify any file other than the results file below.

## Record

Write the results to `spikes/vibe-reports-forge/findings/s5a-claude-code.md` with:

| Item                          | Value                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Result                        | pass / fail, and the step it failed at                                            |
| Claude Code version           | `claude --version`                                                                |
| Tool discovery                | how `uploadAttachmentToJiraIssue` was found (discover query used)                 |
| Transfer mechanism            | confirm the bytes went via local `curl` to `api.media.atlassian.com`, not the LLM |
| Token visible to agent?       | yes / masked (do not paste it)                                                    |
| `curl` HTTP status + `fileId` | status code; fileId                                                               |
| Phase 2 result                | attachment ID, filename, size                                                     |
| Number of MCP tool calls      | count                                                                             |
| Token cost                    | from `/cost` at the end of the session                                            |
| Wall-clock time               | prompt to attached                                                                |
| Anything surprising           | free text                                                                         |

Also note anything the tool output says about file size limits or accepted file types.
