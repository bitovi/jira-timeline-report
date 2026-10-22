import React from 'react';

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// The children filter renders the shared JQL editor, which pulls in the heavy ProseMirror editor
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
      <textarea aria-label="children jql editor" value={query} onChange={(event) => onUpdate(event.target.value)} />
      <span>{helperText}</span>
    </>
  ),
}));

import LoadChildren from './LoadChildren';

describe('<LoadChildren />', () => {
  it('renders without crashing', () => {
    render(<LoadChildren loadChildren={false} setLoadChildren={vi.fn()} childJql="" setChildJql={vi.fn()} />);

    const loadChildrenCheckbox = screen.getByLabelText(/children of queried issues/i);
    expect(loadChildrenCheckbox).toBeInTheDocument();

    expect(screen.queryByText(/filter children with jql \(optional\)/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('children jql editor')).not.toBeInTheDocument();
  });

  it('shows the child JQL editor when loadChildren is checked', () => {
    render(<LoadChildren loadChildren={true} setLoadChildren={vi.fn()} childJql="" setChildJql={vi.fn()} />);

    expect(screen.getByText(/filter children with jql \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('children jql editor')).toBeInTheDocument();
  });
});
