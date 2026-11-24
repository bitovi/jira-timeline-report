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

  describe('work breakdown (rollupCalculation flag)', () => {
    const parent = makeIssue({
      key: 'A',
      summary: 'Parent issue',
      completedWorkingDays: 10,
      totalWorkingDays: 40,
      averagedWorkingDays: 8,
      unsizedIssueKeys: ['C'],
    });
    const child = makeIssue({ key: 'B', summary: 'Child issue', completedWorkingDays: 10, totalWorkingDays: 32 });

    it('is hidden when the flag is off', () => {
      render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={parent} childIssues={[child]} />);
      expect(screen.queryByText('Known %')).not.toBeInTheDocument();
      expect(screen.queryByTestId('work-breakdown-summary')).not.toBeInTheDocument();
    });

    it('adds Known % and Averaged Days, and summarizes the averaged days and gaps', () => {
      render(
        <PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={parent} childIssues={[child]} showWorkBreakdown />,
      );
      expect(screen.getByText('Known %')).toBeInTheDocument();
      expect(screen.getByText('Averaged Days')).toBeInTheDocument();
      expect(screen.getByTestId('work-breakdown-summary')).toHaveTextContent(
        '8 of 40 working days are averaged · 1 item has no size',
      );
      // parent known 10 of 32, child 10 of 32 (both % and known %) → 31% three times
      expect(screen.getAllByText('31%')).toHaveLength(3);
    });

    it('says how a self-sized issue was sized', () => {
      const self = makeIssue({
        key: 'A',
        completedWorkingDays: 2,
        totalWorkingDays: 8,
        source: 'self',
        workSize: {
          totalDaysOfWork: 8,
          completedDaysOfWork: 2,
          sizeFrom: 'teamTime',
          legacy: false,
          estimateDays: 4,
          spanDays: 12,
          teamTimeDays: 8,
        },
      });
      render(<PercentCompleteModal isOpen={true} onClose={vi.fn()} issue={self} childIssues={[]} showWorkBreakdown />);
      expect(screen.getByText('Sized by team time over its dates.')).toBeInTheDocument();
      expect(screen.getByText('Team time over its dates')).toBeInTheDocument();
    });
  });
});
