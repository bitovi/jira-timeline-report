import type { SimulationIssueResult } from './scheduler/stats-analyzer';

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { IssueSimulationDays, createColumnData } from './IssueSimulationDays';

describe('createColumnData', () => {
  it('scales to the largest column when nothing is capped', () => {
    const columns = createColumnData([0, 0, 1], 3, 'start');
    expect(columns.map((column) => column.percentValue)).toEqual([100, 50, 0]);
  });

  it('caps a column holding most runs and scales the rest to the next largest', () => {
    // Grid from day -3: 8 runs at day 0, a tail of 2 at -2 and 1 at -1.
    const values = [-2, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0];
    const columns = createColumnData(values, 4, 'start', -3, 0);

    expect(columns.map((column) => [column.day, column.percentValue, Boolean(column.capped)])).toEqual([
      [-3, 0, false],
      [-2, 100, false],
      [-1, 50, false],
      [0, 100, true],
    ]);
  });

  it('leaves a capped day alone when it does not hold most runs', () => {
    const columns = createColumnData([-1, -1, 0], 2, 'start', -1, 0);
    expect(columns.some((column) => column.capped)).toBe(false);
  });
});

describe('IssueSimulationDays', () => {
  const issue = (startDays: number[]) =>
    ({
      linkedIssue: { key: 'plan', summary: 'Overall timing' },
      startDays,
      dueDays: [],
    }) as unknown as SimulationIssueResult;

  it('draws the capped spike full height without a label', () => {
    render(
      <IssueSimulationDays
        issue={issue([-9, -2, -1, 0, 0, 0, 0, 0, 0, 0])}
        gridNumberOfDays={4}
        gridStartDay={-3}
        startOrDue="start"
        selectedStartDate={new Date(Date.UTC(2026, 0, 5))}
        capDay={0}
      />,
    );

    const bars = document.querySelectorAll<HTMLElement>('.bg-blue-100');
    expect(bars[bars.length - 1].style.height).toBe('100%');
    expect(screen.queryByText(/no early start needed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/start earlier than shown/)).not.toBeInTheDocument();
  });
});
