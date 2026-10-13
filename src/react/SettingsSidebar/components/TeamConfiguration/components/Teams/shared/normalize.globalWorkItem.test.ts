import { describe, it, expect } from 'vitest';
import { createNormalizeConfiguration } from './normalize';
import type { AllTeamData, Configuration } from '../services/team-configuration';
import { createEmptyConfiguration } from '../services/team-configuration';

// spec/039-global-defaults-workitems: teams missing from `allData` (never configured, or dropped by
// sanitizeAllTeamData) must still resolve the global per-work-item-type level.

const EPIC = 1;

const config = (overrides: Partial<Configuration>): Configuration => ({ ...createEmptyConfiguration(), ...overrides });

const issue = { fields: { 'Global default start': '2026-01-01', 'Global epic start': '2026-02-02' } } as never;

const forTeam = (teamKey: string | undefined, level = EPIC) =>
  ({ getTeamKey: () => teamKey, getHierarchyLevel: () => level }) as never;

describe('createNormalizeConfiguration global work item type fallback', () => {
  const allData = {
    __GLOBAL__: {
      defaults: config({ startDateField: 'Global default start', velocityPerSprint: 10 }),
      [EPIC]: config({ startDateField: 'Global epic start', velocityPerSprint: 42 }),
    },
  } as unknown as AllTeamData;

  it('an unconfigured team reads the global work item type, not the global default', () => {
    const normalize = createNormalizeConfiguration(allData);

    expect(normalize.getStartDate!(issue, forTeam('bitovi'))).toBe('2026-02-02');
    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(42);
  });

  it('a level with no global work item type falls back to the global default', () => {
    const normalize = createNormalizeConfiguration(allData);

    expect(normalize.getStartDate!(issue, forTeam('bitovi', 0))).toBe('2026-01-01');
    expect(normalize.getVelocity!(issue, forTeam('bitovi', 0))).toBe(10);
  });

  it('a saved team without that level uses its own defaults over the global work item type', () => {
    const normalize = createNormalizeConfiguration({
      ...allData,
      bitovi: { defaults: config({ velocityPerSprint: 7 }) },
    } as unknown as AllTeamData);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(7);
  });
});
