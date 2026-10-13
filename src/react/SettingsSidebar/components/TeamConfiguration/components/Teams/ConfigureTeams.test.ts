import { describe, expect, it } from 'vitest';

import { createEmptyConfiguration } from './services/team-configuration';
import { levelHasSavedSettings } from './ConfigureTeams';

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
