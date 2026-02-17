# UI Domain Analysis

## Overview

The UI domain in this project follows a hybrid React + legacy CanJS architecture, with a strong emphasis on Atlassian Design System integration for seamless Jira integration.

## Component Architecture

### React Components Pattern

The project uses functional React components with TypeScript:

```tsx
// Example: Accordion component with Context pattern
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

const Accordion: FC<{ children: ReactNode; startsOpen?: boolean }> = ({ children, startsOpen = false }) => {
  const [isOpen, setIsOpen] = useState(startsOpen);
  return (
    <AccordionContext.Provider value={{ isOpen, setIsOpen }}>
      <div>{children}</div>
    </AccordionContext.Provider>
  );
};
```

### Component Organization

- Components are organized in dedicated folders with `index.ts` barrel exports
- Each component folder contains the main component file and related utilities
- Testing files are co-located using `.test.tsx` naming convention

### Atlassian Design System Integration

Extensive use of @atlaskit components for consistent Jira integration:

```tsx
import Button from '@atlaskit/button';
import { Checkbox } from '@atlaskit/checkbox';
import DropdownMenu from '@atlaskit/dropdown-menu';
import { TextField } from '@atlaskit/textfield';
```

## Styling Approach

### TailwindCSS + CSS Modules Hybrid

The project combines TailwindCSS utility classes with custom CSS:

```javascript
// CSS module imports with assert syntax
import primitives from './primitives.css' assert { type: 'css' };
import colors from './colors.css' assert { type: 'css' };
import fonts from './fonts.css' assert { type: 'css' };
```

Styling configuration includes:

- Custom color tokens aligned with Jira's design system
- Responsive utilities with container queries
- Custom font families including Atlassian's Poppins

## Legacy CanJS Integration

### StacheElement Components

Legacy components use CanJS StacheElement pattern:

```javascript
export class TimelineReport extends StacheElement {
  static view = `<div class="timeline-report">...</div>`;
  static props = {
    // Component properties
  };
}
customElements.define('timeline-report', TimelineReport);
```

### Bridging CanJS to React

The `useCanObservable` hook bridges CanJS observables to React:

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

## State Management Patterns

### React Context Providers

Dependency injection through React Context:

```tsx
export const JiraProvider: FC<JiraProviderProps> = ({ jira, children }) => {
  return <JiraContext.Provider value={jira}>{children}</JiraContext.Provider>;
};

export const useJira = () => {
  const jira = useContext(JiraContext);
  if (!jira) {
    throw new Error('Cannot use useJira outside of its provider');
  }
  return jira;
};
```

### Custom Hooks for State Logic

Encapsulation of stateful logic in custom hooks:

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
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
};
```

## Responsive and Accessibility Considerations

### Jira Integration Constraints

- Components must work within Jira's iframe environment
- Responsive design must adapt to varying sidebar widths
- Navigation must respect Jira's routing patterns

### Accessibility Implementation

- Proper ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Focus management for modal dialogs

## Performance Optimizations

### Component Memoization

Strategic use of React optimization techniques for large data sets:

```tsx
const MemoizedReportComponent = React.memo(({ data }) => {
  return <div>{/* Expensive rendering logic */}</div>;
});
```

### Lazy Loading

Dynamic imports for large report components to improve initial load time.

## Key UI Patterns

1. **Provider Pattern**: Dependency injection through React Context
2. **Compound Components**: Complex components like Accordion with multiple parts
3. **Custom Hooks**: Reusable stateful logic extraction
4. **CSS-in-JS + Utilities**: Hybrid styling approach
5. **Legacy Bridge**: Seamless integration between React and CanJS
6. **Design System First**: Preference for @atlaskit components over custom implementations
