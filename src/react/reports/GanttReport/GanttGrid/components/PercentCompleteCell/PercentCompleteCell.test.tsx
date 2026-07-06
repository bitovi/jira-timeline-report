import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PercentCompleteCell } from './PercentCompleteCell';
import { makeIssue } from '../../fixtures';

describe('PercentCompleteCell', () => {
  it('renders an em dash when totalWorkingDays is 0', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 0, totalWorkingDays: 0 });
    render(<PercentCompleteCell issue={issue} textSizeClass="" onClick={vi.fn()} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the rounded percentage', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 1, totalWorkingDays: 3 });
    render(<PercentCompleteCell issue={issue} textSizeClass="" onClick={vi.fn()} />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('calls onClick with the issue when clicked', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 1, totalWorkingDays: 2 });
    const onClick = vi.fn();
    render(<PercentCompleteCell issue={issue} textSizeClass="" onClick={onClick} />);
    fireEvent.click(screen.getByText('50%'));
    expect(onClick).toHaveBeenCalledWith(issue);
  });
});
