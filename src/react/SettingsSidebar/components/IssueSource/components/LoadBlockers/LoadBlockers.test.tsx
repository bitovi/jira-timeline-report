import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// The blocker filter renders the shared JQL editor, which pulls in the heavy ProseMirror editor
// and the Jira-backed autocomplete provider. Swap it for a light textarea stub here.
vi.mock('../JqlEditor', () => ({
  default: ({
    query,
    onUpdate,
    helperText,
  }: {
    query: string;
    onUpdate: (query: string) => void;
    helperText?: string;
  }) => (
    <>
      <textarea aria-label="blocker jql editor" value={query} onChange={(event) => onUpdate(event.target.value)} />
      <span>{helperText}</span>
    </>
  ),
}));

import LoadBlockers from './LoadBlockers';

describe('<LoadBlockers />', () => {
  it('renders without crashing', () => {
    render(<LoadBlockers loadBlockers={false} setLoadBlockers={vi.fn()} blockerJql="" setBlockerJql={vi.fn()} />);

    const loadBlockersCheckbox = screen.getByLabelText(/blockers of queried issues, recursively/i);
    expect(loadBlockersCheckbox).toBeInTheDocument();

    expect(screen.queryByText(/filter blockers with jql \(optional\)/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('blocker jql editor')).not.toBeInTheDocument();
  });

  it('shows the blocker JQL editor when loadBlockers is checked', () => {
    render(<LoadBlockers loadBlockers={true} setLoadBlockers={vi.fn()} blockerJql="" setBlockerJql={vi.fn()} />);

    expect(screen.getByText(/filter blockers with jql \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('blocker jql editor')).toBeInTheDocument();
  });
});
