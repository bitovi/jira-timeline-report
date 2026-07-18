# Data Layer Domain Analysis

## Overview

The data layer implements a comprehensive Jira API integration with OAuth authentication, request abstraction, and a multi-stage data processing pipeline. The architecture supports both hosted and Atlassian Connect deployment environments.

## Jira API Integration

### OIDC Helpers Module

Central module for all Jira API interactions using OAuth 2.0:

```typescript
/**
 * Creates the jira oidc helpers object from all helper functions
 */
import { Config, FieldsRequest, RequestHelper, FieldsData } from './types';
import {
  fetchAuthorizationCode,
  refreshAccessToken,
  fetchAccessTokenWithAuthCode,
  getAccessToken,
  hasAccessToken,
  hasValidAccessToken,
} from './auth';

export default function JiraOIDCHelpers(config, requestHelper, host) {
  return {
    // Authentication methods
    fetchAuthorizationCode,
    refreshAccessToken,
    getAccessToken,

    // Data fetching methods
    fetchAllJiraIssuesWithJQL,
    fetchJiraFields,
    fetchIssueTypes,
    fetchJiraSprint,

    // Advanced data operations
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog,
    makeDeepChildrenLoaderUsingNamedFields,
  };
}
```

### Request Helper Abstraction

Environment-specific request handling for hosted vs Connect environments:

```typescript
// Hosted environment
export const getHostedRequestHelper = (config) => {
  return async (url, options = {}) => {
    const token = await getAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };
};

// Connect environment
export const getConnectRequestHelper = () => {
  return async (url, options = {}) => {
    // Use AP.request for Atlassian Connect context
    return new Promise((resolve, reject) => {
      AP.request({
        url,
        type: options.method || 'GET',
        data: options.body,
        success: resolve,
        error: reject,
      });
    });
  };
};
```

## OAuth Authentication Flow

### Token Management

Secure handling of OAuth access and refresh tokens:

```typescript
export const getAccessToken = async (): Promise<string> => {
  const accessToken = await fetchFromLocalStorage('access_token');
  const expiresAt = await fetchFromLocalStorage('expires_at');

  if (!accessToken || !expiresAt) {
    throw new Error('No access token available');
  }

  if (Date.now() >= parseInt(expiresAt)) {
    return await refreshAccessToken();
  }

  return accessToken;
};

export const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = await fetchFromLocalStorage('refresh_token');

  const response = await fetch('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.JIRA_CLIENT_ID,
    }),
  });

  const tokenData = await response.json();
  await saveTokenData(tokenData);
  return tokenData.access_token;
};
```

### Storage Abstraction

Environment-agnostic storage interface for tokens and configuration:

```typescript
export interface AppStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const saveInformationToLocalStorage = async (key: string, value: any) => {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  await storage.setItem(key, stringValue);
};

export const fetchFromLocalStorage = async (key: string) => {
  const value = await storage.getItem(key);
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return value;
  }
};
```

## Data Processing Pipeline

### Multi-Stage Data Transformation

Raw Jira data flows through structured processing stages:

```
Raw Data → Normalized Data → Derived Data → Rolled-up Data
```

### Raw Data Layer

Direct Jira API responses with minimal processing:

```typescript
// Raw issue fetching with JQL
export const fetchAllJiraIssuesWithJQL = async (jql: string) => {
  const issues = await jiraHelper.fetchJiraIssuesWithJQL(jql);
  return {
    issues: issues.issues,
    total: issues.total,
    startAt: issues.startAt,
    maxResults: issues.maxResults,
  };
};
```

### Normalized Data Layer

Standardized data structures for consistent consumption:

```typescript
// Normalize issue data for consistent field access
export const normalizeIssue = (rawIssue) => ({
  id: rawIssue.id,
  key: rawIssue.key,
  summary: rawIssue.fields.summary,
  status: rawIssue.fields.status.name,
  assignee: rawIssue.fields.assignee?.displayName,
  created: new Date(rawIssue.fields.created),
  updated: new Date(rawIssue.fields.updated),
  // Custom field mapping
  customFields: mapCustomFields(rawIssue.fields),
});
```

### Derived Data Layer

Computed values and business logic transformations:

