# React Components Style Guide

## Unique Patterns

### Compound Component Architecture

Components use compound patterns with Context for complex state sharing:

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

### Barrel Export Pattern

All components use index.ts files for clean imports:

```typescript
// index.ts
export { default as Accordion } from './Accordion';
export { default as AccordionTitle } from './AccordionTitle';
export { default as AccordionContent } from './AccordionContent';
```

### TypeScript Interface Conventions

Components use specific interface naming patterns:

```tsx
interface JiraProviderProps {
  jira: Jira;
  children: ReactNode;
}

export const JiraProvider: FC<JiraProviderProps> = ({ jira, children }) => {
  return <JiraContext.Provider value={jira}>{children}</JiraContext.Provider>;
};
```

### Error Boundary Patterns

Custom error handling for context misuse:

```tsx
export const useJira = () => {
  const jira = useContext(JiraContext);
  if (!jira) {
    throw new Error('Cannot use useJira outside of its provider');
  }
  return jira;
};
```

### Atlassian Design System Integration

Preference for @atlaskit components with consistent theming:

```tsx
import Button from '@atlaskit/button';
import { Checkbox } from '@atlaskit/checkbox';
import { TextField } from '@atlaskit/textfield';
```
