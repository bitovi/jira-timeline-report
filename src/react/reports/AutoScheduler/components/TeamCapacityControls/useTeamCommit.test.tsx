import type { AllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();

const savedUserAllTeamData = {
  __GLOBAL__: { defaults: { estimateField: 'Story points' } },
  ORDER: { defaults: { sprintLength: 10, velocityPerSprint: 21, tracks: 1, estimateField: 'Story points' } },
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
      useSaveAllTeamData: () => ({ save: (updates: AllTeamData) => save(updates), isSaving: false }),
    };
  },
);

vi.mock('../../../../services/jira', () => ({ useJiraIssueFields: () => [] }));

import { useTeamCommit } from './useTeamCommit';

const Probe = ({ team }: { team: string }) => {
  const { commit } = useTeamCommit();
  return <button onClick={() => commit(team, { velocityPerSprint: 35, tracks: 2 })}>commit</button>;
};

const renderProbe = (team = 'ORDER') =>
  render(
    <Suspense fallback="loading">
      <Probe team={team} />
    </Suspense>,
  );

const savedPayload = () => save.mock.calls[0][0] as AllTeamData;

beforeEach(() => {
  save.mockClear();
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
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    // The empty configuration is all nulls, and `sanitizeAllTeamData` strips those.
    expect(savedPayload().STORE?.defaults).toEqual({ velocityPerSprint: 35, tracks: 2 });
  });

  it('leaves every other team untouched', async () => {
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    expect(savedPayload().ORDER?.defaults).toEqual(savedUserAllTeamData.ORDER.defaults);
  });
});
