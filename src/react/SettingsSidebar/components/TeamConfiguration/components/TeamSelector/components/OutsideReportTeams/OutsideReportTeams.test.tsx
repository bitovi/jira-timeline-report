import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import OutsideReportTeams from './OutsideReportTeams';

const makeTeams = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Team ${String(i + 1).padStart(2, '0')}`,
    status: 'storageOnly' as const,
  }));

const renderTeams = (count: number, isFiltered = false) =>
  render(
    <OutsideReportTeams
      teams={makeTeams(count)}
      isFiltered={isFiltered}
      selectedTeam="global"
      setSelectedTeam={vi.fn()}
      pageSize={5}
    />,
  );

describe('<OutsideReportTeams />', () => {
  it('shows every team with no load more when at or under the page size', () => {
    renderTeams(5);

    expect(screen.getAllByText(/^Team \d+$/)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows one page, then the next on each load more, until all are shown', async () => {
    renderTeams(12);

    expect(screen.getAllByText(/^Team \d+$/)).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getAllByText(/^Team \d+$/)).toHaveLength(10);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(screen.getAllByText(/^Team \d+$/)).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('caps filtered results at the page size with no load more', () => {
    renderTeams(12, true);

    expect(screen.getAllByText(/^Team \d+$/)).toHaveLength(5);
    expect(screen.getByText(/Showing 5 of 12 matches/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
