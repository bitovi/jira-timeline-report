# State Management Domain Analysis

## Overview

The state management architecture follows a hybrid approach combining modern React patterns with legacy CanJS observables, using React Query for server state and React Context for dependency injection.

## React Query for Server State

### Query Client Configuration

Central query client for all server state management:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();
```

### Query Key Factory Pattern

Consistent query key generation using factory functions:

```typescript
export const reportKeys = {
  allReports: ['reports'] as const,
  recentReports: ['reports', 'recent'] as const,
};

export const featuresKeyFactory = {
  features: ['features'] as const,
};
```

### Suspense Query Integration

All data fetching uses suspense queries for consistent loading states:

```typescript
export const useAllReports: UseAllReports = () => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: reportKeys.allReports,
    queryFn: async () => {
      return getAllReports(storage);
    },
  });

  return data;
};
```

## React Context for Dependency Injection

### Provider Pattern Implementation

Core services are injected through React Context providers:

```typescript
// JiraProvider for API access
export const JiraProvider: FC<JiraProviderProps> = ({ jira, children }) => {
  return <JiraContext.Provider value={jira}>{children}</JiraContext.Provider>;
};

// StorageProvider for persistence
export const StorageProvider: FC<StorageProviderProps> = ({ storage, children }) => {
  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};
```

### Typed Context Hooks

Type-safe context consumption with error handling:

```typescript
export const useJira = () => {
  const jira = useContext(JiraContext);
  if (!jira) {
    throw new Error('Cannot use useJira outside of its provider');
  }
  return jira;
};

export const useStorage = () => {
  const storage = useContext(StorageContext);
  if (!storage) {
    throw new Error('Cannot use useStorage outside of its provider');
  }
  return storage;
};
```

## Legacy CanJS Observable Integration

### Observable Bridge Hook

The `useCanObservable` hook bridges CanJS observables to React state:

```typescript
export const useCanObservable = <T>(observable: CanObservable<T>): T => {
  const [state, setState] = useState<T>(observable.value);

  useEffect(() => {
    const handler = () => setState(observable.value);
    observable.on('change', handler);
    return () => observable.off('change', handler);
  }, [observable]);

  return state;
};
```

### Route Data Observable

Central routing state managed through CanJS observable:

```javascript
// route-data.js contains complex observable state for routing
export default new ObservableObject({
  // Routing parameters and state
  primaryReportType: value.from('primaryReportType'),
  selectedProjectKey: value.from('selectedProjectKey'),
  // ... other route parameters
});
```

### URL State Synchronization

Bidirectional sync between URL parameters and application state:

```javascript
export const pushStateObservable = (paramName, observable) => {
  // Listen to observable changes and update URL
  observable.on('change', (newValue) => {
    updateUrlParam(paramName, newValue);
  });

  // Listen to URL changes and update observable
  listenToUrlChange(paramName, (newValue) => {
    observable.value = newValue;
  });
};
```

## Local Storage Integration

### Custom Local Storage Hook

Persistent state management with automatic serialization:

```typescript
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
};
```

### Storage Abstraction Layer

Environment-agnostic storage interface:

```typescript
export interface AppStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Web implementation
export const createWebAppStorage = (): AppStorage => ({
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
});
```

## Form State Management

### React Hook Form Integration

Form state handled through React Hook Form for complex forms:

```typescript
import { useForm } from 'react-hook-form';

export const FeatureRequestForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (data) => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('title', { required: true })} />
      {errors.title && <span>This field is required</span>}
    </form>
  );
};
```

## State Management Patterns

### Service Layer Pattern

Business logic encapsulated in service hooks:

```typescript
export const useSaveReports = () => {
  const storage = useStorage();

  return useMutation({
    mutationFn: async (report: Report) => {
      return saveReport(storage, report);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.allReports });
    },
  });
};
```

### Custom Hooks for Complex State

Domain-specific state logic extracted into custom hooks:

```typescript
export const useSelectedStartDate = () => {
  const routeData = useRouteData();

  const selectedStartDate = useCanObservable(routeData.selectedStartDate);

  const setSelectedStartDate = (date: Date) => {
    routeData.selectedStartDate.value = date;
  };

  return { selectedStartDate, setSelectedStartDate };
};
```

## Key State Management Principles

1. **Separation of Concerns**: Server state (React Query) vs Client state (React hooks)
2. **Single Source of Truth**: Route data observable for URL-synchronized state
3. **Type Safety**: All state operations are type-safe with TypeScript
4. **Error Boundaries**: Proper error handling for context misuse
5. **Performance**: Minimal re-renders through proper dependency management
6. **Legacy Integration**: Seamless bridge between CanJS and React ecosystems
