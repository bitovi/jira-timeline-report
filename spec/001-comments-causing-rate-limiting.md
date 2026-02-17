# Implementation Plan: Reducing Jira Rate Limiting Due to Changelog Requests

> **📋 SPEC STATUS:** API research complete. Ready for implementation.
>
> **Key Findings:**
>
> - ✅ Bulk changelog endpoint exists and is well-documented: `POST /rest/api/3/changelog/bulkfetch`
> - ✅ Supports batching (1000 issues/request) and field filtering (10 fields max)
> - ✅ Request/response format documented in Question #1
>
> **Decisions Needed:**
>
> 1. **Question #3**: Include time-based filtering or defer to future work?
> 2. **Questions #4-6, #8-9**: Implementation details and success criteria

## Problem Statement

The current version of the timeline report is running into issues where rate limits are being hit due to a large number of changelog requests. We want to switch the way we pull work item information from Jira to reduce how much information we are pulling and ensure that we don't hit rate limits.

## Current Implementation Analysis

The current data flow for fetching issues with changelogs:

1. [fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts](../src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts) fetches issues using `searchJiraIssuesWithJQL` with `expand: ['changelog']`
2. The initial search returns issues with the **first page** of changelog entries (typically 100 entries max per issue)
3. [fetchRemainingChangelogsForIssues](../src/jira-oidc-helpers/jira.ts#L277) then iterates through **each issue** and makes individual `GET /api/3/issue/{key}/changelog` API calls for issues with more changelog entries than the first page
4. For 100+ issues with extensive history, this can result in **hundreds of individual API calls**, triggering rate limits

### Key Files

- [src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts](../src/jira-oidc-helpers/fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts) — orchestrates issue + changelog fetching
- [src/jira-oidc-helpers/jira.ts](../src/jira-oidc-helpers/jira.ts) — contains `fetchRemainingChangelogsForIssues`, `fetchRemainingChangelogsForIssue`, and `fetchJiraChangelog`
- [src/request-helpers/hosted-request-helper.js](../src/request-helpers/hosted-request-helper.js) — makes the actual HTTP requests (no rate limiting currently)

## Research: Jira API Rate Limits & Bulk Capabilities

### Jira Cloud Rate Limits

- Jira Cloud enforces rate limits per user/app, typically returning HTTP 429 when exceeded
- Rate limits are based on a combination of request count and computational cost
- The `Retry-After` header indicates how long to wait before retrying

### Changelog API Options

**Option A: Use `expand=changelog` in Search (Current Partial Approach)**

- The search API supports `expand=changelog` which returns changelog data inline with issues
- **Limitation**: Only returns the first page of changelog entries (typically 100 per issue)
- Issues with >100 changelog entries still require individual follow-up requests

**Option B: Individual Changelog Endpoints**

- `GET /rest/api/3/issue/{issueIdOrKey}/changelog` — paginated, per-issue
- **This is the current source of rate limiting** — one call per issue with incomplete changelog

**Option C: Bulk Changelog Endpoint (Jira Cloud v3)** ✅ **RECOMMENDED**

- `POST /rest/api/3/changelog/bulkfetch` — can request changelogs for **multiple issues at once**
- Accepts an array of issue IDs/keys and returns changelogs in bulk
- Supports filtering by up to 10 field IDs (server-side)
- Maximum 1000 issues per request
- Returns paginated results sorted by changelog date and issue ID
- **This is the recommended solution** — reduces N calls to ~1-2 calls per 1000 issues

### Recommendation

Use the **bulk changelog endpoint** (`POST /rest/api/3/changelog/bulkfetch`) to significantly reduce API calls:

**Recommended Approach**:

- Replace individual changelog requests with bulk endpoint calls
- Batch issues into groups of up to 1000 per request
- Implement server-side field filtering to reduce data volume (API supports up to 10 field IDs)
- This approach reduces hundreds of individual API calls down to ~1-2 calls per 1000 issues

## Implementation Steps

### Step 1: Investigate Jira Bulk Changelog Endpoint

Research and prototype using `POST /rest/api/3/changelog/bulkfetch` to fetch changelogs in bulk.

**Changes:**

- Create `fetchBulkChangelogs(config)` function in `src/jira-oidc-helpers/jira.ts`
- Accept parameters:
  - `issueIdsOrKeys: string[]` — array of issue IDs or keys (max 1000)
  - `fieldIds?: string[]` — optional array of field IDs to filter (max 10)
  - `maxResults?: number` — optional pagination size
- Return a map of issue key → changelog entries
- Handle pagination using `nextPageToken` from response

**Implementation Details**:

```typescript
// Request format
const requestBody = {
  issueIdsOrKeys: ['PROJ-123', 'PROJ-124'],
  fieldIds: ['status', 'assignee'],  // Optional field filtering
  maxResults: 100                     // Optional pagination size
};

// Response format
{
  issueChangeLogs: [
    {
      issueId: '10100',
      changeHistories: [/* array of changelog entries */]
    }
  ],
  nextPageToken: 'UxAQBFRF'          // Present if more pages exist
}
```

**Verification:**

- ✅ Test the endpoint manually with Postman/curl (sample request provided in Question #1)
- Unit test with mocked responses
- ✅ Compare response format to current individual changelog responses (formats match)
- Verify pagination works correctly by testing with issues that have >100 changelog entries

### Step 2: Replace Individual Changelog Fetching with Bulk

Update `fetchRemainingChangelogsForIssues` to use the bulk endpoint instead of individual calls.

**Changes:**

- Update `fetchRemainingChangelogsForIssues` in [jira.ts](../src/jira-oidc-helpers/jira.ts#L277) to:
  1. Identify all issues with incomplete changelogs (where `changelog.histories.length < changelog.total`)
  2. Batch issue keys into groups of up to 1000 per request
  3. For each batch:
     - Call `fetchBulkChangelogs` with the batch of issue keys
     - Handle pagination if `nextPageToken` is present in response
     - Map response data: Match `issueChangeLogs[].issueId` to issue key, merge `changeHistories` into issue
  4. Merge all fetched changelog entries back into their respective issues

**Implementation Note**:
The bulk endpoint returns `issueId` (numeric ID), but we may need to map this back to issue `key` (e.g., "PROJ-123"). The response includes all data needed, but ensure the mapping logic handles both ID and key correctly.

**Verification:**

- Run a report with 100+ issues and observe API call count (should be ~1 call per 1000 issues instead of 1 per issue)
- Compare changelog data before/after to ensure completeness (all histories present, correct order)
- Test with issues that have >1000 changelog entries to verify pagination works
- Monitor for rate limit errors (should be eliminated or drastically reduced)

### Step 3: Add Progress Tracking for Bulk Operations

Update progress reporting to reflect the new bulk fetching approach.

**Changes:**

- Update `ProgressData` type if needed
- Report progress as batches complete rather than individual issues

**Verification:**

- Observe progress UI during a large report run
- Confirm progress updates are smooth and accurate

### Step 4: Filter Changelog to Relevant Fields

Many changelog entries contain field changes that are not relevant to the timeline report. By filtering changelog entries to only include relevant fields, we can significantly reduce the amount of data processed.

**Key Insight:** The timeline report already supports dynamic field loading, and **the bulk changelog API supports server-side filtering by field IDs** (up to 10 fields).

**Changes:**

- Accept a `relevantFields` parameter in `fetchBulkChangelogs` and `fetchRemainingChangelogsForIssues`
  - These should be **field IDs** (e.g., "status", "assignee", "customfield_10001"), not field names
- Thread the field list from the report configuration down through the data pipeline:
  1. Start with `fields` parameter from `src/stateful-data/jira-data-requests.js#L120` (`fieldsToLoad`)
  2. Convert field names to field IDs using existing mapping in `src/jira-oidc-helpers/fields.ts`
  3. Pass field IDs to `fetchBulkChangelogs` via the `fieldIds` parameter
- If more than 10 fields are requested:
  - Prioritize core fields: Status, Assignee, Sprint, Fix Versions, Parent, etc.
  - Filter remaining fields client-side after fetching
- Include the `fieldIds` array in the bulk changelog request body

**Implementation Example**:

```typescript
// In fetchBulkChangelogs
const requestBody = {
  issueIdsOrKeys: issueKeys,
  fieldIds: relevantFieldIds.slice(0, 10), // API limit: max 10 fields
  maxResults: 100,
};
```

**Optional Enhancement — Time-based Filtering:**

- The timeline report has an existing slider that controls how much history to display
- The bulk changelog API does NOT support time-based filtering server-side
- If time filtering is desired, it must be done client-side after fetching:
  - Accept an optional `changelogSince` date parameter
  - Filter `changeHistories` array to only include entries where `created >= changelogSince`
  - Leverage existing pattern in `src/jira/raw/rollback/rollback.ts` (`collectChangelog`)

**Verification:**

- Confirm the field list is correctly passed from the report layer to the changelog fetch
- Verify field names are correctly mapped to field IDs
- Compare data volume before/after filtering (should see reduction in response size)
- Test report accuracy with filtered changelog data (ensure all necessary data is still present)
- Measure performance improvement (both request size and processing time)

## Optional Future Enhancements

- **Improve rate limit error messaging:** There is already error handling in place for rate limiting. In the future, we may update the error message to provide more clarity about why rate limiting occurred and what the user can do about it.

## Questions

### 1. Bulk Changelog API Details — ✅ FULLY RESEARCHED

**API Findings:**

Based on the official Jira Cloud REST API v3 documentation and testing:

- **Endpoint**: `POST /rest/api/3/changelog/bulkfetch` ("Bulk fetch changelogs")
- **Functionality**: Returns a paginated list of all changelogs for given issues, sorted by changelog date and issue IDs (oldest first, smallest ID first)
- **Issue Identification**: Issues can be identified by ID or key
- **Filtering Support**: ✅ Server-side filtering by **field IDs** (up to 10 fields)
- **Limits**:
  - Maximum **1000 issues** per request
  - Maximum **10 field IDs** for filtering
- **Pagination**: ✅ Token-based pagination using `nextPageToken`
- **Permissions Required**:
  - Browse projects permission
  - Issue-level security permission (if configured)
- **OAuth Scopes**:
  - Classic: `read:jira-work`
  - Granular: `read:issue-meta:jira`, `read:avatar:jira`, `read:issue.changelog:jira`

**Request Format**:

```json
{
  "fieldIds": ["status", "assignee"], // Optional: up to 10 field IDs
  "issueIdsOrKeys": ["10000", "PROJ-123"], // Required: issue IDs or keys
  "maxResults": 100, // Optional: pagination size
  "nextPageToken": "UxAQBFRF" // Optional: for subsequent pages
}
```

**Response Format**:

```json
{
  "issueChangeLogs": [
    {
      "issueId": "10100",
      "changeHistories": [
        {
          "author": {
            /* user object */
          },
          "created": 1492070429, // Unix timestamp
          "id": "10001",
          "items": [
            {
              "field": "fields",
              "fieldId": "fieldId",
              "fieldtype": "jira",
              "fromString": "old value",
              "toString": "new value"
            }
          ]
        }
      ]
    }
  ],
  "nextPageToken": "UxAQBFRF" // Present if more pages exist
}
```

**Key Observations**:

- ✅ Response structure matches individual changelog format (`changeHistories` array with `author`, `created`, `id`, `items`)
- ✅ Pagination uses `nextPageToken` (token-based, not offset-based)
- ✅ Returns data grouped by `issueId`, making it easy to map back to issues
- ✅ The `created` timestamp is Unix epoch (number), not ISO string

**Implementation Notes**:

1. Use `issueIdsOrKeys` array to batch up to 1000 issues per request
2. Use `fieldIds` array to filter to relevant fields (max 10) — must use field IDs, not field names
3. Handle pagination by checking for `nextPageToken` in response and including it in next request
4. Map response data: `issueChangeLogs[].issueId` → issue key, `changeHistories` → append to issue's changelog

### 2. Field Filtering Approach — ✅ RESOLVED

Step 4 proposes filtering changelog entries by "relevant fields."

**API Capability Confirmed**:
The bulk changelog endpoint ✅ **supports server-side filtering by field IDs** (up to 10 fields via the `fieldIds` request parameter)

**Resolution**:

- ✅ Filter changelog history items to match the issue fields being requested
- ✅ Use the existing `fields` parameter from `src/stateful-data/jira-data-requests.js#L120` (`fieldsToLoad`)
- ✅ Leverage existing field mapping in `src/jira-oidc-helpers/fields.ts` to convert field names → field IDs
- ✅ Pass up to 10 field IDs to the bulk changelog API via `fieldIds` parameter
- If >10 fields requested, prioritize core fields (Status, Assignee, Sprint, Fix Versions, Parent) and filter remaining client-side

**No additional questions needed** — implementation path is clear.

### 3. Time-Based Filtering Scope — ✅ CLARIFIED

The spec marks time-based filtering as "Optional Enhancement."

**API Limitation**: The bulk changelog endpoint does **NOT** support server-side time-based filtering. Any time filtering must be done client-side after fetching the data.

**Decision Required**:

- Is client-side time-based filtering worth implementing in this spec?
- If YES:
  - Accept an optional `changelogSince` date parameter in the fetching functions
  - Filter the `changeHistories` array after receiving the response
  - Leverage existing pattern in `src/jira/raw/rollback/rollback.ts` (`collectChangelog` function)
- If NO:
  - Remove the optional enhancement section from Step 4
  - Structure the code to make it easy to add later (e.g., accept optional params that are currently unused)

**Recommendation:** Mark time-based filtering as **out of scope** for this implementation. Focus on the bulk endpoint and field filtering first, which will provide the primary benefits. Time filtering can be added in a follow-up if needed.

### 4. Progress Tracking Changes

Step 3 states "Update ProgressData type if needed" but doesn't specify what changes are required:

- Currently `ProgressData` tracks `changeLogsRequested` and `changeLogsReceived` (individual issues). With bulk fetching, should we track:
  - Number of bulk requests made?
  - Number of issues in each batch?
  - Keep the same granularity but calculate it differently?
- How should progress updates work during batched bulk requests? Update after each batch completes?

**Recommendation:** Define the exact changes needed to `ProgressData` and when/how progress callbacks should be invoked.

### 5. Error Handling Strategy

The spec doesn't address error handling for the new bulk endpoint:

- What happens if a bulk changelog request fails midway through processing?
- Should we fall back to individual requests for failed issues?
- How do we handle partial responses if the bulk API returns some changelogs but fails for others?
- Should we implement retry logic with exponential backoff?

**Recommendation:** Add an error handling section defining the strategy for failures.

### 6. Testing Strategy

The spec lacks testing guidance:

- What unit tests should be written or updated?
- Are there existing E2E tests that need updates (e.g., in `playwright/`)?
- How do we test the rate limiting improvement? (Mock API calls and verify count goes down?)
- Should we add integration tests for the bulk endpoint?

**Recommendation:** Add a testing section with specific test scenarios and files to update.

### 7. Backwards Compatibility — ✅ RESOLVED

The bulk changelog endpoint will replace the individual changelog fetching logic:

**Changes**:

- `fetchRemainingChangelogsForIssues` will use the bulk endpoint instead of individual `GET /issue/{key}/changelog` calls
- The function signature and return type remain the same for compatibility
- Existing callers don't need to change

**Verification**:

- Ensure all existing reports continue to work correctly
- Verify changelog data completeness matches the previous implementation
- Test with issues that have varying amounts of changelog history (0 entries, <100 entries, >100 entries, >1000 entries)

### 8. Performance Metrics

To validate the improvement, we should define success criteria:

- What's the target reduction in API calls? (e.g., "Reduce by 90% for typical reports with 100 issues")
- What's an acceptable response time increase/decrease?
- Should we add telemetry/logging to track these metrics?

**Recommendation:** Define measurable success criteria for this implementation.

### 9. Wording Inconsistency

Step 2 says "Replace `fetchRemainingChangelogsForIssues`" but Step 4 says "Accept a `relevantFields` parameter in... `fetchRemainingChangelogsForIssues`", suggesting modification rather than replacement.

**Recommendation:** Clarify whether we're replacing the function entirely or modifying its implementation. "Update" or "Refactor" might be more accurate than "Replace."
