import type { AllTeamData } from './services/team-configuration';

import { describe, expect, it } from 'vitest';

import { resetLevel, resetTeam } from './useResetTeamSettings';

const allTeamData = (): AllTeamData =>
  ({
    __GLOBAL__: { defaults: { velocityPerSprint: 30 } },
    Grouper: { defaults: { tracks: 2 }, '1': { velocityPerSprint: 40, tracks: 3 } },
    Pay: { defaults: { tracks: 4 } },
  }) as unknown as AllTeamData;

describe('resetLevel', () => {
  it("drops only that level of that team's settings", () => {
    expect(resetLevel(allTeamData(), 'Grouper', '1')).toEqual({
      __GLOBAL__: { defaults: { velocityPerSprint: 30 } },
      Grouper: { defaults: { tracks: 2 } },
      Pay: { defaults: { tracks: 4 } },
    });
  });

  it('drops the team once its last level is reset', () => {
    expect(resetLevel(allTeamData(), 'Pay', 'defaults')).not.toHaveProperty('Pay');
  });
});

describe('resetTeam', () => {
  it('drops every level of that team and leaves the others', () => {
    expect(resetTeam(allTeamData(), 'Grouper')).toEqual({
      __GLOBAL__: { defaults: { velocityPerSprint: 30 } },
      Pay: { defaults: { tracks: 4 } },
    });
  });
});
