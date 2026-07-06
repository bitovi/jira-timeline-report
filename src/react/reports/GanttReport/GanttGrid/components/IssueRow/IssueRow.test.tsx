import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueRow } from './IssueRow';
import { makeIssue } from '../../fixtures';
import type { AxisRange } from '../../types';

const range: AxisRange = { firstDay: new Date('2025-01-01'), lastDay: new Date('2025-03-31') };

function renderRow(overrides: Partial<React.ComponentProps<typeof IssueRow>> = {}) {
  const issue = makeIssue({ key: 'A', summary: 'Do the thing' });
  const onToggle = vi.fn();
  const onPercentCompleteClick = vi.fn();
  const utils = render(
    <IssueRow
      issue={issue}
      depth={0}
      isShowingChildren={false}
      hasChildren={false}
      anyExpanded={false}
      onToggle={onToggle}
      showPercentComplete={true}
      onPercentCompleteClick={onPercentCompleteClick}
      range={range}
      roundTo="day"
      isDense={false}
      isBreakdown={false}
      workTypesWithWork={[]}
      textSizeClass=""
      expandPaddingClass=""
      gridRow={2}
      timelineGridColumn="4 / span 3"
      striped={false}
      {...overrides}
    />,
  );
  return { ...utils, issue, onToggle, onPercentCompleteClick };
}

describe('IssueRow', () => {
  it('renders the label and timeline cells', () => {
    renderRow();
    expect(screen.getByRole('link', { name: 'Do the thing' })).toBeInTheDocument();
  });

  it('renders the percent-complete cell when showPercentComplete is true', () => {
    renderRow({ showPercentComplete: true });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('omits the percent-complete cell when showPercentComplete is false', () => {
    const { container } = renderRow({ showPercentComplete: false });
    expect(container.querySelectorAll('[style*="grid-column: 3"]').length).toBe(0);
  });

  it('calls onToggle with the issue when the chevron is clicked', () => {
    const { onToggle, issue, container } = renderRow({ hasChildren: true });
    fireEvent.click(container.querySelector('img')!.parentElement!);
    expect(onToggle).toHaveBeenCalledWith(issue);
  });

  it('does not stripe the gutter columns when nothing is expanded, even on a striped row', () => {
    const { container } = renderRow({ striped: true, anyExpanded: false });
    expect(container.querySelector('[style*="grid-column: 1"]')).toHaveClass('', { exact: true });
    expect(container.querySelector('[style*="grid-column: 2"]')).toHaveClass('', { exact: true });
  });

  it('stripes the gutter columns when something is expanded, on a striped row', () => {
    const { container } = renderRow({ striped: true, anyExpanded: true });
    expect(container.querySelector('[style*="grid-column: 1"]')).toHaveClass('bg-neutral-20');
    expect(container.querySelector('[style*="grid-column: 2"]')).toHaveClass('bg-neutral-20');
  });

  it('always stripes the timeline column on a striped row, regardless of anyExpanded', () => {
    const { container } = renderRow({ striped: true, anyExpanded: false });
    expect(container.querySelector('[style*="grid-column: 4"]')).toHaveClass('bg-neutral-20');
  });
});
