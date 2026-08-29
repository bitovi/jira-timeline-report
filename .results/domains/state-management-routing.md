# State Management & Routing Domain

## Overview

The State Management & Routing Domain implements a sophisticated observable-based state management system with URL synchronization, supporting deep linking, bookmarking, and multi-environment routing. The domain uses a central RouteData observable that manages application state while keeping URL parameters in sync.

## Architecture Pattern

The domain follows an **Observable State with URL Persistence** pattern:

- **Central RouteData Observable**: Single source of truth for application state
- **URL Synchronization**: Bidirectional sync between state and URL parameters
- **Report Data Integration**: State can be initialized from saved report configurations
- **Multi-Environment Routing**: Separate routing strategies for web app vs Jira plugin

## Key Components

### 1. Central RouteData Observable (`./src/canjs/routing/route-data/route-data.js`)

**Purpose**: Main application state container with observable properties

**Core Pattern**: CanJS ObservableObject with computed properties and reactive updates

```javascript
export class RouteData extends ObservableObject {
  static props = {
    // Core dependencies
    jiraHelpers: { enumerable: false, default: null },
    isLoggedInObservable: { enumerable: false, default: null },
    storage: { enumerable: false, default: null },

    // URL-synchronized properties
    jql: saveJSONToUrlButAlsoLookAtReport_DataWrapper('jql', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),

    primaryReportType: saveJSONToUrlButAlsoLookAtReport_DataWrapper('primaryReportType', REPORTS[0].key, String, {
      parse: function (x) {
        if (REPORTS.find((report) => report.key === x)) {
          return x;
        } else {
          return REPORTS[0].key;
        }
      },
      stringify: (x) => '' + x,
    }),

    // ... 30+ other properties
  };
}
```

**State Categories**:

- **Query Parameters**: JQL, filters, date ranges
- **Report Configuration**: Report type, grouping, sorting options
- **UI State**: Sidebar visibility, modal states
- **Data Processing Options**: Field mappings, team configurations

### 2. State-URL Synchronization System (`./src/canjs/routing/state-storage.js`)

**Purpose**: Bidirectional synchronization between observable state and URL parameters

**Core Pattern**: Factory functions that create observable properties with URL persistence

```javascript
export function saveJSONToUrlButAlsoLookAtReport_DataWrapper(key, defaultValue, Type, converter = JSON) {
  const { stringify, parse } = converter;

  return {
    value({ lastSet, listenTo, resolve }) {
      let state = {
        urlValue: undefined,
        reportData: undefined,
      };

      // Listen to report data changes
      listenTo('reportData', ({ value }) => reportDataChanged(value));

      // Listen to URL changes
      listenToUrlChange(key, listenTo, (value) => {
        resolveValueFromState(state, 'urlValue', value);
      });

      function resolveValueFromState(state, event, data) {
        const newState = { ...state, [event]: data };

        // Priority order: URL > Report Data > Default
        if (newState.urlValue) {
          parseAndResolve(newState.urlValue);
        } else if (newState.reportData) {
          parseAndResolve(newState.reportData);
        } else {
          parseAndResolve(defaultJSON);
        }
      }
    },
  };
}
```

**Synchronization Features**:

- **URL-First Priority**: URL parameters override saved report data
- **Report Data Fallback**: Use saved report values when URL is empty
- **Default Values**: Graceful fallback to sensible defaults
- **Type Conversion**: Automatic parsing/stringifying with custom converters

### 3. Multi-Environment Routing (`./src/routing/`)

**Purpose**: Abstract routing differences between web app and Jira plugin deployments

**Core Pattern**: Configuration-based routing with environment-specific implementations

```typescript
export interface RoutingConfiguration {
  reconcileRoutingState: () => void;
  syncRouters: () => void;
}

// Plugin routing (index.plugin.ts)
const routingConfig: RoutingConfiguration = {
  reconcileRoutingState: () => {
    const jiraRoutingQueryParams = AP?.history.getState('all')?.query ?? {};
    history.replaceState(null, '', '?' + objectToQueryString(jiraRoutingQueryParams));
  },

  syncRouters: () => {
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      AP?.history.replaceState({
        query: queryStringToObject(window.location.search),
        state: { fromPopState: 'false' },
      });
    };
  },
};
```

