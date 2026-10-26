import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn();
let isSaving = false;
let isBlocked = false;
vi.mock('./useTeamCommit', () => ({ useTeamCommit: () => ({ commit, isSaving, isBlocked }) }));

// `useTeamSettings` stays real so the row resolves the Estimate Field's name the way the report does;
// only its two data hooks are stubbed.
let jiraFields: Array<{ id: string; name: string }> = [];
let savedUserAllTeamData: Record<string, unknown> = {};
vi.mock('../../../../services/jira', () => ({ useJiraIssueFields: () => jiraFields }));
vi.mock(
  '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration')
    >('../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration');

    return { ...actual, useAllTeamData: () => ({ savedUserAllTeamData }) };
  },
);

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { peoplePerTrack, TeamCapacityInputs, TeamCapacityOutputs } from './TeamCapacityControls';
import { itemLabelFor } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

type InputsProps = Partial<React.ComponentProps<typeof TeamCapacityInputs>>;

// Story Points, 21 per 10-day sprint with 10 developers: X = 0.21.
const inputs = (props: InputsProps = {}) => (
  <CapacityOverridesProvider>
    <TeamCapacityInputs
      teamName="ORDER"
      hierarchyLevel={7}
      periodDays={10}
      savedPointsPerPersonDay={0.21}
      savedTeamMembers={10}
      savedTracks={1}
      {...props}
    />
  </CapacityOverridesProvider>
);

const renderInputs = (props: InputsProps = {}) => render(inputs(props));

/** The `onSuccess` the row hands the commit hook, which only a successful save is meant to run. */
const commitSucceeds = () => act(() => commit.mock.calls[0][3].onSuccess());

const editInline = async (button: RegExp, next: string) => {
  await userEvent.click(screen.getByRole('button', { name: button }));
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), `${next}{Enter}`);
};

const setCapacity = (next: string) => editInline(/Story Points per sprint/i, next);
const setDevelopers = (next: string) => editInline(/^Developers,/, next);

/** A readout's text with its spans run together, e.g. "0.04 / day (person)". */
const readout = (testId: 'per-developer' | 'per-team') => screen.getByTestId(testId).textContent;

const addTrack = () => userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));

beforeEach(() => {
  commit.mockClear();
  isSaving = false;
  isBlocked = false;
  // An id-valued estimate field, as a name collision stores it (spec/015-field-selection).
  jiraFields = [{ id: 'customfield_10016', name: 'Story Points' }];
  savedUserAllTeamData = {
    __GLOBAL__: { defaults: {} },
    ORDER: { defaults: { estimateField: 'customfield_10016', teamMembers: 10 } },
  };
});

