import React from 'react';

import { render, screen } from '@testing-library/react';

import IssueLoadStatus from './IssueLoadStatus';

describe('<IssueLoadStatus />', () => {
  it('shows chunk progress while loading', () => {
    render(<IssueLoadStatus isLoading isSuccess={false} totalChunks={10} receivedChunks={5} numberOfIssues={0} />);

    expect(screen.getByText('Loaded 5 of 10 issues')).toBeInTheDocument();
  });

  it('shows a generic message before the chunk count is known', () => {
    render(<IssueLoadStatus isLoading isSuccess={false} totalChunks={0} receivedChunks={0} numberOfIssues={0} />);

    expect(screen.getByText('Loading issues ...')).toBeInTheDocument();
  });

  it('shows the issue count once loaded', () => {
    render(<IssueLoadStatus isLoading={false} isSuccess totalChunks={10} receivedChunks={10} numberOfIssues={214} />);

    expect(screen.getByText('Loaded 214 issues')).toBeInTheDocument();
  });
});
