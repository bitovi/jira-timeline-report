import type { AllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const saveConfigs: Array<{ onUpdate?: (config: unknown) => void } | undefined> = [];

const savedUserAllTeamData = {
  __GLOBAL__: { defaults: { estimateField: 'Story points' } },
  ORDER: { defaults: { sprintLength: 10, velocityPerSprint: 21, tracks: 1, estimateField: 'Story points' } },
  STORE: { defaults: { sprintLength: 10 }, '7': { velocityPerSprint: 55, tracks: 4, estimateField: 'Days estimate' } },
};

// Only the two data hooks are mocked. `createEmptyConfiguration` and `sanitizeAllTeamData` stay real so
// the assertions cover the payload that would actually reach storage.
vi.mock(
  '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration',
  async () => {
    const shared = await vi.importActual<
      typeof import('../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/shared')
    >(
      '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/shared',
    );

    return {
      ...shared,
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

const Probe = ({ team, onSuccess }: { team: string; onSuccess?: () => void }) => {
  const { commit } = useTeamCommit();
  return <button onClick={() => commit(team, { velocityPerSprint: 35, tracks: 2 }, { onSuccess })}>commit</button>;
};

const renderProbe = (team = 'ORDER', props: { onSuccess?: () => void; onTeamDataSaved?: () => void } = {}) =>
  render(
    <CapacityOverridesProvider onTeamDataSaved={props.onTeamDataSaved}>
      <Suspense fallback="loading">
        <Probe team={team} onSuccess={props.onSuccess} />
      </Suspense>
    </CapacityOverridesProvider>,
  );

const savedPayload = () => save.mock.calls[0][0] as AllTeamData;
const saveOptions = () => save.mock.calls[0][1] as { onSuccess?: () => void };

beforeEach(() => {
  save.mockClear();
  saveConfigs.length = 0;
});

describe('useTeamCommit', () => {
  it("writes the new values to the named team's defaults", async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual(expect.objectContaining({ velocityPerSprint: 35, tracks: 2 }));
  });

  it('merges the new values onto the configuration the team already had saved', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual({
      sprintLength: 10,
      estimateField: 'Story points',
      velocityPerSprint: 35,
      tracks: 2,
    });
  });

  it('falls back to an empty configuration for a team with nothing saved', async () => {
    renderProbe('MARKETING');
    await userEvent.click(screen.getByText('commit'));

    // The empty configuration is all nulls, and `sanitizeAllTeamData` strips those.
    expect(savedPayload().MARKETING?.defaults).toEqual({ velocityPerSprint: 35, tracks: 2 });
  });

  it('leaves every other team untouched', async () => {
    renderProbe('MARKETING');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual(savedUserAllTeamData.ORDER.defaults);
  });

  it('drops level-specific values that would out-rank the committed defaults', async () => {
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().STORE?.defaults).toEqual({ sprintLength: 10, velocityPerSprint: 35, tracks: 2 });
    expect(savedPayload().STORE?.['7']).toEqual({ estimateField: 'Days estimate' });
  });

  it("hands the mutation the provider's save-completed handler", () => {
    const onTeamDataSaved = vi.fn();
    renderProbe('ORDER', { onTeamDataSaved });

    expect(saveConfigs.at(-1)?.onUpdate).toBe(onTeamDataSaved);
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
