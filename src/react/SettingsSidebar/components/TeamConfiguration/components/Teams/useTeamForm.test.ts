import type { Configuration, TeamConfiguration } from './services/team-configuration';

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();

vi.mock('./services/team-configuration', async () => {
  const actual = await vi.importActual<typeof import('./services/team-configuration')>('./services/team-configuration');

  return { ...actual, useSaveTeamData: () => ({ save, isSaving: false }) };
});

import { createEmptyConfiguration } from './services/team-configuration';
import { useTeamForm } from './useTeamForm';

const config = (fields: Partial<Configuration>): Configuration => ({ ...createEmptyConfiguration(), ...fields });

/** Order's defaults, saving `saved` and resolving to Story Points inherited from global. */
const renderForm = (saved: Partial<Configuration>) => {
  const savedUserTeamData = { defaults: config(saved) } as TeamConfiguration;
  const inheritedTeamData = { defaults: config({ estimateUnit: 'storyPoints', ...saved }) } as TeamConfiguration;

  return renderHook(() =>
    useTeamForm({
      teamName: 'ORDER',
      hierarchyLevel: 'defaults',
      savedUserTeamData,
      inheritedTeamData,
      getInheritance: () => inheritedTeamData,
    }),
  ).result.current;
};

beforeEach(() => save.mockClear());

describe('useTeamForm updateFields', () => {
  it('saves the resolved unit with an X the level saves for the first time', () => {
    // A Story Points sprint length edit on a team inheriting its unit and capacity.
    renderForm({}).updateFields({ sprintLength: 15, pointsPerPersonDay: 0.28 });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ sprintLength: 15, pointsPerPersonDay: 0.28, estimateUnit: 'storyPoints' }),
    );
  });

  it('leaves a unit the level already saves alone', () => {
    renderForm({ estimateUnit: 'devDays' }).updateFields({ pointsPerPersonDay: 1 });

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ estimateUnit: 'devDays', pointsPerPersonDay: 1 }));
  });

  it('adds no unit when the patch saves no X', () => {
    renderForm({}).updateFields({ teamMembers: 6 });

    expect(save.mock.calls[0][0].estimateUnit).toBeNull();
  });

  it('adds no unit when the patch clears X', () => {
    renderForm({ pointsPerPersonDay: 0.3 }).updateFields({ pointsPerPersonDay: null });

    expect(save.mock.calls[0][0].estimateUnit).toBeNull();
  });
});
