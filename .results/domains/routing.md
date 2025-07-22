# Routing Domain Analysis

## Overview

The routing architecture implements a sophisticated bidirectional synchronization between URL parameters and application state using CanJS observables, with support for both hosted and Atlassian Connect deployment environments.

## CanJS Route Data Architecture

### Central Route Observable

All routing state managed through a single CanJS observable:

```javascript
// route-data.js - Central routing state
export default new ObservableObject({
  primaryReportType: value.from('primaryReportType'),
  selectedProjectKey: value.from('selectedProjectKey'),
  jql: value.from('jql'),
  selectedStartDate: value.from('selectedStartDate'),
  selectedEndDate: value.from('selectedEndDate'),
  // ... other route parameters
});
```

### URL State Synchronization

Bidirectional sync between URL parameters and observable state:

```javascript
export const pushStateObservable = new RoutePushstate();
pushStateObservable.replaceStateKeys.push('compareTo');
route.urlData = pushStateObservable;
route.urlData.root = window.location.pathname;
route.register('');

export function saveJSONToUrl(key, defaultValue, Type, converter = JSON) {
  const { stringify, parse } = converter;

  return {
    type: Type,
    value({ lastSet, listenTo, resolve }) {
      const defaultJSON = stringify(typeof defaultValue === 'function' ? defaultValue.call(this) : defaultValue);

      function resolveFromUrl() {
        const parsed = parse(new URL(window.location).searchParams.get(key) || defaultJSON);
        if (parsed && dateMatch.test(parsed)) {
          resolve(new Date(parsed));
        } else {
          resolve(parsed);
        }
      }

      if (lastSet.value) {
        resolve(lastSet.value);
      } else {
        resolveFromUrl();
      }

      listenTo(lastSet, (value) => {
        const valueJSON = stringify(value);
        updateUrlParam(key, valueJSON);
        resolve(value);
      });
    },
  };
}
```

## URL Parameter Management

### Dynamic Parameter Updates

Real-time URL updates without page reload:

```javascript
export function updateUrlParam(key, value) {
  const url = new URL(window.location);

  if (value === null || value === undefined || value === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  history.replaceState({}, '', url);
}

export function getUrlParamValue(key, defaultValue = null) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || defaultValue;
}
```

### Type-Safe Parameter Handling

Automatic serialization/deserialization with type preservation:

```javascript
export function makeArrayOfStringsQueryParamValueButAlsoLookAtReportData(key) {
  return saveJSONToUrl(key, () => [], Array, {
    stringify: (arr) => arr.join(','),
    parse: (str) => (str ? str.split(',').filter(Boolean) : []),
  });
}

export function makeParamAndReportDataReducer(key, defaultValue) {
  return {
    value({ lastSet, listenTo, resolve }) {
      // Initialize from URL or default
      const urlValue = getUrlParamValue(key);
      const initialValue = urlValue ? JSON.parse(urlValue) : defaultValue;
      resolve(initialValue);

      // Listen for programmatic changes
      listenTo(lastSet, (newValue) => {
        updateUrlParam(key, JSON.stringify(newValue));
        resolve(newValue);
      });

      // Listen for URL changes (back/forward)
      listenToUrlChange(key, (newValue) => {
        resolve(JSON.parse(newValue || JSON.stringify(defaultValue)));
      });
    },
  };
}
```

## Environment-Specific Routing

### Link Builder Abstraction

Different link generation for hosted vs Connect environments:

```typescript
// Web environment
export const createWebLinkBuilder: LinkBuilderFactory = () => {
  return (queryParams) => queryParams;
};

// Connect environment would implement differently
export const createConnectLinkBuilder: LinkBuilderFactory = () => {
  return (queryParams) => {
    // Transform for Atlassian Connect context
    return transformForConnect(queryParams);
  };
};
```

### Route Configuration

Environment-aware routing setup:

```typescript
export default async function mainHelper(config, { host, createLinkBuilder, configureRouting }) {
  // Configure routing based on environment
  configureRouting(route);

  const linkBuilder = createLinkBuilder();

  if (host === 'jira') {
    // Jira Connect specific routing
    setupConnectRouting();
  } else {
    // Hosted environment routing
    setupHostedRouting();
  }
}
```

## React Integration

### Route Data Hook

Bridge CanJS routing to React components:

