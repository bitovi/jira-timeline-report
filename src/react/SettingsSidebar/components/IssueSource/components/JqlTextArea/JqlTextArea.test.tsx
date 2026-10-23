import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// The real JQLEditor is a heavy ProseMirror/react-intl component that is awkward under jsdom, so
// we swap it for a light textarea stub that preserves the controlled `query` / `onUpdate` contract.
// The aria-label/data-testid mirror the real widget's (see `messages.inputLabel` and
// `jql-editor-view/index.js` in `@atlaskit/jql-editor`) so this stub can't silently drift from what
// Playwright targets in the real DOM.
vi.mock('@atlaskit/jql-editor', () => ({
  JQLEditorAsync: ({ query, onUpdate }: { query: string; onUpdate?: (query: string) => void }) => (
    <textarea
      aria-label="JQL query"
      data-testid="jql-editor-input"
      value={query}
      onChange={(event) => onUpdate?.(event.target.value)}
    />
  ),
}));

// The autocomplete provider hook reaches into the Jira context; a no-op provider keeps this unit
// test focused on the surrounding behavior (query value + helper text).
vi.mock('../../hooks/useJqlAutocompleteProvider', () => ({
  useJqlAutocompleteProvider: () => ({}),
}));

import JQLTextArea from './JqlTextArea';

describe('<JQLTextArea />', () => {
  it('renders the editor with the current query and its helper text', () => {
    render(
      <JQLTextArea
        jql="issueType in (Epic, Story) order by Rank"
        setJql={vi.fn()}
        isLoading={false}
        helperText="JQL for the issues your report starts from."
      />,
    );

    const jqlEditor = screen.getByTestId('jql-editor-input');
    expect(jqlEditor).toBeInTheDocument();
    expect(jqlEditor).toHaveValue('issueType in (Epic, Story) order by Rank');

    expect(screen.getByText('JQL for the issues your report starts from.')).toBeInTheDocument();
  });
});
