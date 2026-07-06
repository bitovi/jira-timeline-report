import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PercentCompleteModal } from './PercentCompleteModal';
import { makeIssue } from '../../fixtures';

describe('PercentCompleteModal', () => {
  it('renders nothing when isOpen is false', () => {
    const issue = makeIssue({ key: 'A' });
    render(<PercentCompleteModal isOpen={false} onClose={vi.fn()} issue={issue} childIssues={[]} />);
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });

  it('shows the issue row and its percent complete when open', () => {
    const issue = makeIssue({ key: 'A', summary: 'Parent issue', completedWorkingDays: 2, totalWorkingDays: 4 });
    render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={issue} childIssues={[]} />);
    expect(screen.getByText('Parent issue')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders a row per child issue', () => {
    const issue = makeIssue({ key: 'A', summary: 'Parent issue', completedWorkingDays: 1, totalWorkingDays: 2 });
    const child = makeIssue({ key: 'B', summary: 'Child issue', completedWorkingDays: 1, totalWorkingDays: 1 });
    render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={issue} childIssues={[child]} />);
    expect(screen.getByText('Child issue')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const issue = makeIssue({ key: 'A' });
    const onClose = vi.fn();
    render(<PercentCompleteModal isOpen={true} onClose={onClose} issue={issue} childIssues={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close Modal' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the self calculation breakdown when source is "self"', () => {
    const issue = makeIssue({
      key: 'A',
      summary: 'Leaf issue',
      completedWorkingDays: 3,
      totalWorkingDays: 5,
      source: 'self',
      derivedTiming: {
        completedDaysOfWork: 3,
        totalDaysOfWork: 5,
        datesDaysOfWork: 10,
        datesCompletedDaysOfWork: 6,
        isStoryPointsMedianValid: false,
        isStoryPointsValid: false,
        deterministicTotalPoints: 0,
        defaultOrStoryPointsMedian: 0,
        usedConfidence: 0,
      },
    });
    render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={issue} childIssues={[]} />);
    expect(screen.getByText('Remaining Work Calculation Summary')).toBeInTheDocument();
    expect(screen.getByText('Calculation Source: self')).toBeInTheDocument();
    expect(screen.getByText('Calculation method: dates')).toBeInTheDocument();
  });

  it('renders a single average-days box when source is "average"', () => {
    const issue = makeIssue({
      key: 'A',
      summary: 'Average issue',
      type: 'Story',
      completedWorkingDays: 2,
      totalWorkingDays: 4,
      source: 'average',
    });
    render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={issue} childIssues={[]} />);
    expect(screen.getByText('Calculation Source: average')).toBeInTheDocument();
    expect(screen.getByText('Story average days')).toBeInTheDocument();
  });
});
