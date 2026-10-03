# Configuration & Shared Modules Style Guide

## Overview

Configuration and shared modules in this codebase provide centralized feature management, type definitions, and cross-cutting concerns. They emphasize functional programming, type safety, and runtime feature toggles.

## Unique Conventions

### 1. Feature Flag Configuration Pattern

Declarative feature configuration with dynamic toggling:

```typescript
type Feature = {
  name: string;
  subtitle: string;
  featureFlag: string;
  onByDefault: boolean;
};

export const nonReportsFeatures: Feature[] = [
  {
    name: 'Secondary Report',
    subtitle: '',
    featureFlag: 'secondaryReport',
    onByDefault: false,
  },
] as const;

export const featureMap: Record<string, Feature> = features.reduce(
  (acc, feature) => {
    acc[feature.featureFlag] = feature;
    return acc;
  },
  {} as Record<string, Feature>,
);
```

**Pattern**: Const assertions for immutable configuration, functional array transformations, record type mappings.

### 2. Report Configuration Registry

Centralized report type definitions:

```typescript
export type Report = {
  key: string;
  name: string;
  featureSubtitle: string;
  featureFlag: string;
  onByDefault: boolean;
};

export const reports: Report[] = [
  {
    key: 'start-due',
    name: 'Gantt Chart',
    featureSubtitle: '',
    featureFlag: 'ganttChart',
    onByDefault: true,
  },
];
```

**Pattern**: Type-first design with immediate implementation, descriptive property names, default state management.

### 3. Runtime Feature Flag System

Dynamic feature flag management with debugging utilities:

```javascript
export function defineFeatureFlag(key, description, convertValue, defaultValue = 'ON') {
  convertValue = convertValue || toBoolean;
  flags[key] = readFeatureFlag();

  Object.defineProperty(flags, key + ' read details', {
    get: function () {
      console.log(`== ${key} ==\nCurrent Value: ${readFeatureFlag()}\n--------\n${description}`);
    },
  });

  Object.defineProperty(flags, key + ' toggle value', {
    get() {
      if (readFeatureFlag()) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, defaultValue);
      }
      window.location.reload();
    },
  });

  function readFeatureFlag() {
    const value = localStorage.getItem(key);
    return convertValue(value);
  }
  return readFeatureFlag;
}
```

**Pattern**: Closure-based state management, property descriptor debugging utilities, localStorage persistence.

### 4. Functional Configuration Transformation

Configuration processing through functional composition:

```typescript
export const features = reports
  .filter((report) => !report.onByDefault)
  .map((report) => {
    return {
      name: report.name,
      subtitle: report.featureSubtitle,
      featureFlag: report.featureFlag,
      onByDefault: report.onByDefault,
    };
  })
  .concat(nonReportsFeatures);
```

**Pattern**: Functional array processing chains, immutable transformations, configuration merging.

## File Structure Conventions

- **Configuration Files**: Single-purpose configuration modules
- **Type Definitions**: Co-located with implementation
- **Feature Flags**: Runtime toggleable with debugging support
- **Shared Utilities**: Cross-cutting concerns in dedicated modules

## Integration Patterns

- **Feature Management**: Dynamic feature toggles with persistence
- **Type Safety**: Comprehensive TypeScript configuration types
- **Debugging**: Built-in debugging utilities for development
- **Centralization**: Single source of truth for feature and report configuration

This configuration architecture enables flexible feature management and provides strong typing for application configuration while supporting runtime debugging and feature toggling.
