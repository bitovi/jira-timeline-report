import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// The real JQLEditor is a heavy ProseMirror/react-intl component that is awkward under jsdom, so
// we swap it for a light textarea stub that preserves the controlled `query` / `onUpdate` contract.
vi.mock('@atlaskit/jql-editor', () => ({
  JQLEditorAsync: ({ query, onUpdate }: { query: string; onUpdate?: (query: string) => void }) => (
    <textarea aria-label="Add your JQL" value={query} onChange={(event) => onUpdate?.(event.target.value)} />
  ),
}));

// The autocomplete provider hook reaches into the Jira context; a no-op provider keeps this unit
// test focused on the surrounding behavior (query value + load-progress readout).
vi.mock('../../hooks/useJqlAutocompleteProvider', () => ({
  useJqlAutocompleteProvider: () => ({}),
}));

import JQLTextArea from './JqlTextArea';

describe('<JQLTextArea />', () => {
  it('renders the editor with the current query and the load-progress readout', () => {
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

    const jqlEditor = screen.getByLabelText('Add your JQL');
    expect(jqlEditor).toBeInTheDocument();
    expect(jqlEditor).toHaveValue('issueType in (Epic, Story) order by Rank');

    const issuesLoadedText = screen.getByText('Loaded 5 of 10 issues');
    expect(issuesLoadedText).toBeInTheDocument();
  });
});
