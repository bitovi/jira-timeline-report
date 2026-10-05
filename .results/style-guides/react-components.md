# React Components Style Guide

## Overview

React components in this codebase follow specific patterns that distinguish them from standard React conventions, particularly emphasizing context-based compound components, functional styling patterns, and integration with the legacy CanJS observable system.

## Unique Conventions

### 1. Context-Based Compound Components

Components frequently use React Context to create compound component patterns with custom hook abstractions:

```tsx
const AccordionContext = createContext<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
} | null>(null);

export const useAccordion = () => {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error('must use accordion in proper context');
  }

  return context;
};
```

**Pattern**: Custom hooks with error boundary checks for context usage outside provider scope.

### 2. Functional CSS Class Composition

Components use functional helper patterns for dynamic CSS class generation rather than CSS-in-JS:

```tsx
const getButtonClasses = () => {
  return ['uppercase', 'font-bold', 'rounded-sm', 'text-xs', 'p-1'];
};

const getInactiveButtonStyles = (isInactive: boolean) => {
  return [...getButtonClasses(), isInactive ? 'bg-gray-200' : '', !isInactive ? 'text-zinc-400' : '']
    .filter(Boolean)
    .join(' ');
};
```

**Pattern**: Base class functions with conditional class arrays, filtered and joined for final className strings.

### 3. Hierarchical Component Organization

Components are organized in deep hierarchical folder structures reflecting their UI hierarchy:

```
ReportControls/
├── ReportControls.tsx
├── components/
│   ├── ViewSettings/
│   │   ├── ViewSettings.tsx
│   │   ├── components/
│   │   │   ├── GanttViewSettings/
│   │   │   └── ScatterPlotViewSettings/
│   │   └── shared/
│   │       └── components/
│   │           ├── GroupBy/
│   │           ├── RoundDatesTo/
│   │           └── SettingsSection/
```

**Pattern**: Feature-based grouping with `components/` subfolders and `shared/` directories for reusable sub-components.

### 4. Conditional Component Rendering

Components frequently use early returns and conditional rendering based on application state:

```tsx
export const ReportControls: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType === 'estimation-progress' || primaryReportType === 'grouper') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'auto-scheduler') {
    return (
      <ReportControlsWrapper>
        <AutoSchedulerControls />
      </ReportControlsWrapper>
    );
  }
  // ... additional conditions
};
```

**Pattern**: State-driven component switching rather than prop-based rendering.

### 5. Bridge Integration with CanJS

React components integrate with CanJS observables through specialized bridge patterns:

```tsx
// Components consume CanJS observables via useCanObservable hook
const MyComponent = () => {
  const routeData = useCanObservable(canJSRouteData);
  const derivedIssues = routeData.derivedIssues;

  return <div>{/* render based on observable data */}</div>;
};
```

**Pattern**: Observable consumption through custom hooks rather than direct integration.

### 6. Provider Wrapper Components

Components often include separate wrapper components for context provision:

```tsx
export const ReportControlsWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <div className="pt-1">
        <SelectReportType />
      </div>
      <div className="pt-1">
        <SelectIssueType />
      </div>
      {children}
    </>
  );
};
```

**Pattern**: Separate wrapper components that provide common UI structure and context.

### 7. Default Export with Named Hooks

Components export the main component as default while exporting related hooks as named exports:

```tsx
export const useAccordion = () => {
  /* ... */
};

const Accordion: FC<{ children: ReactNode; startsOpen?: boolean }> = ({ children, startsOpen = false }) => {
  // Component implementation
};

export default Accordion;
```

**Pattern**: Default export for the component, named exports for associated utilities and hooks.

## File Structure Conventions

- **Component files**: Named after the component (e.g., `Accordion.tsx`)
- **Index files**: Used for re-exports from component directories
- **Co-location**: Related components grouped in feature-specific directories
- **Shared directories**: Common components placed in `shared/components/` subdirectories

## TypeScript Patterns

- **Props interfaces**: Defined inline rather than separate interface files
- **Generic typing**: Minimal use of complex generics
- **FC typing**: Consistent use of `FC<PropsType>` for component typing
- **Event handlers**: Callback props follow `onActionName` pattern

This component architecture enables the hybrid CanJS-React system while maintaining clear separation of concerns and reusable component patterns.
