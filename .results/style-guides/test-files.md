# Test Files Style Guide

## Unique Patterns

### Co-location Pattern

Tests are placed alongside source files with .test.{ts,tsx} naming:

```
src/
  components/
    EditableTitle/
      EditableTitle.tsx
      EditableTitle.test.tsx
      index.ts
```

### React Testing Library Integration

Component tests use RTL with userEvent:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

### Vitest Configuration

Tests use Vitest with global test functions:

```typescript
import { describe, it, expect, vi } from 'vitest';
```
