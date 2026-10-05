# React Hooks Style Guide

## Overview

React hooks in this codebase follow distinctive patterns that emphasize type safety, observable integration, and configuration-driven APIs. The hooks are designed to bridge React patterns with the CanJS observable system while providing flexible, reusable abstractions.

## Unique Conventions

### 1. CanJS Observable Bridge Pattern

The most distinctive pattern is the integration with CanJS observables through specialized bridge hooks:

```typescript
export interface CanObservable<TData> {
  value: TData;
  getData(): TData;
  on(handler: () => void): void;
  off(handler: () => void): void;
  set(value: TData): void;
  get(): TData;
}

export const useCanObservable = <TData>(observable: CanObservable<TData>): TData => {
  const [value, setValue] = useState<TData>(observable.value);

  useEffect(() => {
    const handler = () => {
      setValue(observable.value);
    };

    observable.on(handler);

    return () => {
      observable.off(handler);
    };
  }, [observable]);

  return value;
};
```

**Pattern**: Custom interface definitions for CanJS objects with React state synchronization and proper cleanup.

### 2. Configuration Object Pattern

Hooks accept configuration objects with serialization/deserialization options:

```typescript
export const useLocalStorage = <TData = string>(
  key: string,
  config?: { serialize?: (data: TData) => string; deserialize?: (value: string) => TData },
) => {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = config ?? {};

  const [value, setValue] = useState(() => deserialize(localStorage.getItem(key) ?? '') as TData);

  const set: Dispatch<SetStateAction<TData>> = (newValue) => {
    try {
      const evaluated = newValue instanceof Function ? newValue(value) : newValue;
      window.localStorage.setItem(key, serialize(evaluated));
      setValue(evaluated);
    } catch (error) {
      console.warn(['Could not set local storage at key ' + key].join('\n'));
    }
  };

  return [value, set] as const;
};
```

**Pattern**: Optional configuration objects with default implementations, custom serializers, and error handling.

### 3. Tuple Return with `as const`

Hooks consistently return tuples with `as const` assertion for proper TypeScript inference:

```typescript
return [value, set] as const;
return [debouncedValue] as const; // Single value still in tuple for consistency
```

**Pattern**: Always return arrays with `as const` for immutable tuple typing.

### 4. Generic Type Constraints

Hooks use generic type parameters with sensible defaults:

```typescript
export const useLocalStorage = <TData = string>(...)
export function useDebounce<T>(value: T, delay: number): T
export const useCanObservable = <TData>(observable: CanObservable<TData>): TData
```

**Pattern**: Generic types with default string type for localStorage, no constraints for other generics.

### 5. Domain-Specific State Hooks

Many hooks are domain-specific and handle application-level state management:

```typescript
// Route data integration
export const useRouteData = () => {
  const routeData = useCanObservable(routeDataObservable);
  return routeData;
};

// Report type management
export const usePrimaryReportType = () => {
  const routeData = useRouteData();
  return [routeData.primaryReportType, (value) => routeData.assign({ primaryReportType: value })];
};
```

**Pattern**: Hooks that wrap observable access with domain-specific APIs.

### 6. Error Boundary Patterns

Hooks include defensive programming with try-catch blocks and warning messages:

```typescript
try {
  const evaluated = newValue instanceof Function ? newValue(value) : newValue;
  window.localStorage.setItem(key, serialize(evaluated));
  setValue(evaluated);
} catch (error) {
  console.warn(['Could not set local storage at key ' + key].join('\n'));
}
```

**Pattern**: Graceful error handling with console warnings rather than throwing errors.

### 7. Functional Update Support

State setter hooks support both direct values and functional updates:

```typescript
const evaluated = newValue instanceof Function ? newValue(value) : newValue;
```

**Pattern**: Manual checking for function instances to support React's functional update pattern.

### 8. Lazy Initial State

Hooks use lazy initialization for expensive initial state computation:

```typescript
const [value, setValue] = useState(() => deserialize(localStorage.getItem(key) ?? '') as TData);
```

**Pattern**: Arrow functions for lazy evaluation of initial state, especially for localStorage access.

## File Structure Conventions

- **Hook files**: Named with `use` prefix matching the hook name
- **Index files**: Re-export hooks from their directories
- **Typing**: Inline type definitions unless shared across multiple hooks
- **Organization**: Grouped by functionality (e.g., `useCanObservable`, `useLocalStorage`)

## Integration Patterns

- **Observable Integration**: All CanJS integration goes through `useCanObservable`
- **Storage Integration**: localStorage access abstracted through `useLocalStorage`
- **State Management**: Domain state accessed through specialized hooks that wrap route data
- **Type Safety**: Full TypeScript support with proper generic constraints

This hook architecture enables seamless integration between React components and the CanJS observable system while maintaining type safety and React best practices.
