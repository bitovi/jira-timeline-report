# Copilot Instructions for Jira Timeline Report

## Overview

This file enables AI coding assistants to generate features that align with the Jira Timeline Report project's architecture and coding style. All guidance is based on actual, observed patterns from the codebase — not invented practices.

This codebase implements a sophisticated timeline reporting application for Jira issues using a hybrid CanJS/React architecture. The system emphasizes statistical analysis, Monte Carlo simulations, and advanced data visualization for project management insights.

## File Category Reference

### react-components

**Purpose**: Modern React components with Tailwind CSS and functional design patterns
**Examples**: `src/react/components/Accordion/Accordion.tsx`, `src/react/components/ToggleButton/ToggleButton.tsx`
**Key Conventions**:

- Context-based compound components with provider pattern
- Functional CSS class composition using Tailwind utilities
- Hierarchical organization with index files for re-exports
- Props interfaces co-located with component definitions
- Conditional rendering with early returns

### react-hooks

**Purpose**: Custom React hooks emphasizing CanJS integration and type safety
**Examples**: `src/react/hooks/useCanObservable/useCanObservable.ts`, `src/react/hooks/useLocalStorage/useLocalStorage.ts`
**Key Conventions**:

- CanJS observable bridge pattern for reactive state management
- Configuration objects with serialization/deserialization options
- Tuple returns with `as const` for proper TypeScript inference
- Generic type constraints with sensible defaults
- Defensive programming with try-catch blocks and console warnings

### canjs-components

**Purpose**: CanJS StacheElement components for data visualization and reactive UI
**Examples**: `src/canjs/controls/status-filter.js`, `src/canjs/ui/autocomplete/autocomplete.js`
**Key Conventions**:

- StacheElement class-based components with static view and props
- Custom HTMLElement base classes for low-level control
- Global singleton pattern for shared utilities (tooltips, overlays)
- Mixed React-CanJS integration using createRoot and createElement
- Data binding with colon-separated syntax (`data:from`, `selected:bind`)

### utilities

**Purpose**: Mathematical and date calculation functions for timeline analysis
**Examples**: `src/utils/date/business-days.js`, `src/utils/math/linear-mapping.js`
**Key Conventions**:

- Date normalization patterns to avoid timezone issues
- Business day calculation logic with weekend handling
- Mathematical function factories returning configured operations
- Statistical distribution integration using jStat library
- Pure function design with no side effects and defensive programming

### services-request-helpers

**Purpose**: API abstraction and authentication management for Atlassian services
**Examples**: `src/request-helpers/hosted-request-helper.js`, `src/jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time.js`
**Key Conventions**:

- Factory function pattern for request helpers
- Authentication token management with automatic refresh
- URL construction strategy for relative/absolute URLs
- Atlassian Connect integration with dual-mode operation
- Promise wrapper pattern with consistent try-catch error handling

### algorithms

**Purpose**: Hierarchical data processing and statistical calculations
**Examples**: `src/jira/rollup/rollup.ts`, `src/jira/rollup/percent-complete/percent-complete.ts`
**Key Conventions**:

- Rollup algorithm pattern with configurable processing hooks
- Type guard functions for union type discrimination
- Hierarchy processing with parent-child relationship management
- Generic data processing pipelines with type safety
- Configuration-driven processing strategies

### configuration-shared

**Purpose**: Feature management, type definitions, and cross-cutting concerns
**Examples**: `src/configuration/features.ts`, `src/shared/feature-flag.js`
**Key Conventions**:

- Declarative feature configuration with dynamic toggling
- Centralized report type definitions
- Runtime feature flag system with debugging utilities
- Functional configuration transformation through array processing
- Closure-based state management with localStorage persistence

## Feature Scaffold Guide

### Planning a New Feature

1. **Determine File Categories**: Based on feature requirements:

   - **UI Components**: React components for user interface, CanJS components for data visualization
   - **Business Logic**: Utilities for calculations, algorithms for data processing
   - **State Management**: React hooks for local state, CanJS observables for reactive data
   - **External Integration**: Request helpers for API communication, services for data transformation

