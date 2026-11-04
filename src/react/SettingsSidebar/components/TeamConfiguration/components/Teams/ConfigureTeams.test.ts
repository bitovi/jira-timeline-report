import type { TeamConfiguration } from './services/team-configuration';

import { describe, expect, it } from 'vitest';

import { createEmptyConfiguration } from './services/team-configuration';
import { levelHasSavedSettings, tabLevels } from './ConfigureTeams';

describe('levelHasSavedSettings', () => {
  it('is false for a level that was never saved', () => {
    expect(levelHasSavedSettings(undefined)).toBe(false);
  });

  it('is false for the empty placeholder an unsaved team gets', () => {
    expect(levelHasSavedSettings(createEmptyConfiguration())).toBe(false);
  });

  it('is true once any field is saved, including false', () => {
    expect(levelHasSavedSettings({ ...createEmptyConfiguration(), tracks: 2 })).toBe(true);
    expect(levelHasSavedSettings({ ...createEmptyConfiguration(), spreadEffortAcrossDates: false })).toBe(true);
  });
});

const levels = (...keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, {}])) as unknown as Partial<TeamConfiguration>;

describe('tabLevels', () => {
  it('puts defaults first, then highest level to lowest, ending at Story', () => {
    expect(tabLevels(levels('0', '2', 'defaults', '1', '3'))).toEqual(['defaults', '3', '2', '1', '0']);
  });

  it('leaves out sub-task levels below 0', () => {
    expect(tabLevels(levels('defaults', '0', '-1', '1'))).toEqual(['defaults', '1', '0']);
  });
});
