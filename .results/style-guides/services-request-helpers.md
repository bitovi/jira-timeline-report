# Services & Request Helpers Style Guide

## Overview

Service layer and request helpers in this codebase follow functional patterns for API abstraction, authentication management, and external service integration. They emphasize configuration-driven design and promise-based asynchronous operations.

## Unique Conventions

### 1. Factory Function Pattern for Request Helpers

Request helpers are created through factory functions that accept configuration:

```javascript
export function getHostedRequestHelper(config) {
  const { JIRA_API_URL } = config;

  return function (urlFragment) {
    return new Promise(async (resolve, reject) => {
      try {
        const scopeIdForJira = fetchFromLocalStorage('scopeId');
        const accessToken = fetchFromLocalStorage('accessToken');

        // Token validation and URL construction logic...
        const result = await fetchJSON(requestUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
```

**Pattern**: Factory functions returning configured request functions, promise wrapper around async operations.

### 2. Authentication Token Management

Complex token lifecycle management with automatic refresh:

```javascript
if (accessToken) {
  const timeLeft = timeRemainingBeforeAccessTokenExpiresInSeconds();
  const FIVE_SECONDS = 5;

  if (timeLeft < FIVE_SECONDS) {
    if (!hasShownPopUp) {
      hasShownPopUp = true;
      alert('Your access token needs to be refreshed. Taking you to Atlassian to reauthorize');
    }
    fetchAuthorizationCode(config);
    return new Promise(function () {}); // Never resolves
  }
}
```

**Pattern**: Proactive token expiration checking, global popup state management, infinite promise for redirect scenarios.

### 3. URL Construction Strategy

Flexible URL handling for both relative and absolute URLs:

```javascript
let requestUrl;
if (urlFragment.startsWith('https://')) {
  requestUrl = urlFragment;
} else {
  requestUrl = `${JIRA_API_URL}/${scopeIdForJira}/rest/${urlFragment}`;
}
```

**Pattern**: Protocol detection for URL type, dynamic base URL construction with scope IDs.

### 4. Atlassian Connect Integration

Dual-mode operation for different deployment contexts:

```javascript
export function getConnectRequestHelper() {
  return function (requestUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        let result;

        if (requestUrl.startsWith('https://')) {
          result = await fetchJSON(requestUrl, {});
        } else {
          result = JSON.parse((await AP.request(`/rest/${requestUrl}`)).body);
        }
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
```

**Pattern**: Environment-specific request strategies (AP.request vs fetch), JSON parsing abstraction.

### 5. Statistical Analysis Services

Complex mathematical operations for timeline analysis:

```javascript
export function addHistoricalAdjustedEstimatedTime(issuesOrReleases, rollupTimingLevelsAndCalculations) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rollupMethods = rollupTimingLevelsAndCalculations.map((rollupData) => rollupData.calculation).reverse();
  const rolledUpHistoricalAdjustedEstimates = rollupHistoricalAdjustedEstimatedTime(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(
    groupedIssues,
    rolledUpHistoricalAdjustedEstimates,
    'historicalAdjustedEstimatedTime',
  );
  return zipped.flat();
}
```

**Pattern**: Functional composition of data transformations, pipeline processing with intermediate data structures.

### 6. Rule-Based Status Systems

Declarative rule configuration for dynamic status calculation:

```javascript
const RULES = [
  {
    reportStatus: 'Complete',
    rule: {
      '==': [{ var: 'statusCategory' }, 'Done'],
    },
  },
  {
    reportStatus: 'Blocked',
    rule: {
      selfOrAnyChild: [
        {
          '==': [{ var: 'status' }, 'Blocked'],
        },
      ],
    },
  },
  {
    reportStatus: 'Warning',
    rule: {
      selfOrAnyChild: [
        {
          some: [{ var: 'label' }, { '==': [{ var: '' }, 'Warning'] }],
        },
      ],
    },
  },
];
```

**Pattern**: JSON-based rule definitions, nested logical operators, variable references for data access.

### 7. Feature Flag Integration

Service-level feature flags for experimental functionality:

```javascript
import { defineFeatureFlag } from '../../../shared/feature-flag';

export const FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES = defineFeatureFlag(
  'historicallyAdjustedEstimates',
  `
    Log historically adjusted estimates and other data
  `,
  false,
);
```

**Pattern**: Exported feature flag constants, descriptive multi-line comments, default false values.

### 8. Metadata-Driven Processing

Services use metadata objects to control processing behavior:

```javascript
return rollupGroupedHierarchy(groupedHierarchy, {
  createMetadataForHierarchyLevel(hierarchyLevel) {
    return {
      hierarchyLevel,
      baselineMockData: [],
      needsMockData: [],
    };
  },
  finalizeMetadataForHierarchyLevel(metadata, rollupData) {
    const mockData = createMockDataFromBaseline(metadata.baselineMockData);
    metadata.needsMockData.forEach((needsMock) => {
      needsMock.splice(0, 0, ...mockData);
    });
  },
  createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata) {
    // Processing logic...
  },
});
```

**Pattern**: Configuration objects with lifecycle hooks, metadata accumulation across processing stages.

### 9. Promise Wrapper Pattern

Consistent promise wrapping for async operations:

```javascript
return new Promise(async (resolve, reject) => {
  try {
    // Async operation logic
    resolve(result);
  } catch (ex) {
    reject(ex);
  }
});
```

**Pattern**: Explicit promise construction, try-catch error handling, async function within promise constructor.

### 10. Local Storage Abstraction

Functional wrappers for browser storage:

```javascript
function fetchFromLocalStorage(key) {
  return window.localStorage.getItem(key);
}
```

**Pattern**: Single-purpose functions for storage operations, consistent naming conventions.

## File Structure Conventions

- **Factory Functions**: Request helpers as factory functions returning configured instances
- **Environment Detection**: Separate helpers for hosted vs. connect deployment modes
- **Feature Organization**: Services grouped by domain (auth, data processing, rules)
- **Error Handling**: Consistent try-catch patterns with promise rejection

## Integration Patterns

- **Authentication**: Token-based with automatic refresh and user notification
- **API Communication**: Abstracted through environment-specific request helpers
- **Data Processing**: Functional pipeline patterns with intermediate transformations
- **Configuration**: Externalized configuration through factory function parameters

This service architecture provides a clean abstraction layer for external API communication while supporting complex data processing workflows for timeline analysis and statistical calculations.
