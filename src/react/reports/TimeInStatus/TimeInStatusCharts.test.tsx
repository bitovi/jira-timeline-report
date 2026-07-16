import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { TimeInStatusCharts, type IssueTypeChartData } from './TimeInStatusCharts';

const findPill = (status: string): HTMLElement => {
  const match = screen
    .getAllByText(status)
    .map((el) => el.closest('div[draggable]'))
    .find((el): el is HTMLElement => el !== null);
  if (!match) throw new Error(`Could not find draggable pill for status "${status}"`);
  return match;
};

const makeIssueType = (statusColumns: string[]): IssueTypeChartData => ({
  issueType: 'Story',
  count: 3,
  statusColumns,
  allStatusColumns: statusColumns,
  series: [
    {
      projectKey: 'ABC',
      count: 3,
      points: statusColumns.map((statusName, i) => ({
        statusIndex: i,
        statusName,
        avgMs: (i + 1) * 3_600_000,
      })),
    },
  ],
});

describe('<TimeInStatusCharts /> drag-to-reorder', () => {
  it('does not commit the order on every dragover tick, only once on dragend', () => {
    const onSetCustomOrder = vi.fn();
    const statusColumns = ['To Do', 'In Progress', 'Review', 'Done'];

    render(
      <TimeInStatusCharts
        issueTypes={[makeIssueType(statusColumns)]}
        allProjectKeys={['ABC']}
        onHideStatus={vi.fn()}
        onShowStatus={vi.fn()}
        customOrders={undefined}
        onSetCustomOrder={onSetCustomOrder}
      />,
    );

    fireEvent.click(screen.getByText('Reorder Statuses ▾'));

    const toDoPill = findPill('To Do');
    const reviewPill = findPill('Review');
    const donePill = findPill('Done');

    fireEvent.dragStart(toDoPill);

    // Simulate a slow, multi-tick drag across several other pills — this is what
    // fires dozens of times per second during a real drag gesture.
    fireEvent.dragOver(reviewPill);
    fireEvent.dragOver(donePill);
    fireEvent.dragOver(reviewPill);

    expect(onSetCustomOrder).not.toHaveBeenCalled();

    fireEvent.dragEnd(toDoPill);

    expect(onSetCustomOrder).toHaveBeenCalledTimes(1);
    expect(onSetCustomOrder).toHaveBeenCalledWith('Story', ['In Progress', 'To Do', 'Review', 'Done']);
  });

  it('does not commit anything if the drag ends without moving over another visible status', () => {
    const onSetCustomOrder = vi.fn();
    const statusColumns = ['To Do', 'In Progress', 'Review', 'Done'];

    render(
      <TimeInStatusCharts
        issueTypes={[makeIssueType(statusColumns)]}
        allProjectKeys={['ABC']}
        onHideStatus={vi.fn()}
        onShowStatus={vi.fn()}
        customOrders={undefined}
        onSetCustomOrder={onSetCustomOrder}
      />,
    );

    fireEvent.click(screen.getByText('Reorder Statuses ▾'));

    const toDoPill = findPill('To Do');

    fireEvent.dragStart(toDoPill);
    fireEvent.dragEnd(toDoPill);

    expect(onSetCustomOrder).not.toHaveBeenCalled();
  });
});
