import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import JQLTextArea from './JqlTextArea';

describe('<JQLTextArea />', () => {
  it('renders without crashing', () => {
    render(
      <JQLTextArea
        jql="issueType in (Epic, Story) order by Rank"
        setJql={vi.fn()}
        isLoading
        isSuccess={false}
        totalChunks={10}
        receivedChunks={5}
        numberOfIssues={10}
      />,
    );

    const jqlTextarea = screen.getByLabelText('Add your JQL');
    expect(jqlTextarea).toBeInTheDocument();

    const issuesLoadedText = screen.getByText('Loaded 5 of 10 issues');
    expect(issuesLoadedText).toBeInTheDocument();
  });
});
