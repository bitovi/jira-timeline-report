import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it } from 'vitest';

import EmptyView from './EmptyView';

describe('EmptyView', () => {
  it('renders without crashing (smoke test)', () => {
    render(<EmptyView />);

    expect(screen.getByText(/You don't have any saved reports/i)).toBeInTheDocument();
    expect(screen.getByText(/When you save your first report/i)).toBeInTheDocument();
  });
});
