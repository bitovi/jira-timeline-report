import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineBar } from './TimelineBar';
import { makeIssue } from '../../fixtures';
import type { AxisRange } from '../../types';

const range: AxisRange = { firstDay: new Date('2025-01-01'), lastDay: new Date('2025-03-31') };

describe('TimelineBar', () => {
  it('renders an empty-set circle when the issue has no dates', () => {
    const issue = makeIssue({ key: 'A' });
    render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
      />,
    );
    expect(screen.getByTestId('status-circle').querySelector('img')).toBeInTheDocument();
  });

  it('renders a past-due circle when the work is entirely before firstDay', () => {
    const issue = makeIssue({ key: 'A', start: new Date('2024-10-01'), due: new Date('2024-11-01') });
    render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
      />,
    );
    const circle = screen.getByTestId('status-circle');
    expect(circle).toHaveTextContent('←');
  });

  it('renders a current bar for a normal in-range issue', () => {
    const issue = makeIssue({ key: 'A', start: new Date('2025-01-10'), due: new Date('2025-01-20') });
    const { container } = render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
      />,
    );
    expect(container.querySelector('.identifier-current-time')).toBeInTheDocument();
  });

  it('renders a shadow bar when the last period differs from the current period', () => {
    const issue = makeIssue({
      key: 'A',
      start: new Date('2025-01-10'),
      due: new Date('2025-01-20'),
      lastPeriod: { start: new Date('2025-01-05'), due: new Date('2025-01-15') },
    });
    render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
      />,
    );
    expect(screen.getByTestId('shadow-bar')).toBeInTheDocument();
  });

  it('renders an empty-set-past circle when the last period lost its dates', () => {
    const issue = makeIssue({ key: 'A', start: new Date('2025-01-10'), due: new Date('2025-01-20') });
    // simulate a lastPeriod with no dates
    issue.rollupStatuses.rollup.lastPeriod = { start: null, due: null };
    render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
      />,
    );
    const circle = screen.getByTestId('status-circle');
    expect(circle).toHaveTextContent('∅');
  });

  it('renders one bar per work type with work in breakdown mode', () => {
    const issue = makeIssue({
      key: 'A',
      start: new Date('2025-01-10'),
      due: new Date('2025-01-20'),
      workTypeRollups: {
        dev: { status: 'complete', start: new Date('2025-01-10'), due: new Date('2025-01-15'), issueKeys: ['DEV-1'] },
        qa: { status: 'ontrack', start: new Date('2025-01-16'), due: new Date('2025-01-20'), issueKeys: ['QA-1'] },
      },
    });
    const { container } = render(
      <TimelineBar
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={true}
        workTypesWithWork={[
          { type: 'design', hasWork: false },
          { type: 'dev', hasWork: true },
          { type: 'qa', hasWork: true },
          { type: 'uat', hasWork: false },
        ]}
      />,
    );
    expect(container.querySelector('.dev_time')).toBeInTheDocument();
    expect(container.querySelector('.qa_time')).toBeInTheDocument();
    expect(container.querySelector('.uat_time')).not.toBeInTheDocument();
  });
});
