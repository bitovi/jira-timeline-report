### `/raw/rollback.js` Module

The `/raw/rollback.js` module is designed to handle the rollback of Jira issues to a specified point in time. This rollback process involves reverting changes to fields like sprints, status, and parent links based on the issue's changelog data.

#### `rollbackIssue` Function

The `rollbackIssue` function utilizes the changelog from each Jira issue to apply rollback changes. The changelog contains a history of changes made to the issue, including updates to fields such as sprint, status, and parent link.

The function iterates over these changes and applies them in reverse order, effectively rolling back the issue to its previous state, as of the specified time.
