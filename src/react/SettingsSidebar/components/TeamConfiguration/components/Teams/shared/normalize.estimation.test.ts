import { describe, expect, it } from 'vitest';

import type { AllTeamData, IssueFields } from '../services/team-configuration';

import { createFullyInheritedConfig } from '../services/team-configuration';
import { createNormalizeConfiguration } from './normalize';

// spec/040-update-team-estimation-settings: `getVelocity` returns the effective velocity for the
// team's estimate unit, resolved field by field through the inheritance chain.

const EPIC = 1;
const hierarchyLevels = [String(EPIC), '0'];
const jiraFields = [] as unknown as IssueFields;

const issue = { fields: {} } as never;

const forTeam = (teamKey: string, level = EPIC) =>
  ({ getTeamKey: () => teamKey, getHierarchyLevel: () => level }) as never;

const normalizeFor = (saved: Partial<AllTeamData>) =>
  createNormalizeConfiguration(
    createFullyInheritedConfig({ __GLOBAL__: { defaults: {} }, ...saved } as AllTeamData, jiraFields, hierarchyLevels),
  );

describe('createNormalizeConfiguration estimate units', () => {
  it('a config saved before estimate units keeps story points exactly', () => {
    const normalize = normalizeFor({ bitovi: { defaults: { velocityPerSprint: 34 } } } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(34);
    expect(normalize.getEstimateUnit!(issue, forTeam('bitovi'))).toBe('storyPoints');
    expect(normalize.getEstimateTeamShare!(issue, forTeam('bitovi'))).toBe('full');
  });

  it('a Dev Days team: members × sprint length', () => {
    const normalize = normalizeFor({
      bitovi: { defaults: { estimateUnit: 'devDays', teamMembers: 6, sprintLength: 15 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(90);
    expect(normalize.getEstimateUnit!(issue, forTeam('bitovi'))).toBe('devDays');
  });

  it('a team inheriting the unit with its own team members', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'devDays', teamMembers: 3 } },
      bitovi: { [EPIC]: { teamMembers: 8 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(80);
    // Another team takes both answers from the global defaults.
    expect(normalize.getVelocity!(issue, forTeam('other'))).toBe(30);
  });

  it('a team-time unit inherits its share from the global work item type', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks' }, [EPIC]: { estimateTeamShare: 'half' } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(4);
    expect(normalize.getEstimateTeamShare!(issue, forTeam('bitovi'))).toBe('half');
    // The global default level has no share of its own, so it falls back to the full team.
    expect(normalize.getVelocity!(issue, forTeam('bitovi', 0))).toBe(2);
  });
});
