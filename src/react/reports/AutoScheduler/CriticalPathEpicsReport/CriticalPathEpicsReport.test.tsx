import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CriticalPathEpicsReport } from './CriticalPathEpicsReport';
import type { StatsUIData } from '../scheduler/stats-analyzer';

const routes = [
  { keys: ['IDENTITY', 'CHECKOUT', 'PAYMENTS'], count: 55 },
  { keys: ['IDENTITY', 'CHECKOUT', 'FRAUD'], count: 18 },
];

function epic(key: string, summary: string, team: string, daysAdded: number, onPathIndex: number) {
  return {
    linkedIssue: { key, summary, url: `#${key}`, team: { name: team } },
    sequencingDaysAdded: daysAdded,
    sequencingCriticalityIndex: onPathIndex,
  };
}

const uiData = {
  simulationIssueResults: [
    epic('CHECKOUT', 'Checkout rewrite', 'Alpha', 7.8, 0.68),
    epic('PAYMENTS', 'Payments API', 'Beta', 11.75, 0.41),
    epic('IDENTITY', 'Identity service', 'Alpha', 4.2, 0.9),
    epic('FRAUD', 'Fraud checks', 'Gamma', 0, 0),
  ],
  criticalPath: {
    meanLength: 43.0,
    iterations: 100,
    // Only two routes are listed above, so the card has ten more to summarise.
    distinctPathCount: 12,
    topPaths: (limit: number) => routes.slice(0, limit),
  },
} as unknown as StatsUIData;

function renderReport(props: Partial<React.ComponentProps<typeof CriticalPathEpicsReport>> = {}) {
  const setWorkItemsToHighlight = vi.fn();
  const onExpandedChange = vi.fn();
  const allProps = {
    uiData,
    expanded: true,
    workItemsToHighlight: null,
    onExpandedChange,
    setWorkItemsToHighlight,
    ...props,
  } as React.ComponentProps<typeof CriticalPathEpicsReport>;

  const { rerender } = render(<CriticalPathEpicsReport {...allProps} />);

  return {
    setWorkItemsToHighlight,
    onExpandedChange,
    setHighlightFromElsewhere: (workItemsToHighlight: Set<string> | null) =>
      rerender(<CriticalPathEpicsReport {...allProps} workItemsToHighlight={workItemsToHighlight} />),
  };
}

describe('CriticalPathEpicsReport', () => {
  it('renders only the header while collapsed', () => {
    renderReport({ expanded: false });

    expect(screen.getByRole('button', { name: /Epics on the critical path/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments API')).not.toBeInTheDocument();
  });

  it('asks to be expanded when the header is clicked', () => {
    const { onExpandedChange } = renderReport({ expanded: false });

    fireEvent.click(screen.getByRole('button', { name: /Epics on the critical path/ }));

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('lists epics ranked by days added, with the team and the percentage', () => {
    renderReport();

    const rows = screen.getAllByRole('row');
    // header, four epics, footer
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent('Payments API');
    expect(rows[1]).toHaveTextContent('11.8');
    expect(rows[1]).toHaveTextContent('41%');
    expect(rows[2]).toHaveTextContent('Checkout rewrite');
  });

  it('folds epics past the tenth into a residual row so the column still sums to the footer', () => {
    const manyEpics = {
      ...uiData,
      // 12 down to 1, summing to 78.
      simulationIssueResults: Array.from({ length: 12 }, (_, index) =>
        epic(`E${index}`, `Epic ${index}`, 'Alpha', 12 - index, 0.5),
      ),
    } as unknown as StatsUIData;

    renderReport({ uiData: manyEpics });

    // header, ten epics, residual, footer
    expect(screen.getAllByRole('row')).toHaveLength(13);
    // Scoped to the residual row: the tenth listed epic also has 3 days added, so a bare
    // getByText('3.0') would match two cells.
    const residualRow = screen.getByText('2 other epics').closest('tr');
    expect(residualRow).toHaveTextContent('3.0'); // the 2 + 1 the table stopped listing
  });

  it('shows the critical path length as the column total', () => {
    renderReport();

    expect(screen.getByText('Critical path length')).toBeInTheDocument();
    expect(screen.getByText('43.0')).toBeInTheDocument();
  });

  it('highlights every epic sharing a critical path with the clicked epic', () => {
    const { setWorkItemsToHighlight } = renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Checkout rewrite/ }));

    expect(setWorkItemsToHighlight).toHaveBeenCalledWith(new Set(['IDENTITY', 'CHECKOUT', 'PAYMENTS', 'FRAUD']));
  });

  it('clears the highlight when the selected epic is clicked again', () => {
    const { setWorkItemsToHighlight } = renderReport();

    const button = screen.getByRole('button', { name: /Checkout rewrite/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(setWorkItemsToHighlight).toHaveBeenLastCalledWith(null);
  });

  it('lists the most common critical paths by summary, as a share of every run', () => {
    renderReport();

    expect(screen.getByText('Most common critical paths')).toBeInTheDocument();
    // Summaries, not keys.
    expect(screen.getByText('Identity service → Checkout rewrite → Payments API')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument(); // 55 of 100 iterations, not 55 of 73
  });

  it('summarises the routes it did not list', () => {
    renderReport();

    expect(screen.getByText('10 other routes')).toBeInTheDocument(); // 12 distinct, 2 shown
    expect(screen.getByText('27%')).toBeInTheDocument(); // the 100 - 55 - 18 runs they account for
  });

  it('hides routes that do not contain the selected epic', () => {
    renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Payments API/ }));

    expect(screen.getByText('Identity service → Checkout rewrite → Payments API')).toBeInTheDocument();
    // Hidden outright rather than dimmed — PAYMENTS is not on the FRAUD route.
    expect(screen.queryByText('Identity service → Checkout rewrite → Fraud checks')).not.toBeInTheDocument();
  });

  it('drops its own selection when another report changes the highlight', () => {
    const { setHighlightFromElsewhere } = renderReport();

    fireEvent.click(screen.getByRole('button', { name: /Payments API/ }));
    expect(screen.queryByText('Identity service → Checkout rewrite → Fraud checks')).not.toBeInTheDocument();

    setHighlightFromElsewhere(new Set(['SELLER', 'SEARCH']));

    // The grid no longer shows this report's chain, so it stops filtering to it.
    expect(screen.getByText('Identity service → Checkout rewrite → Fraud checks')).toBeInTheDocument();
  });
});
