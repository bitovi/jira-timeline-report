# S5a in Claude Code — findings

Run date: 2026-11-27. Site: `bitovi-training.atlassian.net`. Work item: `RT-5` ("Vibe report spike 045 (throwaway)").

| Item                          | Value                                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Result                        | **pass**. All steps done: find, phase 1, curl, phase 2, verify                                                                                                                                                                                                            |
| Claude Code version           | `2.1.332 (Claude Code)` (model: Claude Opus 5.5)                                                                                                                                                                                                                          |
| Tool discovery                | `discover({ query: "upload attachment to jira issue" })`. `uploadAttachmentToJiraIssue` was the first result, and the result said to call it through `executeWrite`                                                                                                       |
| Transfer mechanism            | Confirmed. The bytes went through a local `curl --data-binary @<abs path>` to `https://api.media.atlassian.com/file/binary?collection=upload-user-collection--…`. The MCP only issued the token and the command. The tool output says: "bytes never pass through the LLM" |
| Token visible to agent?       | **yes**, not masked. The full `Authorization: Bearer <JWT>` was in `uploadCommand` (not pasted here)                                                                                                                                                                      |
| `curl` HTTP status + `fileId` | `201`; `400cb785-2e79-4529-9d12-ab2530f5d08d` (Media reported `mimeType: text/html`, `size: 3707`, `processingStatus: pending`)                                                                                                                                           |
| Phase 2 result                | attachment ID **10272**, `report-mcp.html`, **3707** bytes, `text/html`. Confirmed by reading it back with `getJiraIssue(fields: ["attachment"])`                                                                                                                         |
| Number of MCP tool calls      | **5**: `searchJiraIssuesUsingJql` ×1, `discover` ×1, `executeWrite(uploadAttachmentToJiraIssue)` ×2, `getJiraIssue` ×1. A `ToolSearch` call also loaded the deferred MCP tool schemas; it is a harness call, not an MCP call                                              |
| Token cost                    | _not recorded. The agent cannot run `/cost`; run `/cost` at the end of the session and fill this in_                                                                                                                                                                      |
| Wall-clock time               | about 25 s of tool time from the first shell command to the phase-2 "attached" response (epoch 1795831425 → 1795831450). Prompt-to-attached is under 1 minute, including model turns                                                                                      |
| Anything surprising           | See below                                                                                                                                                                                                                                                                 |

## Notes

- **The token passes through the agent's context.** Claude Code does not mask it, which is why this run worked
  (Copilot failed because of #233). The other side of this: the bearer JWT appears in the MCP tool result and in the
  Bash command the agent runs, so it ends up in the session transcript. The rule "do not print/log the token" can only
  be partly kept. The agent never echoed the token on its own, but it must pass through the shell command. The JWT
  payload shows a narrow scope: `create/read/update` on the user's upload collection and upload/chunk resources, plus
  `read` on `upload-project-10462`. Its lifetime is about 20 minutes (`exp − nbf = 1200 s`).
- **The command was changed slightly.** I added `-sS -w '\nHTTP_STATUS=%{http_code}\n'` to the returned `curl` so the
  HTTP status code could be recorded. Everything else was run exactly as returned.
- **The tool's own guidance is clear.** Both the phase-1 and phase-2 responses warn against using the standalone route
  and the inline route together, because that creates a duplicate. Phase 2 also describes the HTML `media` node needed
  to show the file inline without attaching it again.
- **Existing attachments on RT-5 before this run:** 10269 `report.html` (3675), 10270 `report.html` (3700), 10271
  `big-500k.html` (512046). Only 10272 was added.
- Nothing was approved or run in the Forge app (S4). No files other than this one were changed, and nothing was committed.

## File size limits / accepted types

The `uploadAttachmentToJiraIssue` tool description, the phase-1 output and the phase-2 output say nothing about file
size limits or accepted file types. Media accepted `text/html` and detected the MIME type itself (no `Content-Type` was
sent). (By comparison, `createConfluenceAttachment` has an optional `fileSize` input "to fail fast if the file is too
large"; the Jira tool has nothing like it.) The 512 KB `big-500k.html` attached earlier on RT-5 shows that at least
that size works.
