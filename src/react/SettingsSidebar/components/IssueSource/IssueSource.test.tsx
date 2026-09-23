import React from 'react';

import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

// Swap the heavy ProseMirror editor for a textarea stub and stub the autocomplete provider hook
// (which otherwise requires the Jira context) so IssueSource can mount under jsdom.
vi.mock('@atlaskit/jql-editor', () => ({
  JQLEditorAsync: ({ query, onUpdate }: { query: string; onUpdate?: (query: string) => void }) => (
    <textarea aria-label="Add your JQL" value={query} onChange={(event) => onUpdate?.(event.target.value)} />
  ),
}));

vi.mock('./hooks/useJqlAutocompleteProvider', () => ({
  useJqlAutocompleteProvider: () => ({}),
}));

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

// The property names here are the ones the component destructures. An earlier version of this mock
// returned `childJQL`/`setChildJQL` while the component read `childJql`/`setChildJql`, so the child
// filter was silently rendering with `undefined` — keep these in step with `useJQL`'s return.
vi.mock('./hooks/useJQL', () => ({
  useJQL: vi.fn().mockReturnValue({
    loadChildren: false,
    jql: '',
    setJql: vi.fn(),
    childJql: '',
    setChildJql: vi.fn(),
    applyJql: vi.fn(),
    statusesToExclude: [],
    setStatusesToExclude: vi.fn(),
    applyButtonEnabled: true,
    loadBlockers: false,
    setLoadBlockers: vi.fn(),
    blockerJql: '',
    setBlockerJql: vi.fn(),
  }),
}));

// `useAsyncFeatures` reads app storage through a provider this component is mounted without. Stub
// the whole service so each test can pick the flag state it wants.
const mockFeatures = vi.fn();
vi.mock('../../../services/features', () => ({
  useAsyncFeatures: () => mockFeatures(),
}));

describe('<IssueSource />', () => {
  beforeEach(() => {
    mockFeatures.mockReturnValue({ features: {}, isLoading: false });
  });

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

  // The flag gates the CONTROL only — spec/036 §5. `loadBlockers` reaching the request layer from a
  // URL is deliberately not gated, which is what lets the team dogfood before flipping the toggle.
  it('hides the blockers checkbox when recursiveBlockers is off', () => {
    render(<IssueSource />);

    expect(screen.queryByLabelText(/Load all blockers recursively of JQL specified issues/)).not.toBeInTheDocument();
  });

  it('shows the blockers checkbox when recursiveBlockers is on', () => {
    mockFeatures.mockReturnValue({ features: { recursiveBlockers: true }, isLoading: false });

    render(<IssueSource />);

    expect(screen.getByLabelText(/Load all blockers recursively of JQL specified issues/)).toBeInTheDocument();
  });

  // The features query can be in flight on first paint; `features` is undefined then, and reading
  // `.recursiveBlockers` off it must not throw.
  it('survives features still loading', () => {
    mockFeatures.mockReturnValue({ features: undefined, isLoading: true });

    render(<IssueSource />);

    expect(screen.getByText('Issue Source')).toBeInTheDocument();
  });
});
