# Utilities Style Guide

## Overview

Utility functions in this codebase are highly specialized for date calculations, mathematical operations, and domain-specific transformations. They emphasize precision, performance, and mathematical accuracy for timeline and statistical calculations.

## Unique Conventions

### 1. Date Normalization Pattern

Date utilities consistently normalize dates to avoid timezone and precision issues:

```javascript
export function daysBetween(date1, date2) {
  // Normalize both dates to midnight
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  // Calculate the difference in milliseconds
  const diffInMs = d1 - d2;

  // Convert milliseconds to days and round to handle timezone shifts
  return Math.round(diffInMs / (1000 * 60 * 60 * 24));
}
```

**Pattern**: Copy dates before modification, explicit hour normalization, rounding to handle floating point precision.

### 2. Business Day Calculation Logic

Complex business logic with weekend handling and UTC-specific calculations:

```javascript
export function getBusinessDatesCount(startDate, endDate) {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

export function getUTCEndDateFromStartDateAndBusinessDays(startDate, businessDays) {
  const curDate = new Date(startDate.getTime());
  const startDay = curDate.getUTCDay();

  // move to Monday ...
  if (startDay === 0) {
    // sunday
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  } else if (startDay === 6) {
    // saturday
    curDate.setUTCDate(curDate.getUTCDate() + 2);
  }

  const weeksToMoveForward = Math.floor(businessDays / 5);
  const remainingDays = businessDays % 5;

  curDate.setUTCDate(curDate.getUTCDate() + weeksToMoveForward * 7 + remainingDays);

  // Weekend adjustment logic...
  return curDate;
}
```

**Pattern**: Loop-based counting with day-of-week checks, UTC-specific methods, explicit weekend normalization.

### 3. Mathematical Function Factories

Higher-order functions that create specialized mathematical operations:

```javascript
export function createLinearMapping(mappingPoints) {
  // Ensure the mapping points are sorted by input value
  mappingPoints.sort((a, b) => a[0] - b[0]);

  return function (value) {
    // Handle values outside the range
    if (value <= mappingPoints[0][0]) return mappingPoints[0][1];
    if (value >= mappingPoints[mappingPoints.length - 1][0]) return mappingPoints[mappingPoints.length - 1][1];

    // Find the two points the value falls between
    for (let i = 0; i < mappingPoints.length - 1; i++) {
      const [x1, y1] = mappingPoints[i];
      const [x2, y2] = mappingPoints[i + 1];

      if (value >= x1 && value <= x2) {
        // Perform linear interpolation
        const t = (value - x1) / (x2 - x1); // Proportion between the two points
        return y1 + t * (y2 - y1); // Interpolated value
      }
    }
  };
}

export function createInverseMapping(mappingPoints) {
  // Swap x and y in the mapping points to create the inverse mapping
  const invertedPoints = mappingPoints.map(([x, y]) => [y, x]);

  // Use the same createLinearMapping logic on the inverted points
  return createLinearMapping(invertedPoints);
}
```

**Pattern**: Factory functions that return configured mathematical operations, array destructuring for coordinate pairs, linear interpolation algorithms.

### 4. Statistical Distribution Integration

Integration with statistical libraries for confidence calculations:

```javascript
import { jStat } from 'jstat';

function toStandardDeviations({
  confidence,
  highConfidenceStds = 0,
  highConfidence = 100,
  lowConfidenceStds = 1.3,
  lowConfidence = 10,
}) {
  const slope = (-1 * (highConfidenceStds - lowConfidenceStds)) / (highConfidence - lowConfidence);
  const uncertainty = 100 - confidence;
  return uncertainty * slope;
}

export function estimateExtraPoints(estimate, confidence, uncertaintyWeight) {
  var std = toStandardDeviations({ confidence });
  if (uncertaintyWeight === 'average') {
    return estimate * jStat.lognormal.mean(0, std) - estimate;
  } else {
    return estimate * jStat.lognormal.inv(uncertaintyWeight / 100, 0, std) - estimate;
  }
}
```

**Pattern**: Configuration objects with defaults, mathematical formulas using external statistical libraries, lognormal distribution calculations.

### 5. Quarter and Month Calculation Logic

Complex calendar calculations with HTML generation:

```javascript
function monthDiff(dateFromString, dateToString) {
  const dateFrom = new Date(dateFromString);
  const dateTo = new Date(dateToString);
  return dateTo.getMonth() - dateFrom.getMonth() + 12 * (dateTo.getFullYear() - dateFrom.getFullYear());
}

export function getQuartersAndMonths(startDate, endDate) {
  // figure out which quarters startDate and endDate are within
  const quarterStartDate = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3);

  const lastQuarterEndDate = new Date(endDate.getFullYear(), Math.floor(endDate.getMonth() / 3) * 3 + 3);

  const monthDiffResult = monthDiff(quarterStartDate, lastQuarterEndDate);
  const quarters = monthDiffResult / 3;

  if (!Number.isInteger(quarters)) {
    console.warn('Not an even number of quarters', monthDiffResult, '/ 3');
  }

  // Calendar generation logic...
}
```

**Pattern**: Helper functions for complex calculations, quarter boundary calculations using floor division, validation warnings for edge cases.

### 6. Defensive Programming Pattern

Utilities include boundary checks and error handling:

```javascript
// Handle values outside the range
if (value <= mappingPoints[0][0]) return mappingPoints[0][1];
if (value >= mappingPoints[mappingPoints.length - 1][0]) return mappingPoints[mappingPoints.length - 1][1];

// Validation warnings
if (!Number.isInteger(quarters)) {
  console.warn('Not an even number of quarters', monthDiffResult, '/ 3');
}
```

**Pattern**: Explicit boundary condition handling, console warnings for unexpected data conditions.

### 7. Pure Function Design

All utilities are pure functions with no side effects:

```javascript
export function daysBetween(date1, date2) {
  // Creates new dates, doesn't mutate inputs
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  // ... pure calculation
  return Math.round(diffInMs / (1000 * 60 * 60 * 24));
}
```

**Pattern**: No mutation of input parameters, deterministic outputs, explicit return statements.

### 8. Domain-Specific Constants

Mathematical and business constants are embedded in utilities:

```javascript
const DAY_IN_MS = 1000 * 60 * 60 * 24;

// Business logic constants
if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // Skip weekends

// Quarter calculation
Math.floor(startDate.getMonth() / 3) * 3; // Quarter boundary
```

**Pattern**: Explicit time constants, business rule encoding, mathematical formula clarity.

## File Structure Conventions

- **Organization**: Grouped by domain (date, math, array operations)
- **Naming**: Descriptive function names indicating operation type
- **Exports**: Named exports for all utility functions
- **Dependencies**: Minimal external dependencies (only jStat for statistics)

## Integration Patterns

- **Date Operations**: Comprehensive timezone and business day handling
- **Mathematical Operations**: Linear interpolation and statistical calculations
- **Calendar Logic**: Quarter and month boundary calculations with HTML generation
- **Type Safety**: Implicit type safety through consistent parameter patterns

These utilities provide the mathematical and temporal foundation for the timeline reporting system, emphasizing accuracy and reliability for business date calculations and statistical analysis.
