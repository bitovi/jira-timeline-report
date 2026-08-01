# Linked Issue Date Rollup Module

This module provides recursive date rollup functionality for linked issues, similar to the existing `jira/rollup/dates` module but designed specifically for the linked issue system used in the GroupingReport.

## Key Features

- **Recursive Processing**: Works bottom-up through the linked issue hierarchy
- **Widest Range Strategy**: Always takes the earliest start date and latest due date from parent and all descendants
- **Sprint Date Support**: Falls back to sprint dates when regular start/due dates aren't available
- **Caching**: Uses WeakMap caching to avoid recalculation of the same issues
- **Type Safe**: Full TypeScript support with proper type definitions

## Differences from `jira/rollup/dates`

1. **Recursive Approach**: Uses a bottom-up recursive algorithm instead of hierarchical level processing
2. **Always Widest Range**: Unlike the configurable rollup strategies in the original module, this always uses the widest date range strategy
3. **Sprint Integration**: Automatically considers sprint dates as a fallback when regular dates aren't available
4. **LinkedIssue Focused**: Designed specifically for the LinkedIssue type with its parent/child relationships

## Usage

### Basic Usage

```typescript
import { getDateRollupForLinkedIssue, addDateRollupsToLinkedIssues } from './dates';

// Get rollup for a single issue
const rollup = getDateRollupForLinkedIssue(linkedIssue);
console.log(rollup.start, rollup.due); // Earliest start and latest due from entire subtree

// Add rollups to an array of issues
const issuesWithRollups = addDateRollupsToLinkedIssues(linkedIssues);
issuesWithRollups.forEach((issue) => {
  console.log(`${issue.key}: ${issue.rollupDates.start} to ${issue.rollupDates.due}`);
});
```

### Cache Management

```typescript
import { clearDateRollupCache } from './dates';

// Clear cache when processing new data sets
clearDateRollupCache();
```

## Algorithm

The rollup algorithm works as follows:

1. **Recursive Calculation**: For each issue, first calculate rollups for all children
2. **Date Extraction**: Extract dates from the issue's derivedTiming (includes start/due dates and sprint data)
3. **Sprint Fallback**: If no regular dates found, use sprint dates via `getStartDateAndDueDataFromSprints`
4. **Widest Range**: Merge parent and all children dates, taking earliest start and latest due
5. **Caching**: Cache results to avoid recalculation

## Date Priority

1. **Regular Dates**: `start` and `due` from derivedTiming
2. **Sprint Dates**: From `sprintStartData` and `endSprintData` in derivedTiming
3. **Direct Sprint Data**: Via `getStartDateAndDueDataFromSprints` function

## Types

- `RollupDateData`: Contains partial start/due date information
- `WithDateRollup`: Adds `rollupDates` property to linked issues
- Functions return issues enhanced with the rollup data

## Testing

The module includes comprehensive tests covering:

- Empty date scenarios
- Parent-only dates
- Child-only dates
- Mixed parent and child dates
- Deeply nested hierarchies
- Caching behavior

Run tests with:

```bash
npm test src/react/reports/GroupingReport/jira/linked-issue/rollup/dates/dates.test.ts
```
