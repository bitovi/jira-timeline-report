# React Hooks Style Guide

## Unique Patterns

### Observable Bridge Pattern

Custom hook pattern for bridging CanJS observables to React:

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

### Tuple Return Pattern

Hooks consistently return tuples for state and setter:

```typescript
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    // initialization logic
  });

  const setValue = (value: T | ((val: T) => T)) => {
    // update logic
  };

  return [storedValue, setValue] as const;
};
```

### Route Data Integration

Hooks that integrate with CanJS route data observables:

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

### Generic Type Constraints

Sophisticated TypeScript generics for type safety:

```typescript
export type CanObservable<T> = {
  value: T;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
};
```

### Index File Exports

All hooks use re-export pattern through index files:

```typescript
// index.ts
export * from './useUncertaintyWeight';
```