```typescript
// Calculate derived metrics from normalized issues
export const calculateIssueDerivedData = (normalizedIssues) => {
  return normalizedIssues.map((issue) => ({
    ...issue,
    // Calculate working days between dates
    durationInBusinessDays: getBusinessDatesCount(issue.startDate, issue.endDate),
    // Determine if issue is overdue
    isOverdue: issue.dueDate && new Date() > issue.dueDate,
    // Calculate completion percentage
    completionPercentage: calculateCompletionPercentage(issue),
    // Dependency analysis
    dependencies: analyzeDependencies(issue, allIssues),
  }));
};
```

### Rolled-up Data Layer

Aggregated data for reporting and visualization:

```typescript
// Roll up issue data for timeline reporting
export const rollupIssueData = (derivedIssues) => {
  const groupedByEpic = groupBy(derivedIssues, 'epic');

  return Object.entries(groupedByEpic).map(([epic, issues]) => ({
    epic,
    totalIssues: issues.length,
    completedIssues: issues.filter((i) => i.status === 'Done').length,
    totalStoryPoints: sum(issues.map((i) => i.storyPoints)),
    estimatedCompletion: calculateEstimatedCompletion(issues),
    criticalPath: findCriticalPath(issues),
  }));
};
```

## Advanced Data Operations

### Deep Children Loading

Recursive loading of issue hierarchies with named fields:

```typescript
export const makeDeepChildrenLoaderUsingNamedFields = (namedFields) => {
  return async (parentIssue) => {
    const children = await fetchChildrenResponses(parentIssue.key);

    const loadedChildren = await Promise.all(
      children.map(async (child) => {
        const childData = await fetchJiraIssueWithNamedFields(child.key, namedFields);
        const grandChildren = await makeDeepChildrenLoaderUsingNamedFields(namedFields)(child);

        return {
          ...childData,
          children: grandChildren,
        };
      }),
    );

    return loadedChildren;
  };
};
```

### Changelog Processing

Historical data analysis for timeline reconstruction:

```typescript
export const fetchAllJiraIssuesWithJQLAndFetchAllChangelog = async (jql) => {
  const issues = await fetchAllJiraIssuesWithJQL(jql);

  const issuesWithChangelog = await Promise.all(
    issues.map(async (issue) => {
      const changelog = await fetchJiraChangelog(issue.key);
      return {
        ...issue,
        changelog: processChangelog(changelog),
        statusHistory: extractStatusHistory(changelog),
        timeInStatus: calculateTimeInStatus(changelog),
      };
    }),
  );

  return issuesWithChangelog;
};
```

## Caching and Performance

### Query Client Integration

Server state caching through React Query:

```typescript
export const useJiraIssues = (jql: string) => {
  const jira = useJira();

  return useQuery({
    queryKey: ['jira-issues', jql],
    queryFn: () => jira.fetchAllJiraIssuesWithJQL(jql),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

### Field Mapping Optimization

Efficient custom field resolution and caching:

```typescript
export const makeFieldsRequest = (requiredFields) => {
  const fieldMap = new Map();

  return {
    async getFieldValue(issue, fieldName) {
      if (!fieldMap.has(fieldName)) {
        const fieldDef = await fetchFieldDefinition(fieldName);
        fieldMap.set(fieldName, fieldDef);
      }

      const fieldDef = fieldMap.get(fieldName);
      return extractFieldValue(issue, fieldDef);
    },
  };
};
```

## Error Handling and Resilience

### Token Refresh Logic

Automatic token refresh on authentication errors:

```typescript
export const authenticatedRequest = async (url, options) => {
  try {
    return await makeRequest(url, options);
  } catch (error) {
    if (error.status === 401) {
      await refreshAccessToken();
      return await makeRequest(url, options);
    }
    throw error;
  }
};
```

### Rate Limiting and Retry Logic

Graceful handling of API rate limits:

```typescript
export const rateLimitedRequest = async (url, options, retries = 3) => {
  try {
    return await makeRequest(url, options);
  } catch (error) {
    if (error.status === 429 && retries > 0) {
      const retryAfter = parseInt(error.headers['retry-after']) || 1;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return rateLimitedRequest(url, options, retries - 1);
    }
    throw error;
  }
};
```

## Key Data Layer Principles

1. **Abstraction**: Environment-specific request handling through unified interface
2. **Security**: Secure OAuth token management with automatic refresh
3. **Performance**: Multi-level caching and efficient data loading
4. **Resilience**: Comprehensive error handling and retry mechanisms
5. **Flexibility**: Support for custom fields and dynamic data structures
6. **Scalability**: Batched operations and pagination for large datasets