2. **File Placement Strategy**:

   - React components: `src/react/components/{FeatureName}/`
   - React hooks: `src/react/hooks/{hookName}/`
   - CanJS components: `src/canjs/{domain}/{feature-name}/`
   - Utilities: `src/utils/{domain}/{function-name}.js`
   - Algorithms: `src/jira/{domain}/{algorithm-name}/`
   - Configuration: `src/configuration/{feature-config}.ts`

3. **Naming Conventions**:

   - React components: PascalCase with descriptive names (`TimelineChart`, `IssueFilter`)
   - Hooks: camelCase with `use` prefix (`useTimelineData`, `useIssueFiltering`)
   - CanJS components: kebab-case custom elements (`timeline-chart`, `issue-filter`)
   - Utilities: camelCase descriptive functions (`calculateBusinessDays`, `formatDateRange`)
   - Files: Match primary export name with appropriate extension

4. **Example Feature: Issue Timeline Filter**

   ```
   src/react/components/IssueTimelineFilter/
   ├── IssueTimelineFilter.tsx
   ├── index.ts
   └── IssueTimelineFilter.module.css

   src/react/hooks/useIssueFilter/
   ├── useIssueFilter.ts
   └── index.ts

   src/utils/date/
   └── filter-by-date-range.js

   src/jira/filtering/
   └── issue-date-filter.ts
   ```

## Integration Rules

### Architectural Constraints

- **Data Processing**: All hierarchical calculations must use the rollup algorithm pattern from `src/jira/rollup/rollup.ts`
- **Observable Integration**: React-CanJS bridges must go through `useCanObservable` hook pattern
- **Date Calculations**: Business day logic must use functions from `src/utils/date/business-days.js`
- **API Communication**: External requests must use factory functions from `src/request-helpers/`
- **Statistical Analysis**: Monte Carlo simulations must integrate with jStat library patterns
- **Feature Flags**: New features must use `defineFeatureFlag` from `src/shared/feature-flag.js`
- **Component Integration**: React components embedded in CanJS must use `createRoot` and `createElement` patterns

### Required Patterns

- **Type Safety**: All new TypeScript code must include comprehensive type definitions
- **Error Handling**: Service layer functions must use try-catch with promise rejection patterns
- **State Management**: Reactive state must use CanJS observables with React hook bridges
- **Styling**: UI components must use Tailwind CSS with functional class composition
- **Testing**: Each domain requires corresponding test files following existing patterns

## Example Prompt Usage

**User Request**: "Create a Monte Carlo simulation widget for estimating project completion dates"

**Expected AI Response**: Generate these files following project conventions:

```
src/react/components/MonteCarloWidget/
├── MonteCarloWidget.tsx          // React component with Tailwind styling
├── SimulationChart.tsx           // Chart visualization component
├── index.ts                      // Re-exports
└── MonteCarloWidget.module.css   // Component-specific styles

src/react/hooks/useMonteCarloSimulation/
├── useMonteCarloSimulation.ts    // Hook for simulation logic
└── index.ts                      // Re-export

src/utils/math/
└── monte-carlo-completion.js     // Pure statistical functions

src/jira/simulation/
├── completion-estimation.ts      // Business logic integration
└── completion-estimation.test.ts // Unit tests

src/configuration/
└── simulation-features.ts        // Feature flag configuration
```

**Implementation Details**:

- `MonteCarloWidget.tsx`: Compound component pattern with context provider
- `useMonteCarloSimulation.ts`: Custom hook with jStat integration and error handling
- `monte-carlo-completion.js`: Pure functions using existing confidence calculation patterns
- `completion-estimation.ts`: Rollup algorithm integration for hierarchical data processing
- All files follow TypeScript strict mode with comprehensive type definitions

**Integration Requirements**:

- Widget integrates with existing CanJS observable data through `useCanObservable`
- Uses date utilities from `src/utils/date/` for business day calculations
- Follows feature flag pattern for progressive rollout
- Implements responsive design using Tailwind utility classes
- Includes proper error boundaries and loading states

This approach ensures new features maintain architectural consistency while leveraging the project's sophisticated mathematical and statistical capabilities.
