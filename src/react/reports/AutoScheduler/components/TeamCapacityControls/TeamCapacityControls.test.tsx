import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn();
vi.mock('./useTeamCommit', () => ({ useTeamCommit: () => ({ commit, isSaving: false }) }));

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { TeamCapacityInputs } from './TeamCapacityControls';

const renderInputs = (props: { savedVelocityPerSprint?: number; savedTracks?: number } = {}) =>
  render(
    <CapacityOverridesProvider>
      <TeamCapacityInputs
        teamName="ORDER"
        savedVelocityPerSprint={props.savedVelocityPerSprint ?? 21}
        savedTracks={props.savedTracks ?? 1}
      />
    </CapacityOverridesProvider>,
  );

/** The `onSuccess` the row hands the commit hook, which only a successful save is meant to run. */
const commitSucceeds = () => act(() => commit.mock.calls[0][2].onSuccess());

const setCapacity = async (next: string) => {
  await userEvent.click(screen.getByRole('button', { name: /points per sprint/i }));
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), `${next}{Enter}`);
};

beforeEach(() => commit.mockClear());

describe('TeamCapacityInputs', () => {
  it('shows the saved values with no commit controls at rest', () => {
    renderInputs();

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 track')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('reveals Reset and Commit once tracks change', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(screen.getByText('2 tracks')).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('1 track')).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await setCapacity('35');
    await setCapacity('21');

    expect(screen.getByText('2 tracks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('sends the overridden values to the commit hook', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', { tracks: 2 }, expect.anything());
  });

  it('keeps the override until the commit succeeds', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.getByText('2 tracks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('clears the override once the commit succeeds, so the row stops reading as dirty', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));
    commitSucceeds();

    expect(await screen.findByText('2 tracks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('does not fall back to the overridden value when the pipeline has already re-derived', async () => {
    const { rerender } = renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await setCapacity('35');

    // What the derived pipeline reports once the override has been applied to it.
    rerender(
      <CapacityOverridesProvider>
        <TeamCapacityInputs teamName="ORDER" savedVelocityPerSprint={35} savedTracks={2} />
      </CapacityOverridesProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 track')).toBeInTheDocument();
  });
});
