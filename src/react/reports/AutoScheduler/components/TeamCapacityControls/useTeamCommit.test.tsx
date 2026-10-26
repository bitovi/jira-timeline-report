import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type { AllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const saveConfigs: Array<{ onUpdate?: (config: unknown) => void } | undefined> = [];

const globalDefaults = { estimateField: 'Story points', velocityPerSprint: 13, tracks: 3 };

const savedUserAllTeamData = {
  __GLOBAL__: { defaults: globalDefaults as Record<string, unknown> },
  ORDER: {
    defaults: { sprintLength: 10, velocityPerSprint: 21, tracks: 1, estimateField: 'Story points' },
    '9': { velocityPerSprint: 99, tracks: 9 },
  },
  STORE: { defaults: { sprintLength: 10 }, '7': { velocityPerSprint: 55, tracks: 4, estimateField: 'Days estimate' } },
  SPLIT: { defaults: { sprintLength: 10, tracks: 2 }, '7': { velocityPerSprint: 55 } },
  // spec/042: Dev Days' X is always 1, so a headcount commit writes the headcount alone.
  DEVS: { defaults: { estimateUnit: 'devDays', teamMembers: 4 }, '7': { teamMembers: 6 } },
  DEVS_DEFAULTS: { defaults: { estimateUnit: 'devDays', teamMembers: 4 } },
  // Entered a headcount, but X is still derived: 20 / (10 days × 4 people) = 0.5.
  DERIVED: { defaults: { teamMembers: 4, velocityPerSprint: 20, sprintLength: 10 } },
  // X already saved.
  STORED: { defaults: { pointsPerPersonDay: 0.3, teamMembers: 10 } },
  // Inherits a saved X from __GLOBAL__, with a headcount of its own.
  INHERITS_X: { defaults: { teamMembers: 10 } },
  // The scheduled level redefines the unit, so X belongs there.
  UNIT: { defaults: { teamMembers: 10 }, '7': { estimateUnit: 'teamWeeks' } },
};

// Only the two data hooks are mocked. Everything else (`createEmptyConfiguration`, the inheritance
// helpers, `sanitizeAllTeamData`) stays real so the assertions cover the payload that would reach storage.
vi.mock(
  '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration',
  async () => {
    const actual = await vi.importActual<
      typeof import('../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration')
    >('../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration');

    return {
      ...actual,
      useAllTeamData: () => ({ savedUserAllTeamData }),
      useSaveAllTeamData: (config?: { onUpdate?: (config: unknown) => void }) => {
        saveConfigs.push(config);
        return { save, isSaving: false };
      },
    };
  },
);

vi.mock('../../../../services/jira', () => ({ useJiraIssueFields: () => [] }));

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { useTeamCommit } from './useTeamCommit';

const Probe = ({
  team,
  hierarchyLevel,
  onSuccess,
  values = { pointsPerPersonDay: 0.35, tracks: 2 },
}: {
  team: string;
  hierarchyLevel?: number;
  onSuccess?: () => void;
  values?: TeamCapacityOverride;
}) => {
  const { commit } = useTeamCommit();
  return <button onClick={() => commit(team, hierarchyLevel ?? 7, values, { onSuccess })}>commit</button>;
};

const renderProbe = (
  team = 'ORDER',
  props: {
    hierarchyLevel?: number;
    onSuccess?: () => void;
    onTeamDataSaved?: () => void;
    values?: TeamCapacityOverride;
  } = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CapacityOverridesProvider onTeamDataSaved={props.onTeamDataSaved}>
        <Suspense fallback="loading">
          <Probe team={team} hierarchyLevel={props.hierarchyLevel} onSuccess={props.onSuccess} values={props.values} />
        </Suspense>
      </CapacityOverridesProvider>
    </QueryClientProvider>,
  );

const savedPayload = () => save.mock.calls[0][0] as AllTeamData;
const saveOptions = () => save.mock.calls[0][1] as { onSuccess?: () => void; onSettled?: () => void };

/** What `useSaveAllTeamData` hands back through `onUpdate` once a write settles — saved or not. */
const settleWith = (config: unknown) => saveConfigs.at(-1)?.onUpdate?.(config);

beforeEach(() => {
  save.mockClear();
  savedUserAllTeamData.__GLOBAL__.defaults = globalDefaults;
  saveConfigs.length = 0;
});

describe('useTeamCommit', () => {
  it("writes the new values to the named team's defaults when it has none of its own at that level", async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual(expect.objectContaining({ pointsPerPersonDay: 0.35, tracks: 2 }));
  });

  it('merges the new values onto the configuration the team already had saved', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual({
      sprintLength: 10,
      estimateField: 'Story points',
      velocityPerSprint: 21,
      // A legacy velocity with no saved unit: the committed X takes the unit it is read in.
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.35,
      tracks: 2,
    });
  });

  it('falls back to an empty configuration for a team with nothing saved', async () => {
    renderProbe('MARKETING');
    await userEvent.click(screen.getByText('commit'));

    // The empty configuration is all nulls, and `sanitizeAllTeamData` strips those. X takes its unit along.
    expect(savedPayload().MARKETING?.defaults).toEqual({
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.35,
      tracks: 2,
    });
  });

  it('leaves __GLOBAL__ untouched when the team was inheriting its capacity from there', async () => {
    renderProbe('MARKETING');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().__GLOBAL__).toEqual(savedUserAllTeamData.__GLOBAL__);
  });

  it('leaves every other team untouched', async () => {
    renderProbe('MARKETING');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual(savedUserAllTeamData.ORDER.defaults);
  });

  it('writes to the scheduled hierarchy level when the team has its own values there', async () => {
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().STORE?.['7']).toEqual({
      velocityPerSprint: 55,
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.35,
      tracks: 2,
      estimateField: 'Days estimate',
    });
  });

  it("leaves the team's defaults alone when the scheduled level is the target", async () => {
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().STORE?.defaults).toEqual(savedUserAllTeamData.STORE.defaults);
  });

  it('sends each field to the level that field is actually resolved from', async () => {
    renderProbe('SPLIT');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().SPLIT?.['7']).toEqual({
      velocityPerSprint: 55,
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.35,
    });
    expect(savedPayload().SPLIT?.defaults).toEqual({ sprintLength: 10, tracks: 2 });
  });

  it('commits team members to the level that already holds them', async () => {
    renderProbe('DEVS', { values: { teamMembers: 9 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().DEVS?.['7']).toEqual({ teamMembers: 9 });
    expect(savedPayload().DEVS?.defaults).toEqual(savedUserAllTeamData.DEVS.defaults);
  });

  it("commits team members to the team's defaults when the scheduled level has none", async () => {
    renderProbe('DEVS_DEFAULTS', { values: { teamMembers: 9 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().DEVS_DEFAULTS?.defaults).toEqual({ estimateUnit: 'devDays', teamMembers: 9 });
    expect(savedPayload().DEVS_DEFAULTS?.['7']).toBeUndefined();
  });

  it('pins X when a headcount is committed while X is still derived', async () => {
    renderProbe('DERIVED', { values: { teamMembers: 8 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().DERIVED?.defaults).toEqual({
      teamMembers: 8,
      velocityPerSprint: 20,
      sprintLength: 10,
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.5,
    });
  });

  it('pins the current X when a team that never entered a headcount commits one, so capacity scales', async () => {
    // Global 13 points per 10-day sprint against the default 5 people: X = 0.26. The AutoScheduler
    // never re-anchors, so 10 developers double the team's capacity.
    renderProbe('MARKETING', { values: { teamMembers: 10 } });
    await userEvent.click(screen.getByText('commit'));

    const defaults = savedPayload().MARKETING?.defaults;
    expect(defaults?.teamMembers).toBe(10);
    expect(defaults?.pointsPerPersonDay).toBeCloseTo(0.26);
  });

  it('writes only the headcount when X is already saved', async () => {
    renderProbe('STORED', { values: { teamMembers: 11 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().STORED?.defaults).toEqual({ pointsPerPersonDay: 0.3, teamMembers: 11 });
  });

  it('takes over an inherited X on Story Points, so the changed velocity never reads as inherited', async () => {
    savedUserAllTeamData.__GLOBAL__.defaults = { ...globalDefaults, pointsPerPersonDay: 0.2 };
    renderProbe('INHERITS_X', { values: { teamMembers: 11 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().INHERITS_X?.defaults).toEqual({
      estimateUnit: 'storyPoints',
      pointsPerPersonDay: 0.2,
      teamMembers: 11,
    });
    expect(savedPayload().__GLOBAL__?.defaults?.pointsPerPersonDay).toBe(0.2);
  });

  it('keeps an X the override already carries instead of pinning another', async () => {
    renderProbe('DERIVED', { values: { teamMembers: 8, pointsPerPersonDay: 0.25 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().DERIVED?.defaults?.pointsPerPersonDay).toBe(0.25);
  });

  it('commits X to the scheduled level when that level defines the unit, and headcount where it is held', async () => {
    renderProbe('UNIT', { values: { pointsPerPersonDay: 0.05, teamMembers: 12 } });
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().UNIT?.['7']).toEqual({ estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.05 });
    expect(savedPayload().UNIT?.defaults).toEqual({ teamMembers: 12 });
  });

  it('never removes a value at a level it is not targeting', async () => {
    renderProbe('ORDER');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.['9']).toEqual(savedUserAllTeamData.ORDER['9']);
  });

  it("refreshes the shell's base configuration once the write succeeds", async () => {
    const onTeamDataSaved = vi.fn();
    renderProbe('ORDER', { onTeamDataSaved });
    await userEvent.click(screen.getByText('commit'));

    const config = { getVelocity: () => 35 };
    settleWith(config);

    expect(onTeamDataSaved).not.toHaveBeenCalled();

    saveOptions().onSuccess?.();

    expect(onTeamDataSaved).toHaveBeenCalledWith(config);
  });

  // `onUpdate` fires from `onSettled`, so it also delivers the configuration of a rejected write.
  // Letting that reach the shell leaves a value storage never accepted as the base a later Reset
  // falls back to — the row goes clean while the failed capacity stays in the plan.
  it("leaves the shell's base configuration alone when the write fails", async () => {
    const onTeamDataSaved = vi.fn();
    renderProbe('ORDER', { onTeamDataSaved });
    await userEvent.click(screen.getByText('commit'));

    settleWith({ getVelocity: () => 35 });
    saveOptions().onSettled?.();

    expect(onTeamDataSaved).not.toHaveBeenCalled();
  });

  it("runs the caller's onSuccess through the mutation rather than in the same tick", async () => {
    const onSuccess = vi.fn();
    renderProbe('ORDER', { onSuccess });
    await userEvent.click(screen.getByText('commit'));

    expect(onSuccess).not.toHaveBeenCalled();

    saveOptions().onSuccess?.();

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
