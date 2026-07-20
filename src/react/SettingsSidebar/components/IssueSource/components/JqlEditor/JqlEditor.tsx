import type { FC } from 'react';

import React from 'react';
import { JQLEditorAsync as AtlaskitJQLEditor } from '@atlaskit/jql-editor';

import { useJqlAutocompleteProvider } from '../../hooks/useJqlAutocompleteProvider';

const ANALYTICS_SOURCE = 'jira-timeline-report';

interface JqlEditorProps {
  query: string;
  onUpdate: (query: string) => void;
  /** Shows the editor's built-in searching indicator while a query is loading. */
  isSearching?: boolean;
}

/**
 * The shared `@atlaskit/jql-editor` control (syntax highlighting + autocomplete + inline
 * validation), wired to the app's Jira client. Used for both the main issue-source JQL and the
 * optional children JQL filter.
 *
 * `query` is a controlled prop: the editor resets its content when `query` changes and differs
 * from what the user has typed, so external updates (e.g. the cycle-time slider writing
 * routeData.jql) flow in without a remount. `locale="en"` gives the editor its own IntlProvider —
 * this app has none higher in the tree.
 */
const JqlEditor: FC<JqlEditorProps> = ({ query, onUpdate, isSearching }) => {
  const autocompleteProvider = useJqlAutocompleteProvider();

  return (
    <AtlaskitJQLEditor
      locale="en"
      analyticsSource={ANALYTICS_SOURCE}
      query={query}
      autocompleteProvider={autocompleteProvider}
      onUpdate={(next) => onUpdate(next)}
      isSearching={isSearching}
    />
  );
};

export default JqlEditor;
