# Data Processing Pipeline Domain

## Overview

The Data Processing Pipeline Domain implements a sophisticated multi-stage data transformation architecture that converts raw Jira data into derived insights for timeline reporting. The pipeline follows a strict layered approach with clear separation of concerns at each transformation stage.

## Architecture Pattern

The pipeline follows this transformation flow:

```
Raw Jira Data → Normalized → Derived → Rolled Up → Rolled Back → UI Presentation
```

Each stage has a specific responsibility:

- **Raw**: Direct Jira API responses
- **Normalized**: Standardized field extraction with configurable defaults
- **Derived**: Computed values (timing, status analysis)
- **Rollup**: Hierarchical aggregation (parent-child relationships)
- **Rollback**: Historical state reconstruction

## Key Components

### 1. Normalization Layer (`./src/jira/normalized/`)

**Purpose**: Standardize raw Jira data with configurable field extraction

**Core Pattern**: Configuration-driven field extraction with defaults

```typescript
export function normalizeIssue(issue: JiraIssue, options: Partial<NormalizeIssueConfig> = {}): NormalizedIssue {
  const optionsWithDefaults = {
    getIssueKey: defaults.getIssueKeyDefault,
    getParentKey: defaults.getParentKeyDefault,
    getConfidence: defaults.getConfidenceDefault,
    getDueDate: defaults.getDueDateDefault,
    getHierarchyLevel: defaults.getHierarchyLevelDefault,
    // ... more field extractors
  };
}
```

**Key Files**:

- `normalize.ts` - Main normalization logic
- `defaults.ts` - Default field extraction functions

### 2. Derived Data Layer (`./src/jira/derived/`)

**Purpose**: Calculate complex business values from normalized data

**Core Pattern**: Composition of domain-specific derivations

```typescript
export function deriveIssue(
  issue: NormalizedIssue,
  options: Partial<WorkStatusConfig & WorkTimingConfig> & {
    uncertaintyWeight?: number;
  } = {},
): DerivedIssue {
  const derivedTiming = deriveWorkTiming(issue, options);
  const derivedStatus = getWorkStatus(issue, options);

  return {
    derivedTiming,
    derivedStatus,
    ...issue,
  };
}
```

**Key Files**:

- `derive.ts` - Main derivation orchestrator
- `work-timing/work-timing.ts` - Timing calculations
- `work-status/work-status.ts` - Status analysis

### 3. Rollup Aggregation Layer (`./src/jira/rollup/`)

**Purpose**: Hierarchical data aggregation from children to parents

**Core Pattern**: Generic rollup system with customizable aggregation functions

```typescript
export type RollupGroupedHierarchyOptions<T, TMetadata extends Record<string, any>, TRollupValues> = Partial<{
  createMetadataForHierarchyLevel: (hierarchyLevel: number, issues: IssueOrRelease<T>[]) => TMetadata;
  createRollupDataFromParentAndChild: (
    parent: IssueOrRelease<T>,
    childrenRollupValues: TRollupValues[],
    hierarchyLevel: number,
    metadata: TMetadata,
  ) => TRollupValues;
  finalizeMetadataForHierarchyLevel: (metadata: TMetadata, rollupData: TRollupValues[]) => void;
  getChildren: (reportingHierarchyIssueOrRelease: IssueOrRelease<T & WithReportingHierarchy>) => IssueOrRelease<T>[];
}>;
```

**Key Files**:

- `rollup.ts` - Generic rollup framework
- `dates/dates.ts` - Date aggregations
- `percent-complete/percent-complete.ts` - Progress calculations
- `child-statuses/child-statuses.ts` - Status propagation

### 4. Historical Rollback (`./src/jira/raw/rollback/`)

**Purpose**: Reconstruct historical states from change logs

**Key Files**:

- `rollback.ts` - Main rollback logic

## Configuration System

The pipeline uses a flexible configuration system where each stage accepts options that control transformation behavior:

```typescript
export type NormalizeIssueConfig = DefaultsToConfig<typeof defaults>;
export type WorkStatusConfig = {
  uncertaintyWeight?: number;
};
export type WorkTimingConfig = {
  // timing-specific options
};
```

## Data Types

### Core Issue Types

```typescript
// Raw Jira data
export type JiraIssue = {
  // Direct API response structure
};

// After normalization
export type NormalizedIssue = {
  // Standardized fields
};

// After derivation
export type DerivedIssue = NormalizedIssue & {
  derivedTiming: DerivedWorkTiming;
  derivedStatus: DerivedWorkStatus;
};
```

### Hierarchy Support

The system supports both issues and releases in unified processing:

```typescript
export type IssueOrRelease<CustomFields = unknown> = (DerivedIssue | DerivedRelease) & CustomFields;

export function isDerivedRelease<T>(issueOrRelease: IssueOrRelease<T>): issueOrRelease is DerivedRelease & T {
  return issueOrRelease.type === 'Release';
}
```

## Integration Points

### Input Sources

- Raw Jira API responses via `jira-oidc-helpers`
- Configuration from team configuration system
- User-defined field mappings

### Output Consumers

- React components for visualization
- Timeline rendering components
- Report generation systems

## Processing Patterns

1. **Functional Transformation**: Each stage is a pure function transformation
2. **Configuration Injection**: Options pattern for customizable behavior
3. **Type Safety**: Strong TypeScript typing through pipeline stages
4. **Immutable Data**: No mutation of input data structures
5. **Error Handling**: Graceful fallbacks through default configurations

## Performance Considerations

- Pipeline processes large datasets (1000+ issues)
- Lazy evaluation where possible
- Memoization of expensive calculations
- Efficient hierarchical traversal algorithms

This domain represents the core data intelligence of the application, transforming raw project management data into actionable timeline insights.
