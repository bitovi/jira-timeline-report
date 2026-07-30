import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

import SaveReportsWrapper from './SaveReportsWrapper';
import { ReportLayoutProvider } from '../services/report-layout';

const mockOnViewReportsButtonClicked = vi.fn();

// SaveReports persists the report-of-reports document tree and derives the dirty flag from it, so it
// reads the shared layout context. In the app that context is mounted once in TimelineReport, above
// both SaveReports and the report body. See spec/016-report-of-reports Phase 3.
const renderWrapper = (element: React.ReactElement) => render(<ReportLayoutProvider>{element}</ReportLayoutProvider>);

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
    renderWrapper(
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
    renderWrapper(
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
