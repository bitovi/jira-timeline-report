import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueTooltip } from './IssueTooltip';
import { makeIssue } from '../../fixtures';

describe('IssueTooltip', () => {
  it('renders the trigger children and no popup content initially', () => {
    const issue = makeIssue({ key: 'A', summary: 'Do the thing' });
    render(
      <IssueTooltip issue={issue}>{(triggerProps) => <button {...triggerProps}>Do the thing</button>}</IssueTooltip>,
    );
    expect(screen.getByRole('button', { name: 'Do the thing' })).toBeInTheDocument();
    expect(screen.queryByTestId('issue-tooltip')).not.toBeInTheDocument();
  });

  it('opens the popup showing the issue title and Show Children link when the trigger is clicked', async () => {
    const issue = makeIssue({ key: 'A', summary: 'Do the thing', url: 'https://example.com/A' });
    render(<IssueTooltip issue={issue}>{(triggerProps) => <button {...triggerProps}>trigger</button>}</IssueTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));
    expect(await screen.findByTestId('issue-tooltip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Do the thing' })).toHaveAttribute('href', 'https://example.com/A');
    expect(screen.getByRole('link', { name: 'Show Children' })).toBeInTheDocument();
  });

  it('closes the popup when the close button is clicked', async () => {
    const issue = makeIssue({ key: 'A' });
    render(<IssueTooltip issue={issue}>{(triggerProps) => <button {...triggerProps}>trigger</button>}</IssueTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('issue-tooltip')).not.toBeInTheDocument();
  });

  it('renders a section per work part that has data', async () => {
    const issue = makeIssue({
      key: 'A',
      workTypeRollups: {
        dev: { status: 'complete', start: new Date('2025-01-01'), due: new Date('2025-01-05'), issueKeys: ['DEV-1'] },
      },
    });
    render(<IssueTooltip issue={issue}>{(triggerProps) => <button {...triggerProps}>trigger</button>}</IssueTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));
    expect(await screen.findByText('DEV')).toBeInTheDocument();
  });
});
