# Algorithms Style Guide

## Overview

Algorithm implementations in this codebase focus on hierarchical data processing, statistical calculations, and timeline analysis. They emphasize functional programming patterns, type safety, and configurable processing strategies for complex Jira data relationships.

## Unique Conventions

### 1. Rollup Algorithm Pattern

Core hierarchical processing algorithm with configurable strategies:

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

**Pattern**: Generic types with configurable processing hooks, optional configuration objects, functional composition through type parameters.

### 2. Type Guard Functions

Sophisticated type discrimination for union types:

```typescript
export function isDerivedRelease<T>(issueOrRelease: IssueOrRelease<T>): issueOrRelease is DerivedRelease & T {
  return issueOrRelease.type === 'Release';
}

export function isDerivedIssue<T>(issueOrRelease: IssueOrRelease<T>): issueOrRelease is DerivedIssue & T {
  return issueOrRelease.type !== 'Release';
}
```

**Pattern**: Generic type guards with intersection types, runtime type discrimination, type predicate return types.

### 3. Hierarchy Processing Functions

Complex data relationship management:

```typescript
export function getParentKeys(issueOrRelease: IssueOrRelease) {
  const parents: string[] = [];
  if (isDerivedIssue(issueOrRelease)) {
    if (issueOrRelease.parentKey) {
      parents.push(issueOrRelease.parentKey);
    }
    if (issueOrRelease.releases) {
      parents.push(...issueOrRelease.releases.map((release) => release.key));
    }
  }
  return parents;
}
```

**Pattern**: Conditional property access based on type guards, array spread operations, key extraction patterns.

### 4. Percentage Completion Algorithm

Sophisticated completion calculation with metadata accumulation:

```typescript
export type PercentCompleteMeta = {
  /** how many children on average */
  childCounts: number[];
  totalDays: number;
  /** an array of the total of the number of days of work. Used to calculate the average */
  totalDaysOfWorkForAverage: number[];
  /** which items need their average set after the average is calculated */
  needsAverageSet: PercentCompleteRollup[];
  /** this will be set later */
  averageTotalDays: number;
  averageChildCount: number;
};

export type PercentCompleteRollup = {
  userSpecifiedValues: boolean;
  totalWorkingDays: number;
  completedWorkingDays: number;
  source: RollupSourceValues;
  readonly remainingWorkingDays: number;
};
```

**Pattern**: Detailed type definitions with documentation comments, readonly properties for computed values, accumulator metadata patterns.

### 5. Date Range Processing

Complex date calculation strategies with multiple algorithms:

```typescript
const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly,
};

export function addRollupDates<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
): IssueOrRelease<T & WithDateRollup>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rollupMethods = rollupTimingLevelsAndCalculations.map((rollupData) => rollupData.calculation).reverse();
  const rolledUpDates = rollupDates(groupedIssues, rollupMethods);
  // ...
}
```

**Pattern**: Strategy pattern with object-based method collection, configurable algorithm selection, reverse order processing.

### 6. Data Merging Utilities

Functional data extraction and merging:

```typescript
export const getStartData = (d: Partial<StartData> | null) => {
  if (!d) return {};

  const { start, startFrom } = d;

  return {
    ...(start && { start }),
    ...(startFrom && { startFrom }),
  };
};

export const getDueData = (d: Partial<DueData> | null) => {
  if (!d) return {};

  const { due, dueTo } = d;

  return {
    ...(due && { due }),
    ...(dueTo && { dueTo }),
  };
};

export const getStartAndDueData = (d: RollupDateData | null) => {
  return {
    ...getStartData(d),
    ...getDueData(d),
  };
};
```

**Pattern**: Conditional property spreading, null checking, functional composition of data extractors.

### 7. Statistical Helper Functions

Mathematical utilities for aggregation:

```typescript
function sum(arr: number[]) {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}

function average(arr: number[]) {
  return arr.length > 0 ? sum(arr) / arr.length : 0;
}
```

**Pattern**: Single-purpose mathematical functions, defensive programming for empty arrays, functional composition.

### 8. Generic Data Processing Pipeline

Type-safe data transformation pipelines:

```typescript
export function addPercentComplete<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
): IssueOrRelease<T & WithPercentComplete>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rolledUpDates = rollupPercentComplete(groupedIssues);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, 'completionRollup');
  return zipped.flat();
}
```

**Pattern**: Generic input/output types with intersection types, functional pipeline processing, array flattening operations.

### 9. Configuration-Driven Processing

Algorithm behavior controlled by configuration objects:

```typescript
const methods = {
  childrenFirstThenParent,
  widestRange,
};

export type PercentCompleteCalculations = keyof typeof methods;

// Usage pattern:
const rollupMethods = rollupTimingLevelsAndCalculations.map((rollupData) => rollupData.calculation).reverse();
```

**Pattern**: Object-based method registry, keyof type extraction, configuration-driven method selection.

### 10. Union Type Processing

Complex union type handling with type-safe operations:

```typescript
export type IssueOrRelease<CustomFields = unknown> = (DerivedIssue | DerivedRelease) & CustomFields;

export type WithReportingHierarchy = {
  reportingHierarchy: ReportingHierarchy;
};
```

**Pattern**: Generic union types with custom field extensions, intersection types for additional properties, compositional type design.

## File Structure Conventions

- **Algorithm Organization**: Grouped by functionality (rollup, dates, percent-complete)
- **Type Definitions**: Co-located with algorithm implementations
- **Strategy Pattern**: Method objects for configurable algorithm behavior
- **Generic Design**: Extensive use of generics for type safety and reusability

## Integration Patterns

- **Hierarchical Processing**: Parent-child relationship algorithms with configurable strategies
- **Statistical Analysis**: Mathematical operations integrated with business logic
- **Type Safety**: Comprehensive TypeScript types with runtime type guards
- **Functional Composition**: Pipeline processing with immutable data transformations

These algorithms provide the core computational foundation for timeline analysis, percentage completion calculations, and hierarchical data processing, emphasizing both mathematical accuracy and type safety.
