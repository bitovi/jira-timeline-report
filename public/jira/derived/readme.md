### `/derived/derive.js` Module

The `/derived/derive.js` module is responsible for adding derived data to normalized Jira issues. This includes calculating timing metrics (e.g., days of work, progress) and status information (e.g., on track, blocked). The module relies on the `work-timing` and `work-status` submodules to compute these derived values.

#### Key Components:

- **`deriveIssue(normalizedIssue, options)`**:
  - **Purpose**: Adds derived data to a normalized Jira issue, specifically:
    - `derivedTiming`: Timing-related information, calculated using the `deriveWorkTiming` function from `work-timing.js`.
    - `derivedStatus`: Work status, calculated using the `getWorkStatus` function from `work-status`.
  - **Returns**: An enhanced issue that includes derived timing and status data in addition to the normalized data.

---

### `/derived/work-status/work-status` - Work Status

This module categorizes the status of a Jira issue based on its current status field and other metadata. It helps determine the current phase of work (e.g., "Dev", "QA", "Blocked").

#### Key Components:

- **`workType`**: An array of the main types of work: `["design", "dev", "qa", "uat"]`.
  
- **`workflowHappyPath`**: A list of workflow statuses considered part of the "happy path," such as `["todo", "design", "dev", "qa", "uat", "done"]`.

- **`getStatusCategoryDefault(issue)`**:
  - **Purpose**: Maps a given status to a higher-level category (e.g., "Blocked", "QA", "Dev").
  - **Returns**: The status category based on a predefined mapping (e.g., a status of "Blocked" would be categorized under `blockedStatus`).

- **`getWorkStatus(normalizedIssue, options)`**:
  - **Purpose**: Determines the current work status (`statusType`) and the type of work (`workType`) for a given Jira issue.
  - **Returns**: A `DerivedWorkStatus` object that contains the `statusType` (e.g., "Blocked", "QA") and `workType` (e.g., "dev", "qa").

---

### `/derived/work-timing/work-timing.js` - Work Timing

This module calculates timing-related data for Jira issues, including the total number of workdays, how much work has been completed, and how much time remains.

#### Key Components:

- **`deriveWorkTiming(normalizedIssue, options)`**:
  - **Purpose**: Computes timing metrics for a given normalized issue, including:
    - **Story Points to Days of Work**: Converts story points into days of work based on team velocity and capacity.
    - **Deterministic and Probabilistic Estimates**: Calculates both deterministic (based on confidence) and probabilistic estimates of extra time needed to complete the task.
    - **Sprint and Date-Based Timing**: Accounts for both sprint-based timing (start/end dates) and task-specific start/due dates.
  - **Returns**: A `DerivedTiming` object containing fields like `totalDaysOfWork`, `completedDaysOfWork`, and `storyPointsDaysOfWork`.
