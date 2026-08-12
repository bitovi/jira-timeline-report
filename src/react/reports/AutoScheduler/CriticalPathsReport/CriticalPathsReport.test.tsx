import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalPathsReport } from './CriticalPathsReport';
import type { StatsUIData, SimulationIssueResult } from '../scheduler/stats-analyzer';

function issue(
  overrides: Partial<SimulationIssueResult> & { key: string; blocks?: string[]; blocksWorkDepth?: number },
): SimulationIssueResult {
  const { blocks = [], blocksWorkDepth = 0, ...rest } = overrides;
  return {
    linkedIssue: {
      key: rest.key,
      summary: rest.key,
      url: `#${rest.key}`,
      linkedBlocks: blocks.map((key) => ({ key })),
      blocksWorkDepth,
    },
    adjustedDaysOfWork: 5,
    criticalityIndex: 0,
    meanWorkDays: 0,
    meanQueuedDays: 0,
    ...rest,
  } as unknown as SimulationIssueResult;
}

describe('CriticalPathsReport', () => {
  it('renders one row per root epic with rank, percent, chain summary, and days', () => {
    const b = issue({ key: 'B', criticalityIndex: 0.78, meanWorkDays: 20, meanQueuedDays: 5, blocksWorkDepth: 0 });
    const a = issue({
      key: 'A',
      criticalityIndex: 0.78,
      meanWorkDays: 10,
      meanQueuedDays: 2,
      blocks: ['B'],
      blocksWorkDepth: 1,
    });
    const uiData = { simulationIssueResults: [b, a] } as unknown as StatsUIData;

    render(<CriticalPathsReport uiData={uiData} workItemsToHighlight={null} setWorkItemsToHighlight={vi.fn()} />);

    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('37 d')).toBeInTheDocument(); // 10+20 work + 2+5 queued
  });

  it('highlights the row-s chain and fan-out when expanded, and clears highlighting when collapsed', () => {
    const b = issue({ key: 'B', criticalityIndex: 0.78, meanWorkDays: 20, meanQueuedDays: 5, blocksWorkDepth: 0 });
    const a = issue({
      key: 'A',
      criticalityIndex: 0.78,
      meanWorkDays: 10,
      meanQueuedDays: 2,
      blocks: ['B'],
      blocksWorkDepth: 1,
    });
    const uiData = { simulationIssueResults: [b, a] } as unknown as StatsUIData;
    const setWorkItemsToHighlight = vi.fn();

    render(
      <CriticalPathsReport
        uiData={uiData}
        workItemsToHighlight={null}
        setWorkItemsToHighlight={setWorkItemsToHighlight}
      />,
    );

    const details = screen.getByText('78%').closest('details')!;

    // Expand
    details.open = true;
    fireEvent(details, new Event('toggle', { bubbles: true }));
    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(new Set(['A', 'B']));

    // Collapse
    details.open = false;
    fireEvent(details, new Event('toggle', { bubbles: true }));
    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(null);
  });
});
