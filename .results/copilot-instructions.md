# Copilot Instructions for Jira Timeline Report

## Overview

This file enables AI coding assistants to generate features aligned with the project's architecture and style. It is based only on actual, observed patterns from the codebase — not invented practices.

This is a sophisticated **Jira Timeline Report Generator** built with a hybrid React + CanJS architecture, featuring OAuth integration with Jira Cloud, interactive timeline visualizations, and algorithmic project scheduling capabilities.

## File Category Reference

### react-components

**Purpose**: Modern React functional components using TypeScript and Atlassian Design System  
**Examples**: `./src/react/components/Accordion/Accordion.tsx`, `./src/react/ReportControls/ReportControls.tsx`  
**Key Conventions**:

- Compound component architecture with Context for complex state sharing
- Barrel export pattern through index.ts files
- TypeScript interfaces with `Props` suffix
- Mandatory error handling for context misuse
- Preference for @atlaskit components over custom implementations

### react-hooks

**Purpose**: Custom hooks for state management and CanJS integration  
**Examples**: `./src/react/hooks/useCanObservable/useCanObservable.ts`, `./src/react/hooks/useLocalStorage/useLocalStorage.ts`  
**Key Conventions**:

- Observable bridge pattern for CanJS integration using `useCanObservable`
- Tuple return pattern `[state, setter] as const` for state hooks
- Route data integration through CanJS observables
- Generic type constraints for type safety
- Re-export pattern through index files

### react-services

**Purpose**: React Query services and Context providers for dependency injection  
**Examples**: `./src/react/services/jira/JiraProvider.tsx`, `./src/react/services/reports/useAllReports.ts`  
**Key Conventions**:

- Query key factory pattern for React Query
- Suspense query pattern for all data fetching
- Explicit type definitions like `UseAllReports = () => Reports`
- Context provider pattern for dependency injection
- Service hook typing with descriptive type aliases

### canjs-components

**Purpose**: Legacy CanJS components for complex timeline visualizations  
**Examples**: `./src/timeline-report.js`, `./src/canjs/controls/issue-tooltip.js`  
**Key Conventions**:

- StacheElement custom elements with `static view` and `static props`
- Direct observable integration with CanJS state management
- Custom element registration pattern
- Legacy patterns being phased out in favor of React

### jira-api-helpers

**Purpose**: Comprehensive Jira API integration with OAuth authentication  
**Examples**: `./src/jira-oidc-helpers/index.ts`, `./src/jira-oidc-helpers/auth.ts`  
**Key Conventions**:

- Single comprehensive export object pattern
- All API functions are async with proper error handling
- Type-safe configuration interfaces
- Environment-specific request helper abstraction
- OAuth token management with automatic refresh

### utility-functions

**Purpose**: Pure utility functions organized by domain  
**Examples**: `./src/utils/date/business-days.js`, `./src/utils/math/index.ts`  
**Key Conventions**:

- Mixed JavaScript/TypeScript based on legacy vs new code
- Domain-specific organization (date, math, array, etc.)
- Pure functions without side effects
- Consistent export patterns

### test-files

**Purpose**: Comprehensive testing with Vitest and React Testing Library  
**Examples**: `./src/react/SaveReports/SaveReportsWrapper.test.tsx`  
**Key Conventions**:

- Co-location pattern with `.test.{ts,tsx}` naming
- React Testing Library with userEvent for component tests
- Vitest configuration with global test functions
- Comprehensive mocking for external dependencies

## Feature Scaffold Guide

### Creating a New React Component

When implementing a new UI component:

1. **Create component folder structure**:

   ```
   src/react/components/NewComponent/
     NewComponent.tsx
     NewComponent.test.tsx
     index.ts
   ```

2. **Implement component with patterns**:

   - Use functional component with TypeScript
   - Implement compound pattern if complex state sharing needed
   - Prefer @atlaskit components for UI elements
   - Add proper TypeScript interfaces with `Props` suffix
   - Include error boundaries for context usage

