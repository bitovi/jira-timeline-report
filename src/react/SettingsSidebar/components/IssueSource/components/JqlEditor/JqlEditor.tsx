import type { FC, ReactNode } from 'react';

import React, { useState } from 'react';
import { JQLEditorAsync as AtlaskitJQLEditor } from '@atlaskit/jql-editor';

import { useJqlAutocompleteProvider } from '../../hooks/useJqlAutocompleteProvider';

const ANALYTICS_SOURCE = 'jira-timeline-report';

interface JqlEditorProps {
  query: string;
  onUpdate: (query: string) => void;
  /** Shows the editor's built-in searching indicator while a query is loading. */
  isSearching?: boolean;
  /**
   * Muted text tucked into the editor's 20px footer strip instead of below it. The editor uses the
   * left of that strip for keyboard hints (while focused) and syntax errors, so the text hides then.
   */
  helperText?: string;
  /** Right-aligned in the same strip and always visible (e.g. the "Loaded N issues" count). */
  helperEnd?: ReactNode;
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
const JqlEditor: FC<JqlEditorProps> = ({ query, onUpdate, isSearching, helperText, helperEnd }) => {
  const autocompleteProvider = useJqlAutocompleteProvider();
  const [hasFocus, setHasFocus] = useState(false);
  const [hasSyntaxError, setHasSyntaxError] = useState(false);

  const editor = (
    <AtlaskitJQLEditor
      locale="en"
      analyticsSource={ANALYTICS_SOURCE}
      query={query}
      autocompleteProvider={autocompleteProvider}
      onUpdate={(next, jast) => {
        setHasSyntaxError((jast?.errors.length ?? 0) > 0);
        onUpdate(next);
      }}
      isSearching={isSearching}
    />
  );

  if (!helperText && !helperEnd) {
    return editor;
  }

  return (
    <div className="flex flex-col" onFocus={() => setHasFocus(true)} onBlur={() => setHasFocus(false)}>
      {editor}
      {/* Pulled up over the editor's footer strip, leaving a 4px gap below the input. */}
      <div className="-mt-4 flex justify-between gap-2 text-xs min-h-4">
        <span className={`text-neutral-801 ${hasFocus || hasSyntaxError ? 'invisible' : ''}`}>{helperText}</span>
        {helperEnd && <span>{helperEnd}</span>}
      </div>
    </div>
  );
};

export default JqlEditor;
