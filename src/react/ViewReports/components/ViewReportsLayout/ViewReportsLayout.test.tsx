import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import ViewReportsLayout from './ViewReportsLayout';

describe('<ViewReportsLayout />', () => {
  const mockOnBackButtonClicked = vi.fn();

  it('renders without crashing with minimal props', () => {
    render(<ViewReportsLayout onBackButtonClicked={mockOnBackButtonClicked} />);

    expect(screen.getByRole('button', { name: 'Back to report' })).toBeInTheDocument();
    expect(screen.getByText('Saved Reports')).toBeInTheDocument();
  });

  it('names the report Back returns to, and renders children', () => {
    render(
      <ViewReportsLayout onBackButtonClicked={mockOnBackButtonClicked} reportName="Q3 Roadmap">
        <div>Child Content</div>
      </ViewReportsLayout>,
    );

    expect(screen.getByRole('button', { name: 'Back to Q3 Roadmap' })).toBeInTheDocument();

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders actions on the title row', () => {
    render(<ViewReportsLayout onBackButtonClicked={mockOnBackButtonClicked} actions={<button>Create</button>} />);

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