3. **Add barrel export**:

   ```typescript
   // index.ts
   export { default } from './NewComponent';
   ```

4. **Add comprehensive tests**:
   - Use React Testing Library with userEvent
   - Test accessibility and keyboard navigation
   - Mock external dependencies properly

### Creating a New Hook

When implementing custom hooks:

1. **Create hook structure**:

   ```
   src/react/hooks/useNewHook/
     useNewHook.ts
     index.ts
   ```

2. **Follow hook patterns**:
   - Return tuples for state/setter: `[value, setValue] as const`
   - Use `useCanObservable` for CanJS integration
   - Include proper TypeScript generics
   - Handle cleanup in useEffect

### Creating a New API Integration

When adding Jira API functionality:

1. **Add to jira-oidc-helpers**:

   - Create specific function in appropriate module
   - Use async/await with proper error handling
   - Follow OAuth authentication patterns
   - Add TypeScript interfaces for responses

2. **Create React Query service**:
   - Add query key to key factory
   - Use suspense query pattern
   - Implement proper caching strategy

### Creating Data Processing Logic

When adding data transformation:

1. **Follow data pipeline stages**:

   - Raw data (direct from Jira API)
   - Normalized data (standardized structures)
   - Derived data (computed values)
   - Rolled-up data (aggregated for reporting)

2. **Place in appropriate folder**:
   - Raw: `src/jira/raw/`
   - Normalized: `src/jira/normalized/`
   - Derived: `src/jira/derived/`
   - Utilities: `src/utils/`

## Integration Rules

### State Management Constraints

- **All server state must use React Query** with proper cache keys from key factories
- **All CanJS observable integration must use useCanObservable hook** - never access observables directly in React
- **Context providers must be wrapped at appropriate component tree levels** - use JiraProvider, StorageProvider patterns
- **URL state synchronization must go through CanJS route data** - never update URL directly in React components

### API Integration Rules

- **All Jira API calls must go through jira-oidc-helpers interface** - never call Jira APIs directly
- **All requests must use OAuth tokens managed by auth module** - automatic token refresh required
- **Environment-specific request helpers required** - use hosted vs connect request helpers appropriately
- **All API functions must be async with comprehensive error handling**

### UI Component Rules

- **Components must prefer @atlaskit/\* over custom implementations** unless specific timeline visualization needs
- **All components must work within Jira's iframe constraints** for Connect app deployment
- **Use TailwindCSS utility classes combined with CSS modules** for styling
- **Implement proper accessibility with ARIA labels and keyboard navigation**

### Testing Requirements

- **Tests must be co-located with source files** using `.test.{ts,tsx}` naming convention
- **External dependencies must be mocked appropriately** - especially Jira API calls
- **Component tests must use React Testing Library with userEvent** for realistic interaction testing
- **E2E tests must use Playwright** for full application workflow testing

## Example Prompt Usage

**User Request**: "Create a searchable dropdown that lets users filter by issue status"

**Expected AI Response**: Create these files following project conventions:

1. **Component**: `src/react/components/StatusFilterDropdown/StatusFilterDropdown.tsx`

   - Use @atlaskit/select for dropdown base
   - Implement useSelectableStatuses hook for data
   - Include proper TypeScript interfaces
   - Add accessibility attributes

2. **Hook**: `src/react/hooks/useStatusFilter/useStatusFilter.ts`

   - Integrate with route data observables for URL sync
   - Use useCanObservable for CanJS bridge
   - Return tuple pattern for state management

3. **Service**: `src/react/services/issues/useStatusOptions.ts`

   - Use React Query with proper cache key
   - Integrate with Jira API through jira-oidc-helpers
   - Handle loading and error states

4. **Test**: `src/react/components/StatusFilterDropdown/StatusFilterDropdown.test.tsx`
   - Test dropdown interaction with userEvent
   - Mock Jira API responses
   - Verify URL parameter updates

This approach ensures the new feature integrates seamlessly with existing architecture patterns, maintains type safety, follows established conventions, and works correctly in both hosted and Atlassian Connect environments.
