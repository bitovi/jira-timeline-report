### `/rollup/rollup.js` Module

The `/rollup/rollup.js` module is responsible for aggregating and rolling up data across parent-child relationships within a hierarchy of Jira issues or releases. This rollup process helps generate a hierarchical view of project data, which can be used for reporting purposes, showing the relationships between tasks, epics, and releases.

#### Modules:

- **`blocked-status-issues`**:

  - **Purpose**: Handles the identification and rollup of blocked issues, tracking their status across parent-child relationships. It ensures that blocked statuses are aggregated and reflected in parent issues.

- **`child-statuses`**:

  - **Purpose**: Manages the aggregation of statuses from child issues to parent issues, ensuring that parent issues reflect the status of their children.

- **`dates`**:

  - **Purpose**: Rolls up date information, specifically the start and due dates of issues. It calculates parent issue dates based on child issue data using different strategies (e.g., using child dates, parent dates, or both).

- **`percent-complete`**:

  - **Purpose**: Computes the percentage of completion for issues by aggregating progress from child issues and rolling it up to parent issues. This allows parent issues to reflect the overall progress of their children.

- **`warning-issues`**:
  - **Purpose**: Identifies and handles issues flagged with warnings, ensuring that warning labels on child issues are rolled up to parent issues, thereby highlighting potential risks at higher levels in the hierarchy.
