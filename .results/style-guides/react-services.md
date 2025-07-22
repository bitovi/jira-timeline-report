# React Services Style Guide

## Unique Patterns

### Query Key Factory Pattern

Consistent query key generation for React Query:

```typescript
export const reportKeys = {
  allReports: ['reports'] as const,
  recentReports: ['reports', 'recent'] as const,
};
```

### Suspense Query Pattern

All data fetching uses suspense queries:

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

### Service Hook Typing

Explicit type definitions for service hooks:

```typescript
export type UseAllReports = () => Reports;
```

### Context Provider Pattern

Dependency injection through typed React Context:

```typescript
export const StorageProvider: FC<StorageProviderProps> = ({ storage, children }) => {
  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};
```
