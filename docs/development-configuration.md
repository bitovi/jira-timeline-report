# Development Configuration

The Timeline Reporter uses a configuration Jira issue to store its data and a feature flag to determine whether to use the production or development issue.

## Creating a Development Issue:

Add a `Jira Timeline Report Configuration (Development)` issue to your Jira backlog. The issue can be of any type or in any project that users have access to. It can be closed.

## Enabling the Development Issue:

To use the development issue, enable the feature flag by following these steps:

1. Open the developer console.
2. Access the feature flags object from the Feature flags log.
3. Click the `(...)` next to the `devConfigurationIssue toggle value`.

The page will reload with the newly enabled feature flag.