describe('TeamCapacityInputs', () => {
  it('shows the saved values with no commit controls at rest', () => {
    renderInputs();

    expect(screen.getByRole('button', { name: /21 Story Points per sprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Developers, 10 developers/ })).toBeInTheDocument();
    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('reveals Reset and Commit once tracks change', async () => {
    renderInputs();

    await addTrack();

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('reveals Reset and Commit once capacity changes', async () => {
    renderInputs();

    await setCapacity('35');

    expect(screen.getByRole('button', { name: /35 Story Points per sprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('puts the saved values back on Reset', async () => {
    renderInputs();

    await addTrack();
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('goes clean again when a value is edited back to what is saved', async () => {
    renderInputs();

    await setCapacity('35');
    await setCapacity('21');

    expect(screen.getByRole('button', { name: /21 Story Points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('keeps the other field overridden when one is edited back to what is saved', async () => {
    renderInputs();

    await addTrack();
    await setCapacity('35');
    await setCapacity('21');

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('sends the overridden values to the commit hook', async () => {
    renderInputs();

    await addTrack();
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', 7, { tracks: 2 }, expect.anything());
  });

  it('keeps the override until the commit succeeds', async () => {
    renderInputs();

    await addTrack();
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('clears the override once the commit succeeds, so the row stops reading as dirty', async () => {
    renderInputs();

    await addTrack();
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));
    commitSucceeds();

    expect(await screen.findByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  // The commit captures its values at click time, so an edit landing before the write returns would
  // be thrown away by the success handler with no sign it ever existed.
  describe('while the commit is in flight', () => {
    const startCommit = async () => {
      const { rerender } = renderInputs();

      await addTrack();
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

      isSaving = true;
      rerender(inputs());
    };

    it('disables every control on the row', async () => {
      await startCommit();

      expect(screen.getByRole('button', { name: /work on one more work item in parallel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /work on one fewer work item in parallel/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    });

    it('refuses to open the capacity or headcount editor', async () => {
      await startCommit();

      await userEvent.click(screen.getByRole('button', { name: /Story Points per sprint/i }));
      await userEvent.click(screen.getByRole('button', { name: /^Developers,/ }));

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  // Every write replaces the whole team-data value from a render-time snapshot, so a second commit
  // overlapping the first would carry pre-first state and win.
  it('will not commit while another team is being saved, but stays editable', async () => {
    const { rerender } = renderInputs();

    await addTrack();

    isBlocked = true;
    rerender(inputs());

    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /work on one more work item in parallel/i })).toBeEnabled();
  });

  it('does not fall back to the overridden value when the pipeline has already re-derived', async () => {
    const { rerender } = renderInputs();

    await addTrack();
    await setCapacity('35');

    // What the derived pipeline reports once the override has been applied to it.
    rerender(inputs({ savedPointsPerPersonDay: 0.35, savedTracks: 2 }));

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: /21 Story Points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
  });

  it('keeps the saved baseline when the report re-derives and remounts the row', async () => {
    // A re-derive tears the whole grid down and rebuilds it, so the row loses any state of its own.
    const harness = (mounted: boolean, pointsPerPersonDay: number) => (
      <CapacityOverridesProvider>
        {mounted && (
          <TeamCapacityInputs
            teamName="ORDER"
            hierarchyLevel={7}
            periodDays={10}
            savedPointsPerPersonDay={pointsPerPersonDay}
            savedTeamMembers={10}
            savedTracks={1}
          />
        )}
      </CapacityOverridesProvider>
    );

    const { rerender } = render(harness(true, 0.21));

    await setCapacity('35');

    rerender(harness(false, 0.21));
    rerender(harness(true, 0.35));

    await setCapacity('21');

    expect(screen.getByRole('button', { name: /21 Story Points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });
});

// spec/040-update-team-estimation-settings/plan.md: capacity is X × N for every unit.
describe('TeamCapacityInputs headcount and readout', () => {
  it('names the scheduled level in the stepper', async () => {
    renderInputs({ itemLabel: itemLabelFor('Epic'), savedTracks: 2 });

    expect(screen.getByText('2 Epics in parallel')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /work on one fewer Epic in parallel/i }));

    expect(screen.getByText('1 Epic in parallel')).toBeInTheDocument();
  });

  it('labels every rate with the Estimate Field name, resolved from its id', () => {
    renderInputs();

    expect(readout('per-developer')).toBe('0.21Story Points / day (person)');
    expect(readout('per-team')).toBe('21Story Points / sprint (team)');
  });

  it('falls back to "estimates" with no Estimate Field', () => {
    savedUserAllTeamData = { __GLOBAL__: { defaults: {} }, ORDER: { defaults: { teamMembers: 10 } } };
    // Nothing matches the defaults' name-based lookup either.
    jiraFields = [];
    renderInputs();

    expect(readout('per-team')).toBe('21estimates / sprint (team)');
  });

  it('a Story Points edit of points per sprint overrides X at the current headcount', async () => {
    renderInputs();

    await setCapacity('35');
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    // 35 / (10 developers × 10 days)
    expect(commit).toHaveBeenCalledWith('ORDER', 7, { pointsPerPersonDay: 0.35 }, expect.anything());
    expect(readout('per-developer')).toBe('0.35Story Points / day (person)');
  });

  // Team Weeks, 5 people per estimate: X = 1 / (5 × 5) = 0.04.
  const teamWeeks: InputsProps = { estimateUnit: 'teamWeeks', savedPointsPerPersonDay: 0.04, savedTracks: 2 };

  it('10 → 11 developers raises the team total by 10% and leaves the per-developer rate alone', async () => {
    renderInputs(teamWeeks);

    expect(readout('per-developer')).toBe('0.04Story Points / day (person)');
    expect(readout('per-team')).toBe('0.4Story Points / day (team)');

    await setDevelopers('11');

    expect(readout('per-developer')).toBe('0.04Story Points / day (person)');
    expect(readout('per-team')).toBe('0.44Story Points / day (team)');
  });

  it('a headcount edit reads as uncommitted and leaves tracks alone', async () => {
    renderInputs(teamWeeks);

    await setDevelopers('11');

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  describe('committing a headcount on a team-time unit', () => {
    const steps = () => screen.getByTestId('headcount-commit-steps').textContent;

    it('lists the manual steps instead of saving', async () => {
      // Half of 10 developers: 5 people per estimate, X = 1 / (5 × 5) = 0.04. Half of 11 is 5.5.
      savedUserAllTeamData = {
        __GLOBAL__: { defaults: {} },
        ORDER: {
          defaults: {
            estimateField: 'customfield_10016',
            estimateUnit: 'teamWeeks',
            estimateTeamShare: 'half',
            teamMembers: 10,
          },
        },
      };
      renderInputs(teamWeeks);

      await setDevelopers('11');
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

      expect(commit).not.toHaveBeenCalled();
      expect(steps()).toContain('Make 11 developers your team size');
      expect(steps()).toContain('Your estimates assume half team: 5 people of 10 developers.');
      expect(steps()).toContain(
        'In Jira, multiply each Story Points estimate by 10 ÷ 11. For example, 3 becomes 2.73.',
      );
      expect(steps()).toContain('set the developers to 11. Estimates will then assume half team: 5.5 people.');
    });

    it('keeps the what-if on the row after the steps are dismissed', async () => {
      renderInputs(teamWeeks);

      await setDevelopers('11');
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

      expect(screen.queryByTestId('headcount-commit-steps')).not.toBeInTheDocument();
      expect(readout('per-team')).toBe('0.44Story Points / day (team)');
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });

    it('still saves a tracks-only change', async () => {
      renderInputs(teamWeeks);

      await addTrack();
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

      expect(commit).toHaveBeenCalledWith('ORDER', 7, { tracks: 3 }, expect.anything());
    });
  });

  it('accepts a decimal headcount', async () => {
    renderInputs({ estimateUnit: 'devDays', savedPointsPerPersonDay: 1 });

    await setDevelopers('5.5');

    expect(screen.getByRole('button', { name: /Developers, 5.5 developers/ })).toBeInTheDocument();
    expect(readout('per-team')).toBe('5.5Story Points / day (team)');
  });

  it.each([
    ['storyPoints', 0.21],
    ['devDays', 1],
  ] as const)('%s commits its developers directly', async (estimateUnit, savedPointsPerPersonDay) => {
    renderInputs({ estimateUnit, savedPointsPerPersonDay });

    await setDevelopers('11');
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', 7, { teamMembers: 11 }, expect.anything());
  });

  it.each([
    ['teamDays', 0.2],
    ['teamWeeks', 0.04],
    ['teamSprints', 0.02],
  ] as const)(
    '%s edits its developers, and Commit lists the manual steps',
    async (estimateUnit, savedPointsPerPersonDay) => {
      renderInputs({ estimateUnit, savedPointsPerPersonDay });

      await setDevelopers('11');
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

      expect(commit).not.toHaveBeenCalled();
      expect(screen.getByTestId('headcount-commit-steps')).toBeInTheDocument();
    },
  );

  it('Dev Days reads one per developer per day', () => {
    renderInputs({ estimateUnit: 'devDays', savedPointsPerPersonDay: 1 });

    expect(readout('per-developer')).toBe('1Story Point / day (person)');
    expect(readout('per-team')).toBe('10Story Points / day (team)');
  });

  it('Team Sprints reads per day for the person and the team', () => {
    renderInputs({ estimateUnit: 'teamSprints', savedPointsPerPersonDay: 0.02 });

    expect(readout('per-developer')).toBe('0.02Story Points / day (person)');
    expect(readout('per-team')).toBe('0.2Story Points / day (team)');
  });

  it('explains what one unit of the field means in the tooltip', async () => {
    renderInputs(teamWeeks);

    await userEvent.hover(screen.getByTestId('per-developer'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '1 Story Point = 1 week of work for 5 people (50% of the team)',
    );
  });

  it('the tooltip share follows an edited headcount, the people per estimate do not', async () => {
    renderInputs(teamWeeks);

    await setDevelopers('11');
    await userEvent.hover(screen.getByTestId('per-developer'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '1 Story Point = 1 week of work for 5 people (45% of the team)',
    );
  });

  it('a Story Points tooltip names the points per sprint and the headcount', async () => {
    renderInputs();

    await userEvent.hover(screen.getByTestId('per-developer'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '21 Story Points per 2-week sprint with 10 developers',
    );
  });

  describe('a team that never entered a headcount', () => {
    beforeEach(() => {
      savedUserAllTeamData = {
        __GLOBAL__: { defaults: {} },
        ORDER: {
          defaults: { estimateField: 'customfield_10016', estimateUnit: 'teamWeeks', estimateTeamShare: 'half' },
        },
      };
    });

    // Derived against the default 5: half of 5 people per estimate, X = 1 / (2.5 × 5) = 0.08.
    const unentered: InputsProps = { ...teamWeeks, savedPointsPerPersonDay: 0.08, savedTeamMembers: 5 };

    it('scales from the first edit: per-developer stays, the team grows', async () => {
      renderInputs(unentered);

      expect(readout('per-team')).toBe('0.4Story Points / day (team)');

      await setDevelopers('10');

      expect(readout('per-developer')).toBe('0.08Story Points / day (person)');
      expect(readout('per-team')).toBe('0.8Story Points / day (team)');
    });

    it('Commit lists the manual steps from the saved people per estimate', async () => {
      renderInputs(unentered);

      await setDevelopers('10');
      await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

      expect(commit).not.toHaveBeenCalled();
      expect(screen.getByTestId('headcount-commit-steps').textContent).toContain(
        'multiply each Story Points estimate by 5 ÷ 10. For example, 3 becomes 1.5.',
      );
    });

    it('never re-anchors Dev Days, whose X is always 1', async () => {
      renderInputs({ estimateUnit: 'devDays', savedPointsPerPersonDay: 1, savedTeamMembers: 5 });

      await setDevelopers('10');

      expect(readout('per-team')).toBe('10Story Points / day (team)');
    });
  });

  it('splits the headcount across the tracks, following the stepper', async () => {
    renderInputs({
      estimateUnit: 'teamSprints',
      savedPointsPerPersonDay: 0.02,
      savedTracks: 2,
      itemLabel: itemLabelFor('Epic'),
    });

    expect(screen.getByTestId('people-per-track')).toHaveTextContent('(5 people each)');

    await userEvent.click(screen.getByRole('button', { name: /work on one more Epic in parallel/i }));

    expect(screen.getByTestId('people-per-track')).toHaveTextContent('(3.3 people each)');
  });

  it('follows an edited headcount in the split', async () => {
    renderInputs({ estimateUnit: 'devDays', savedPointsPerPersonDay: 1, savedTeamMembers: 4, savedTracks: 4 });

    expect(screen.getByTestId('people-per-track')).toHaveTextContent('(1 person each)');

    await setDevelopers('8');

    expect(screen.getByTestId('people-per-track')).toHaveTextContent('(2 people each)');
  });
});

describe('TeamCapacityOutputs', () => {
  it('shows the total working days', () => {
    render(<TeamCapacityOutputs totalWorkingDays={34.4} />);

    expect(screen.getByText('Total working days')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
  });
});

describe('peoplePerTrack', () => {
  it.each([
    [10, 2, '5 people'],
    [10, 3, '3.3 people'],
    [4, 4, '1 person'],
    [1, 2, '0.5 people'],
  ])('%i members across %i tracks is %s', (members, tracks, expected) => {
    expect(peoplePerTrack(members, tracks)).toBe(expected);
  });
});
