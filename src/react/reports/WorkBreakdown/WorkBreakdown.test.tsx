import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import type { FilterRow } from '../../../jira/rollup/filter-rows/filter-rows';
import { WorkBreakdown } from './WorkBreakdown';
import { primaryIssues, allIssues, planningIssues } from './fixtures';

const obs = <T,>(value: T): CanObservable<T> =>
  ({
    value,
    getData: () => value,
    get: () => value,
    set: () => undefined,
    on: () => undefined,
    off: () => undefined,
  }) as unknown as CanObservable<T>;

const renderReport = (
  overrides: Partial<{
    primary: IssueOrRelease[];
    all: IssueOrRelease[];
    planning: IssueOrRelease[];
    secondaryReportType: string;
    filterRows: FilterRow[];
    onIssueClick: (event: React.MouseEvent, issue: IssueOrRelease) => void;
  }> = {},
) => {
  const {
    primary = primaryIssues,
    all = allIssues,
    planning = [],
    secondaryReportType = 'breakdown',
    filterRows = [],
    onIssueClick,
  } = overrides;
  return render(
    <WorkBreakdown
      primaryIssuesOrReleasesObs={obs(primary)}
      allIssuesOrReleasesObs={obs(all)}
      planningIssuesObs={obs(planning)}
      secondaryReportTypeObs={obs(secondaryReportType)}
      filterRowsObs={obs(filterRows)}
      onIssueClick={onIssueClick}
    />,
  );
};

describe('WorkBreakdown', () => {
  test('breakdown mode renders a matrix card per primary issue', () => {
    renderReport({ secondaryReportType: 'breakdown' });
    expect(screen.getByText('100 Stores')).toBeTruthy();
    expect(screen.getByText('Outcome A')).toBeTruthy();
    // Work-type header letters are present in breakdown mode.
    expect(screen.getAllByText('d').length).toBeGreaterThan(0);
  });

  test('status mode renders a Target Delivery column per card and no matrix letters', () => {
    renderReport({ secondaryReportType: 'status' });
    expect(screen.getAllByText('Target Delivery').length).toBe(primaryIssues.length);
    expect(screen.queryByText('Q')).toBeNull();
  });

  test('header bubbles use the card rollup status color', () => {
    renderReport({ secondaryReportType: 'breakdown' });
    expect(screen.getByText('100 Stores').className).toContain('color-text-and-bg-ontrack');
    expect(screen.getByText('Digital Channel sales - 5% increase').className).toContain('color-text-and-bg-behind');
  });

  test('renders a Planning fallback card when planning issues are present', () => {
    renderReport({ planning: planningIssues });
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.getByText('Future initiative')).toBeTruthy();
  });

  test('shows an empty state when there are no issues', () => {
    renderReport({ primary: [], all: [], planning: [] });
    expect(screen.getByText('Unable to find any issues.')).toBeTruthy();
  });

  test('shows a distinct empty state when a filter removes everything', () => {
    renderReport({
      filterRows: [{ id: 'r1', field: 'rollupStatus', operator: 'is', value: ['no-such-status'] }],
    });
    expect(screen.getByText('Nothing matches the current filters.')).toBeTruthy();
    expect(screen.queryByText('Unable to find any issues.')).toBeNull();
  });

  test('clicking a card header invokes onIssueClick', () => {
    const onIssueClick = vi.fn();
    renderReport({ onIssueClick });
    fireEvent.click(screen.getByText('Outcome A'));
    expect(onIssueClick.mock.calls[0][1].summary).toBe('Outcome A');
  });

  test('clicking a card header opens the issue popup, and the close button closes it', () => {
    renderReport();
    expect(screen.queryByLabelText('Close')).toBeNull();

    fireEvent.click(screen.getByText('Outcome A'));
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.getAllByText('Outcome A').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByLabelText('Close')).toBeNull();
  });
});
