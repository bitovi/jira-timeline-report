### `/normalized/normalize.ts` Module

The `/normalized/normalize.ts` module standardizes raw Jira issue data to ensure consistency across varying Jira configurations. This allows the data to be further processed (e.g., calculating derived metrics or rollups) without needing to account for differences in how fields are defined or stored across different Jira projects.

### `/normalized/defaults.ts` File

The `/normalized/defaults.ts` file provides default handlers for each field in the Jira issue. These default handlers are called by the `normalizeIssue` function to retrieve and normalize field data, ensuring consistency across different Jira projects.

### Data Flow

#### Fetching Data

The raw Jira issue is passed into the `normalizeIssue` function, which uses default handlers to extract key fields like `storyPoints`, `dueDate`, `parentKey`, and `sprints`.

#### Team Data

The team key is derived from the issue, and the team’s velocity, points per day, and parallel work limit are calculated.

#### Field Normalization

Each field is processed by its corresponding handler in `defaults.ts`. For example:

- **Sprints** are normalized into a list of sprint objects with start and end dates.
- **Statuses** are converted into a consistent format.
- **Dates** (e.g., start date, due date) are parsed into local time zones.

#### Creating a `NormalizedIssue`

The function compiles all the normalized fields into a `NormalizedIssue` object. This object includes information like the issue’s key, story points, status, sprint data, and associated releases, making it ready for further processing in the tool (e.g., calculating derived metrics, rolling up data).
