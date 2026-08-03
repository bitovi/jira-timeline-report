# Hybrid UI Framework Domain

## Overview

The Hybrid UI Framework Domain manages the coexistence of legacy CanJS components with modern React components, providing a migration path while maintaining complex visualization capabilities. This domain implements a bridge architecture that allows both frameworks to operate seamlessly within the same application.

## Architecture Pattern

The application uses a **Progressive Migration Strategy**:

- **Legacy CanJS Layer**: Handles complex timeline visualizations and observable-based state
- **Modern React Layer**: Implements new business logic with hooks-based architecture
- **Bridge Layer**: React services and hooks that interface with CanJS observables

## Key Components

### 1. React-CanJS Bridge System

**Purpose**: Enable React components to consume CanJS observable data

**Core Pattern**: Custom hook that subscribes to CanJS observables

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

**Key Files**:

- `./src/react/hooks/useCanObservable/useCanObservable.ts` - Main bridge hook

### 2. React Service Layer

**Purpose**: Provide modern React services that wrap CanJS functionality

**Core Pattern**: Context providers with typed interfaces

```tsx
type RoutingContext = { linkBuilder: LinkBuilder } | null;

const RoutingContext = createContext<RoutingContext>(null);

export const useRouting = () => {
  const routing = useContext(RoutingContext);

  if (!routing) {
    return {
      linkBuilder(query: string) {
        return query;
      },
    };
  }

  return routing;
};
```

**Key Files**:

- `./src/react/services/routing/RoutingProvider.tsx` - Routing abstraction
- `./src/react/services/jira/JiraProvider.tsx` - Jira API context
- `./src/react/services/storage/StorageProvider.tsx` - Storage abstraction

### 3. Legacy CanJS Visualization Components

**Purpose**: Complex timeline and chart visualizations with rich interactivity

**Core Pattern**: StacheElement-based components with observable data binding

```javascript
import { StacheElement, type, ObservableObject, stache } from '../../can';

export class GanttGrid extends StacheElement {
  static view = stache(/* timeline template */);

  static props = {
    derivedIssues: type.Any,
    roundTo: String,
    // ... observable properties
  };
}
```

**Key Components**:

- `./src/canjs/reports/gantt-grid.js` - Main Gantt chart visualization
- `./src/canjs/reports/scatter-timeline.js` - Scatter plot timelines
- `./src/canjs/reports/status-report.js` - Status reporting
- `./src/canjs/controls/issue-tooltip.js` - Interactive tooltips

### 4. Modern React Component Architecture

**Purpose**: New feature development with modern patterns

**Core Pattern**: Functional components with hooks and TypeScript

```tsx
interface ReportControlsProps {
  // typed props
}

export const ReportControls: FC<ReportControlsProps> = ({ ... }) => {
  const [state, setState] = useState();
  const customHook = useCustomLogic();

  return (
    <div>
      {/* JSX structure */}
    </div>
  );
};
```

**Key Areas**:

- 89 React components in `./src/react/`
- 26 custom hooks for business logic
- Service providers for cross-cutting concerns

## Framework Coexistence Patterns

### 1. Data Flow Integration

**CanJS → React**:

```typescript
// React component consuming CanJS observable
const MyComponent = () => {
  const routeData = useCanObservable(canJSRouteData);
  return <div>{routeData.someProperty}</div>;
};
```

**React → CanJS**:

```typescript
// React component updating CanJS state
const MyComponent = () => {
  const handleUpdate = (value) => {
    canJSRouteData.assign({ someProperty: value });
  };
  // ...
};
```

### 2. Rendering Integration

**React in CanJS**: React components can be rendered within CanJS templates using ReactDOM:

```javascript
// Inside CanJS component
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

// Render React component in CanJS context
const root = createRoot(domElement);
root.render(createElement(ReactComponent, props));
```

### 3. Event System Bridge

Both frameworks use their native event systems but communicate through shared observable state:

- **CanJS**: Uses `on/off` event listeners on observables
- **React**: Uses `useEffect` to subscribe to observable changes
- **Bridge**: `useCanObservable` hook manages subscription lifecycle

## Migration Strategy

### Current State

- **Legacy Components**: Complex visualizations (Gantt, scatter plots) remain in CanJS
- **New Development**: All new features built with React + hooks
- **Shared State**: Central RouteData observable manages application state

### Migration Patterns

1. **Service Extraction**: Extract business logic into React services
2. **Hook Creation**: Wrap CanJS functionality in React hooks
3. **Component Replacement**: Gradually replace CanJS UI with React equivalents
4. **State Management**: Transition from CanJS observables to React state

## TypeScript Integration

The codebase maintains type safety across both frameworks:

```typescript
// Typed interfaces for CanJS observables
export interface CanObservable<TData> {
  value: TData;
  // ... method signatures
}

// React components with full TypeScript support
interface ComponentProps {
  data: SomeType;
}

export const Component: FC<ComponentProps> = ({ data }) => {
  // ...
};
```

## Performance Considerations

1. **Memory Management**: Proper cleanup of CanJS observable subscriptions in React
2. **Render Optimization**: React components avoid unnecessary re-renders from CanJS updates
3. **Event Handling**: Efficient bridging between framework event systems
4. **Bundle Size**: Both frameworks increase overall bundle size

## Key Architectural Decisions

1. **Preserve Visualization Complexity**: Keep CanJS for sophisticated timeline components
2. **React for Business Logic**: New features use modern React patterns
3. **Shared Observable State**: Single source of truth through CanJS RouteData
4. **Gradual Migration**: Incremental transition without breaking existing functionality

This hybrid approach enables the application to leverage the strengths of both frameworks while providing a clear migration path toward modern React architecture.
