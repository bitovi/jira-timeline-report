import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupRow } from './GroupRow';
import { makeIssue } from '../../fixtures';
import type { GroupHeader } from '../../types';

describe('GroupRow', () => {
  it('renders a plain label when there is no parent issue', () => {
    const group: GroupHeader = { key: 'team-a', summary: 'Team A', status: null };
    render(<GroupRow group={group} gridRow={1} />);
    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies the special-status class for blocked/complete/warning statuses', () => {
    const group: GroupHeader = { key: 'team-a', summary: 'Team A', status: 'blocked' };
    render(<GroupRow group={group} gridRow={1} />);
    expect(screen.getByText('Team A').className).toContain('color-text-blocked');
  });

  it('wraps the label in an IssueTooltip trigger when a parent issue is present', async () => {
    const parent = makeIssue({ key: 'P-1', summary: 'Parent issue' });
    const group: GroupHeader = { key: 'P-1', summary: 'Parent issue', status: null, parent };
    render(<GroupRow group={group} gridRow={1} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByTestId('issue-tooltip')).toBeInTheDocument();
  });
});
