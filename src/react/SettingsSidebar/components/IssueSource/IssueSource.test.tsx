import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import IssueSource from './IssueSource';

vi.mock('./hooks/useRawIssueRequestData', () => ({
  useRawIssuesRequestData: vi.fn().mockReturnValue({
    issuesPromise: { isPending: false, isResolved: true, value: [] }, // mock resolved promise
    isLoading: false,
    isSuccess: true,
    numberOfIssues: 0,
    receivedChunks: 0,
    totalChunks: 10,
  }),
}));

vi.mock('./hooks/useJQL', () => ({
  useJQL: vi.fn().mockReturnValue({
    loadChildren: false,
    jql: '',
    setJql: vi.fn(),
    childJQL: '',
    setChildJQL: vi.fn(),
    applyJql: vi.fn(),
    statusesToExclude: [],
    setStatusesToExclude: vi.fn(),
    applyButtonEnabled: true,
  }),
}));

describe('<IssueSource />', () => {
  it('renders without crashing', () => {
    render(<IssueSource />);

    const heading = screen.getByText('Issue Source');
    expect(heading).toBeInTheDocument();

    const jqlTextarea = screen.getByRole('textbox');
    expect(jqlTextarea).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /apply/i });
    expect(applyButton).toBeInTheDocument();

    const loadChildrenCheckbox = screen.getByLabelText(/Load all children of JQL specified issues/);
    expect(loadChildrenCheckbox).toBeInTheDocument();
  });
});