```typescript
export const useRouteData = () => {
  const [routeData] = useState(() => routeDataInstance);
  return routeData;
};

export const useSelectedStartDate = () => {
  const routeData = useRouteData();
  const selectedStartDate = useCanObservable(routeData.selectedStartDate);

  const setSelectedStartDate = (date: Date) => {
    routeData.selectedStartDate.value = date;
  };

  return { selectedStartDate, setSelectedStartDate };
};
```

### Query Parameter Hooks

Convenient hooks for common routing operations:

```typescript
export const useQueryParams = () => {
  const [params, setParams] = useState(() => {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  });

  const updateQueryParam = (key: string, value: string | null) => {
    const url = new URL(window.location);

    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }

    history.replaceState({}, '', url);
    setParams(Object.fromEntries(url.searchParams));
  };

  useEffect(() => {
    const handlePopState = () => {
      setParams(Object.fromEntries(new URLSearchParams(window.location.search)));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { params, updateQueryParam };
};
```

## State Persistence

### Local Storage Integration

Route data persistence across sessions:

```javascript
export function saveToLocalStorage(key, defaultValue) {
  return {
    value({ lastSet, listenTo, resolve }) {
      resolve(JSON.parse(localStorage.getItem(key)) || defaultValue);

      listenTo(lastSet, (value) => {
        localStorage.setItem(key, JSON.stringify(value));
        resolve(value);
      });
    },
  };
}
```

### Report Data Synchronization

Complex state management for saved reports:

```javascript
export function saveJSONToUrlButAlsoLookAtReportData_LongForm(key, defaultValue) {
  return {
    value({ lastSet, listenTo, resolve }) {
      // Check report data first
      const reportValue = getReportDataValue(key);
      if (reportValue !== undefined) {
        resolve(reportValue);
        return;
      }

      // Fall back to URL parameter
      const urlValue = getUrlParamValue(key);
      if (urlValue) {
        resolve(JSON.parse(urlValue));
        return;
      }

      // Use default value
      resolve(defaultValue);

      // Listen for changes and update both URL and report data
      listenTo(lastSet, (value) => {
        updateUrlParam(key, JSON.stringify(value));
        updateReportData(key, value);
        resolve(value);
      });
    },
  };
}
```

## Navigation Control

### Programmatic Navigation

Controlled navigation with state preservation:

```javascript
export function directlyReplaceUrlParam(key, value) {
  const url = new URL(window.location);

  if (value === null || value === undefined) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, JSON.stringify(value));
  }

  // Use replaceState to avoid creating history entries
  history.replaceState({}, '', url);

  // Trigger observable updates
  triggerRouteUpdate(key, value);
}

export function paramValue(key, defaultValue) {
  return {
    get value() {
      return getUrlParamValue(key, defaultValue);
    },
    set value(newValue) {
      directlyReplaceUrlParam(key, newValue);
    },
  };
}
```

### History Management

Careful history management to prevent unwanted navigation:

```javascript
// Override replaceState to control history behavior
const underlyingReplaceState = history.replaceState;

history.replaceState = function (state, title, url) {
  // Custom logic for route management
  if (shouldReplaceState(url)) {
    underlyingReplaceState.call(history, state, title, url);
  } else {
    // Handle differently for certain route changes
    handleSpecialRouting(state, title, url);
  }
};
```

## Legacy Routing Migration

### Backward Compatibility

Support for legacy route parameter formats:

```javascript
export async function legacyPrimaryReportingTypeRoutingFix() {
  // Handle old parameter formats
  const legacyParam = getUrlParamValue('reportType');
  if (legacyParam) {
    const newParam = migrateLegacyReportType(legacyParam);
    updateUrlParam('primaryReportType', newParam);
    updateUrlParam('reportType', null); // Remove legacy param
  }
}

export async function legacyPrimaryIssueTypeRoutingFix() {
  // Handle legacy issue type parameters
  const legacyIssueType = getUrlParamValue('issueType');
  if (legacyIssueType) {
    const newIssueType = migrateLegacyIssueType(legacyIssueType);
    updateUrlParam('selectedIssueTypes', JSON.stringify([newIssueType]));
    updateUrlParam('issueType', null);
  }
}
```

## Key Routing Principles

1. **Bidirectional Sync**: URL and application state always in sync
2. **Type Safety**: Automatic serialization with type preservation
3. **Environment Awareness**: Different behavior for hosted vs Connect
4. **History Management**: Careful control of browser history
5. **Performance**: Minimal re-renders through efficient observable updates
6. **Backward Compatibility**: Support for legacy URL formats
7. **State Persistence**: Route data survives page reloads and sessions
