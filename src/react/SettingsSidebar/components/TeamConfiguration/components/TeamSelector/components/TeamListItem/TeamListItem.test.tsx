import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, vi, beforeEach } from 'vitest';

import TeamListItem from './TeamListItem';

describe('<TeamListItem />', () => {
  const mockSetSelectedTeam = vi.fn();

  const defaultProps = {
    team: { name: 'Team Alpha', status: 'reportOnly' as const },
    selectedTeam: 'global',
    setSelectedTeam: mockSetSelectedTeam,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders without crashing', () => {
    render(<TeamListItem {...defaultProps} />);

    expect(screen.getByText(defaultProps.team.name)).toBeInTheDocument();
  });

  it.each(['reportOnly', 'storageOnly'] as const)('marks no dot on a %s team', (status) => {
    render(<TeamListItem {...defaultProps} team={{ ...defaultProps.team, status }} />);

    expect(screen.queryByText('Has custom settings')).not.toBeInTheDocument();
  });

  it('marks a team in the report with saved settings with a dot', () => {
    render(<TeamListItem {...defaultProps} team={{ ...defaultProps.team, status: 'storageAndReport' }} />);

    expect(screen.getByText('Has custom settings')).toBeInTheDocument();
  });

  it('calls setSelectedTeam when the item is clicked', async () => {
    render(<TeamListItem {...defaultProps} />);

    const button = screen.getByText(defaultProps.team.name);
    await userEvent.click(button);

    expect(mockSetSelectedTeam).toHaveBeenCalledWith(defaultProps.team.name);
  });
});