**Environment Differences**:

- **Web App**: Standard browser history API
- **Jira Plugin**: Atlassian Connect AP.history API integration
- **Link Building**: Different URL generation strategies per environment

### 4. Query Parameter Factories

**Purpose**: Create type-safe observable properties with URL synchronization

**Array Parameters**:

```javascript
export function makeArrayOfStringsQueryParamValueButAlsoLookAtReportData(key, getDefault = () => []) {
  function parse(value) {
    return !value ? getDefault() : value.split(',');
  }

  function stringify(value) {
    if (!value) {
      return '';
    } else if (Array.isArray(value)) {
      return value.join(',');
    } else {
      return JSON.stringify(value);
    }
  }

  return makeParamAndReportDataReducer({
    key,
    parse,
    stringify,
    checkIfChanged(newValue, currentValue) {
      if (!Array.isArray(currentValue)) {
        return true;
      } else if (diff.list(newValue, currentValue).length) {
        return true;
      }
    },
    defaultValue: stringify(getDefault()),
  });
}
```

**Complex Object Parameters**:

```javascript
// Timing calculations stored as "type:calculation,type:calculation"
timingCalculations: {
  value({ resolve, lastSet, listenTo }) {
    function parse(value) {
      let phrases = value.split(',');
      const data = {};
      for (let phrase of phrases) {
        const parts = phrase.split(':');
        data[parts[0]] = parts[1];
      }
      return data;
    }

    function stringify(obj) {
      return Object.keys(obj)
        .map((key) => key + ':' + obj[key])
        .join(',');
    }
    // ... synchronization logic
  }
}
```

## State Categories

### 1. Report Configuration State

- `primaryReportType` - Main visualization type
- `secondaryReportType` - Additional chart overlays
- `selectedIssueType` - Issue hierarchy selection
- `groupBy` - Grouping criteria
- `sortByDueDate` - Sort preferences

### 2. Data Filtering State

- `jql` - Jira Query Language string
- `statusesToExclude` - Filtered status values
- `releasesToShow` - Release filtering
- `planningStatuses` - Planning phase statuses

### 3. Temporal State

- `compareTo` - Time comparison baseline
- `selectedStartDate` - Project start date
- `roundTo` - Date rounding preferences
- `uncertaintyWeight` - Monte Carlo parameters

### 4. UI State

- `showSettings` - Sidebar visibility
- `openAutoSchedulerModal` - Modal states
- `showPercentComplete` - Display options

## Data Flow Patterns

### 1. State Initialization

```javascript
// Priority order for state resolution
if (urlParam != null) {
  resolve(urlParam); // 1. URL parameter
} else if (reportDataParam != null) {
  resolve(reportDataParam); // 2. Saved report data
} else {
  resolve(defaultValue); // 3. Default value
}
```

### 2. State Updates

```javascript
// User interaction updates both state and URL
listenTo(lastSet, (value) => {
  const param = this.reportData && paramValue(this.reportData, key);
  updateUrlParam(key, value, param || '');
});
```

### 3. Cross-State Dependencies

```javascript
// Properties can listen to other properties
listeners: {
  primaryIssueType({ state, updateUrlParam }, { value }) {
    if (value === 'Release') {
      updateUrlParam('groupBy', '');  // Clear incompatible grouping
    }
  },
}
```

## Performance Features

### 1. Change Detection

```javascript
checkIfChanged(newValue, currentValue) {
  if (!Array.isArray(currentValue)) {
    return true;
  } else if (diff.list(newValue, currentValue).length) {
    return true;
  }
}
```

### 2. Debounced URL Updates

- Prevents excessive history entries
- Batches rapid state changes
- Maintains responsive UI during rapid updates

### 3. Lazy Computation

- Computed properties only calculate when dependencies change
- Async properties resolve independently
- Memoization of expensive calculations

## Integration Points

### Input Sources

- URL query parameters
- Saved report configurations
- User interactions through React components
- Jira API responses

### Output Consumers

- React components via `useCanObservable`
- CanJS templates through direct binding
- Timeline visualization components
- Export and sharing functionality

This domain enables sophisticated state management while maintaining URL bookmarkability and providing seamless user experience across different deployment environments.
