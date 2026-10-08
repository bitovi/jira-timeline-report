import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn();
let isSaving = false;
let isBlocked = false;
vi.mock('./useTeamCommit', () => ({ useTeamCommit: () => ({ commit, isSaving, isBlocked }) }));

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { TeamCapacityInputs, TeamCapacityOutputs } from './TeamCapacityControls';
import { itemLabelFor } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

const inputs = (props: { savedVelocityPerSprint?: number; savedTracks?: number } = {}) => (
  <CapacityOverridesProvider>
    <TeamCapacityInputs
      teamName="ORDER"
      hierarchyLevel={7}
      daysPerSprint={10}
      savedVelocityPerSprint={props.savedVelocityPerSprint ?? 21}
      savedTracks={props.savedTracks ?? 1}
    />
  </CapacityOverridesProvider>
);

const renderInputs = (props: { savedVelocityPerSprint?: number; savedTracks?: number } = {}) => render(inputs(props));

/** The `onSuccess` the row hands the commit hook, which only a successful save is meant to run. */
const commitSucceeds = () => act(() => commit.mock.calls[0][3].onSuccess());

const setCapacity = async (next: string) => {
  await userEvent.click(screen.getByRole('button', { name: /points per sprint/i }));
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), `${next}{Enter}`);
};

beforeEach(() => {
  commit.mockClear();
  isSaving = false;
  isBlocked = false;
});

describe('TeamCapacityInputs', () => {
  it('shows the saved values with no commit controls at rest', () => {
    renderInputs();

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('reveals Reset and Commit once tracks change', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('reveals Reset and Commit once capacity changes', async () => {
    renderInputs();

    await setCapacity('35');

    expect(screen.getByRole('button', { name: /35 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('puts the saved values back on Reset', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('goes clean again when a value is edited back to what is saved', async () => {
    renderInputs();

    await setCapacity('35');
    await setCapacity('21');

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('keeps the other field overridden when one is edited back to what is saved', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
    await setCapacity('35');
    await setCapacity('21');

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('sends the overridden values to the commit hook', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', 7, { tracks: 2 }, expect.anything());
  });

  it('keeps the override until the commit succeeds', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('2 work items in parallel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('clears the override once the commit succeeds, so the row stops reading as dirty', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
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

      await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
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

    it('refuses to open the capacity editor', async () => {
      await startCommit();

      await userEvent.click(screen.getByRole('button', { name: /points per sprint/i }));

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  // Every write replaces the whole team-data value from a render-time snapshot, so a second commit
  // overlapping the first would carry pre-first state and win.
  it('will not commit while another team is being saved, but stays editable', async () => {
    const { rerender } = renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));

    isBlocked = true;
    rerender(inputs());

    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /work on one more work item in parallel/i })).toBeEnabled();
  });

  it('does not fall back to the overridden value when the pipeline has already re-derived', async () => {
    const { rerender } = renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /work on one more work item in parallel/i }));
    await setCapacity('35');

    // What the derived pipeline reports once the override has been applied to it.
    rerender(
      <CapacityOverridesProvider>
        <TeamCapacityInputs
          teamName="ORDER"
          hierarchyLevel={7}
          daysPerSprint={10}
          savedVelocityPerSprint={35}
          savedTracks={2}
        />
      </CapacityOverridesProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 work item in parallel')).toBeInTheDocument();
  });

  it('keeps the saved baseline when the report re-derives and remounts the row', async () => {
    // A re-derive tears the whole grid down and rebuilds it, so the row loses any state of its own.
    const harness = (mounted: boolean, velocityPerSprint: number) => (
      <CapacityOverridesProvider>
        {mounted && (
          <TeamCapacityInputs
            teamName="ORDER"
            hierarchyLevel={7}
            daysPerSprint={10}
            savedVelocityPerSprint={velocityPerSprint}
            savedTracks={1}
          />
        )}
      </CapacityOverridesProvider>
    );

    const { rerender } = render(harness(true, 21));

    await setCapacity('35');

    rerender(harness(false, 21));
    rerender(harness(true, 35));

    await setCapacity('21');

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });
});

// spec/040-update-team-estimation-settings
describe("TeamCapacityInputs in the team's estimate unit", () => {
  const renderUnit = (props: Partial<React.ComponentProps<typeof TeamCapacityInputs>>) =>
    render(
      <CapacityOverridesProvider>
        <TeamCapacityInputs
          teamName="ORDER"
          hierarchyLevel={7}
          daysPerSprint={10}
          savedVelocityPerSprint={21}
          savedTracks={1}
          {...props}
        />
      </CapacityOverridesProvider>,
    );

  it('names the scheduled level in the stepper', async () => {
    renderUnit({ itemLabel: itemLabelFor('Epic'), savedTracks: 2 });

    expect(screen.getByText('2 Epics in parallel')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /work on one fewer Epic in parallel/i }));

    expect(screen.getByText('1 Epic in parallel')).toBeInTheDocument();
  });

  it('a Story Points team edits velocity per sprint', async () => {
    renderUnit({ estimateUnit: 'storyPoints' });

    expect(screen.getByText('points / sprint')).toBeInTheDocument();
    await setCapacity('35');
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', 7, { velocityPerSprint: 35 }, expect.anything());
  });

  it('a Dev Days team edits its dev days per day, which are its team members', async () => {
    // 5 members × 10-day sprint.
    renderUnit({ estimateUnit: 'devDays', savedVelocityPerSprint: 50 });

    expect(screen.getByText('dev days / day')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Capacity, 5 dev days per day/ }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '8{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', 7, { teamMembers: 8 }, expect.anything());
  });

  it('a Team Weeks team has no editable capacity', () => {
    // Half team, 10-day sprint: V = 10 / (5 × ½) = 4.
    renderUnit({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', savedVelocityPerSprint: 4 });

    expect(screen.getByText('half-team weeks / week')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Capacity,/ })).not.toBeInTheDocument();
  });

  it('a Team Working Days team shows its per-day capacity, read-only', () => {
    renderUnit({ estimateUnit: 'teamDays', estimateTeamShare: 'half', savedVelocityPerSprint: 20 });

    expect(screen.getByText('half-team days / day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Capacity,/ })).not.toBeInTheDocument();
  });
});

describe('TeamCapacityOutputs', () => {
  it('shows per-day capacity for a unit with a longer period', () => {
    render(<TeamCapacityOutputs velocity={20} daysPerSprint={10} totalWorkingDays={34} />);

    expect(screen.getByText('points / day')).toBeInTheDocument();
    expect(screen.getByText('Total working days')).toBeInTheDocument();
  });

  it('leaves per-day capacity to the inputs when the period already is a day', () => {
    render(<TeamCapacityOutputs velocity={50} daysPerSprint={10} estimateUnit="devDays" totalWorkingDays={34} />);

    expect(screen.queryByText('dev days / day')).not.toBeInTheDocument();
  });
});
