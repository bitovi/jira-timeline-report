# Testing Domain Analysis

## Overview

The testing strategy combines unit testing with Vitest, component testing with React Testing Library, and end-to-end testing with Playwright for comprehensive coverage.

### Unit Testing with Vitest

Fast unit tests for business logic and utilities:

```typescript
// aggregate.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateBySum, aggregateByAverage } from './aggregate';

describe('aggregateBySum', () => {
  it('should sum numeric values correctly', () => {
    const data = [{ value: 10 }, { value: 20 }, { value: 30 }];

    expect(aggregateBySum(data, 'value')).toBe(60);
  });
});
```

### Component Testing

React components tested with React Testing Library:

```typescript
// EditableTitle.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditableTitle from './EditableTitle';

describe('EditableTitle', () => {
  it('should toggle between view and edit modes', async () => {
    const user = userEvent.setup();

    render(<EditableTitle title="Test Title" onSave={vi.fn()} />);

    const titleElement = screen.getByText('Test Title');
    await user.click(titleElement);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

### End-to-End Testing

Playwright for full application testing:

```typescript
// authenticated-user.spec.ts
import { test, expect } from '@playwright/test';

test('user can create and save a report', async ({ page }) => {
  await page.goto('/');

  // Navigate to report creation
  await page.click('[data-testid="create-report"]');

  // Fill in report details
  await page.fill('[data-testid="report-title"]', 'Test Report');
  await page.selectOption('[data-testid="report-type"]', 'timeline');

  // Save report
  await page.click('[data-testid="save-report"]');

  // Verify report was saved
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Key Testing Principles

1. **Test Organization**: Tests co-located with source files using `.test.{ts,tsx}` naming
2. **Mock Strategy**: External dependencies properly mocked for isolation
3. **Coverage**: Critical business logic has comprehensive test coverage
4. **Performance**: Fast unit tests with slower integration tests run separately
5. **Accessibility**: Tests include accessibility checks and keyboard navigation
