import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import routeData from '../../../../canjs/routing/route-data/route-data';

// Unlike IssueSource.test.tsx, the panel's hooks run for real here against a stubbed routeData, so
// these cover the round trip: route data → rules in the panel → route data.
vi.mock('@atlaskit/jql-editor', () => ({
  JQLEditorAsync: ({ query, onUpdate }: { query: string; onUpdate?: (query: string) => void }) => (
    <textarea aria-label="Add your JQL" value={query} onChange={(event) => onUpdate?.(event.target.value)} />
  ),
}));

vi.mock('./hooks/useJqlAutocompleteProvider', () => ({
  useJqlAutocompleteProvider: () => ({}),
}));

vi.mock('./hooks/useRawIssueRequestData', () => ({
  useRawIssuesRequestData: () => ({
    isLoading: false,
    isSuccess: true,
    numberOfIssues: 3,
    receivedChunks: 0,
    totalChunks: 0,
  }),
}));

vi.mock('../../../services/features', () => ({
  useAsyncFeatures: () => ({ features: {}, isLoading: false }),
}));

vi.mock('../../../../canjs/routing/route-data/route-data', async () => {
  const { ObservableObject } = await import('../../../../can');
  return {
    default: new (ObservableObject as ObjectConstructor)({
      jql: 'project = TEST',
      childJQL: '',
      loadChildren: false,
      blockerJQL: '',
      loadBlockers: false,
      statusesToExclude: [],
      sourceFilterRows: [],
      effectiveSourceFilterRows: [],
      derivedIssues: [
        { status: 'Done', type: 'Story', labels: ['api'] },
        { status: 'In Progress', type: 'Epic', labels: [] },
      ],
    }),
  };
});

import IssueSource from './IssueSource';

type MockRouteData = {
  jql: string;
  statusesToExclude: string[];
  sourceFilterRows: unknown[];
  effectiveSourceFilterRows: unknown[];
  assign: (values: Record<string, unknown>) => void;
};
const mockRouteData = routeData as unknown as MockRouteData;

const legacyRule = { id: 'legacy-statuses-to-exclude', field: 'status', operator: 'is not', value: ['Done'] };

describe('<IssueSource /> filter loaded issues', () => {
  beforeEach(() => {
    mockRouteData.assign({
      jql: 'project = TEST',
      statusesToExclude: [],
      sourceFilterRows: [],
      effectiveSourceFilterRows: [],
    });
  });

  // Rules only filter issues already loaded, so they apply without a button, like the report Filters.
  it('writes rule changes straight to route data and clears the legacy statusesToExclude', async () => {
    const user = userEvent.setup();
    mockRouteData.assign({ statusesToExclude: ['Done'], effectiveSourceFilterRows: [legacyRule] });
    render(<IssueSource />);

    await user.click(screen.getByText('+ Add rule'));

    expect(mockRouteData.statusesToExclude).toEqual([]);
    expect(mockRouteData.sourceFilterRows).toMatchObject([legacyRule, { field: 'status', operator: 'is', value: [] }]);
  });

  it('renders a legacy statusesToExclude as a Status · is not rule', () => {
    mockRouteData.assign({ statusesToExclude: ['Done'], effectiveSourceFilterRows: [legacyRule] });
    render(<IssueSource />);

    expect(screen.getAllByTestId('filter-row')).toHaveLength(1);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('is not')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('offers values from the loaded issues', async () => {
    const user = userEvent.setup();
    mockRouteData.assign({ effectiveSourceFilterRows: [{ ...legacyRule, field: 'issueType', value: [] }] });
    render(<IssueSource />);

    await user.click(screen.getByLabelText('Value'));

    expect(screen.getByText('Epic')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
  });

  it('Load issues turns on once the query is edited, and saves the query', async () => {
    const user = userEvent.setup();
    render(<IssueSource />);

    const loadIssues = screen.getByRole('button', { name: /load issues/i });
    expect(loadIssues).toBeDisabled();

    await user.type(screen.getByLabelText('Add your JQL'), ' AND type = Bug');
    expect(loadIssues).toBeEnabled();

    await user.click(loadIssues);
    expect(mockRouteData.jql).toBe('project = TEST AND type = Bug');
  });
});
