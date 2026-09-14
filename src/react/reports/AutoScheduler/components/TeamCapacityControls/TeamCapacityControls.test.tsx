import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn();
vi.mock('./useTeamCommit', () => ({ useTeamCommit: () => ({ commit, isSaving: false }) }));

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { TeamCapacityInputs } from './TeamCapacityControls';

const renderInputs = () =>
  render(
    <CapacityOverridesProvider>
      <TeamCapacityInputs teamName="ORDER" savedVelocityPerSprint={21} savedTracks={1} />
    </CapacityOverridesProvider>,
  );

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

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '35{Enter}');

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

  it('sends the overridden values to the commit hook', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', { tracks: 2 });
  });

  it('clears the override after a commit, so the row stops reading as dirty', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });
});
