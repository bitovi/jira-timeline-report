import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineCell } from './TimelineCell';
import { makeIssue } from '../../fixtures';
import type { AxisRange } from '../../types';

const range: AxisRange = { firstDay: new Date('2025-01-01'), lastDay: new Date('2025-03-31') };

describe('TimelineCell', () => {
  it('applies the given grid-column to its container', () => {
    const issue = makeIssue({ key: 'A', start: new Date('2025-01-10'), due: new Date('2025-01-20') });
    const { container } = render(
      <TimelineCell
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
        gridColumn="3 / span 3"
      />,
    );
    expect((container.firstChild as HTMLElement).style.gridColumn).toBe('3 / span 3');
  });

  it('renders the TimelineBar for the issue', () => {
    const issue = makeIssue({ key: 'A' });
    render(
      <TimelineCell
        issue={issue}
        range={range}
        roundTo="day"
        isDense={false}
        isBreakdown={false}
        workTypesWithWork={[]}
        gridColumn="3 / span 3"
      />,
    );
    expect(screen.getByTestId('status-circle')).toBeInTheDocument();
  });
});
