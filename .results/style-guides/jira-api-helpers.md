# Jira API Helpers Style Guide

## Unique Patterns

### Comprehensive Export Object

Single module exports all Jira functionality:

```typescript
export default function JiraOIDCHelpers(config, requestHelper, host) {
  return {
    fetchAuthorizationCode,
    refreshAccessToken,
    fetchAllJiraIssuesWithJQL,
    fetchJiraFields,
    makeDeepChildrenLoaderUsingNamedFields,
  };
}
```

### Async Function Patterns

All API functions are async with proper error handling:

```typescript
export const fetchAllJiraIssuesWithJQL = async (jql: string) => {
  try {
    const response = await jiraHelper.fetchJiraIssuesWithJQL(jql);
    return response;
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${error.message}`);
  }
};
```

### Type-Safe Configuration

Comprehensive typing for configuration objects:

```typescript
export interface Config {
  JIRA_CLIENT_ID: string;
  JIRA_SCOPE: string;
  JIRA_CALLBACK_URL: string;
  JIRA_API_URL: string;
}
```
