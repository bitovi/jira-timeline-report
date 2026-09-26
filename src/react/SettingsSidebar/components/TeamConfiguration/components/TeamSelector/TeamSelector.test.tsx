import type { TeamSelectorProps } from './TeamSelector';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import TeamSelector from './TeamSelector';

const observableOf = (teamNames: string[]) =>
  ({
    value: teamNames.map((name) => ({ team: { name } })),
    on: vi.fn(),
    off: vi.fn(),
  }) as unknown as TeamSelectorProps['derivedIssuesObservable'];

const renderSelector = (inReport: string[], outsideReport: string[]) =>
  render(
    <TeamSelector
      teamsFromStorage={outsideReport}
      selectedTeam="global"
      setSelectedTeam={vi.fn()}
      derivedIssuesObservable={observableOf(inReport)}
    />,
  );

describe('<TeamSelector />', () => {
  it('always shows the search field', () => {
    renderSelector(['Alpha'], []);

    expect(screen.getByRole('textbox', { name: 'Find a team' })).toBeInTheDocument();
  });

  it('shows the empty state inside the in-report section when the report has no teams', () => {
    renderSelector([], []);

    expect(screen.getByText('TEAMS IN REPORT')).toBeInTheDocument();
    expect(screen.getByText(/No teams found/)).toBeInTheDocument();
  });

  it('filters both sections and hides a section with no matches', async () => {
    renderSelector(['Alpha', 'Bravo'], ['Alpine', 'Charlie']);

    await userEvent.type(screen.getByRole('textbox'), 'alp');

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Alpine')).toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'char');

    expect(screen.queryByText('TEAMS IN REPORT')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('opens a collapsed section while searching', async () => {
    renderSelector(['Alpha'], []);

    await userEvent.click(screen.getByText('TEAMS IN REPORT'));
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'alp');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('says so when nothing matches in either section', async () => {
    renderSelector(['Alpha'], ['Bravo']);

    await userEvent.type(screen.getByRole('textbox'), 'zzz');

    expect(screen.getByText('No teams match "zzz"')).toBeInTheDocument();
    expect(screen.queryByText('TEAMS IN REPORT')).not.toBeInTheDocument();
    expect(screen.queryByText('TEAMS OUTSIDE REPORT')).not.toBeInTheDocument();
  });
});
