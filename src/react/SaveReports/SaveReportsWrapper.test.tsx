import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import SaveReportsWrapper from './SaveReportsWrapper';

const mockOnViewReportsButtonClicked = vi.fn();

const loggedInObservable = {
  on: vi.fn(),
  off: vi.fn(),
  getData: vi.fn(),
  value: true,
  set: vi.fn(),
  get: vi.fn(),
};

describe('<SaveReportsWrapper />', () => {
  it("doesn't render if not logged in", () => {
    render(
      <SaveReportsWrapper
        linkBuilder={(query) => query}
        shouldShowReportsObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: true,
          set: vi.fn(),
          get: vi.fn(),
        }}
        storage={{
          get: vi.fn().mockResolvedValue({ 'saved-reports': {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: '',
          set: vi.fn(),
          get: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByText('Saved reports')).not.toBeInTheDocument();
  });

  it('renders without crashing', async () => {
    render(
      <SaveReportsWrapper
        linkBuilder={(query) => query}
        shouldShowReportsObservable={loggedInObservable}
        storage={{
          get: vi.fn().mockResolvedValue({ 'saved-reports': {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: '',
          set: vi.fn(),
          get: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Saved reports')).toBeInTheDocument();
    });

    expect(screen.queryByText('Create new report')).not.toBeInTheDocument();
  });

  it('shows the create report button if jql is present', async () => {
    render(
      <SaveReportsWrapper
        linkBuilder={(query) => query}
        shouldShowReportsObservable={loggedInObservable}
        storage={{
          get: vi.fn().mockResolvedValue({ 'saved-reports': {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: '?jql=issues-and-what-not',
          set: vi.fn(),
          get: vi.fn(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Saved reports')).toBeInTheDocument();
      expect(screen.getByText('Create new report')).toBeInTheDocument();
    });
  });
});
