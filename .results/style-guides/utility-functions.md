# Utility Functions Style Guide

## Unique Patterns

### Mixed JavaScript/TypeScript

Utility functions use both .js and .ts extensions:

```javascript
// business-days.js
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
```

### Domain-Specific Organization

Utilities organized by domain (date, math, array, etc.):

```
utils/
  date/
    business-days.js
    date-helpers.js
  math/
    index.ts
  array/
    index.ts
```

### Pure Function Pattern

All utilities are pure functions without side effects:

```typescript
export const calculatePercentage = (value: number, total: number): number => {
  return total === 0 ? 0 : (value / total) * 100;
};
```
