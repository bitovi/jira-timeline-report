import { describe, expect, it } from 'vitest';

import type { AllTeamData, IssueFields } from '../services/team-configuration';

import { createFullyInheritedConfig } from '../services/team-configuration';
import { createNormalizeConfiguration } from './normalize';

// spec/040-update-team-estimation-settings: `getVelocity` returns the effective velocity for the
// team's estimate unit, X × N × P (spec/040), resolved through the inheritance chain. X resolves together
// with the unit.

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
    // Derived against the default headcount of 5.
    expect(normalize.getTeamMembers!(issue, forTeam('bitovi'))).toBe(5);
    expect(normalize.getPointsPerPersonDay!(issue, forTeam('bitovi'))).toBeCloseTo(34 / (10 * 5));
  });

  it('a Dev Days team: members × the 10-day period, whatever sprint length is saved', () => {
    const normalize = normalizeFor({
      bitovi: { defaults: { estimateUnit: 'devDays', teamMembers: 6, sprintLength: 15 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(60);
    expect(normalize.getDaysPerSprint!(issue, forTeam('bitovi'))).toBe(10);
    expect(normalize.getTeamMembers!(issue, forTeam('bitovi'))).toBe(6);
    expect(normalize.getEstimateUnit!(issue, forTeam('bitovi'))).toBe('devDays');
  });

  it('a story points team keeps its sprint length and still reports its headcount', () => {
    const normalize = normalizeFor({
      bitovi: { defaults: { sprintLength: 15, teamMembers: 6 } },
    } as never);

    expect(normalize.getDaysPerSprint!(issue, forTeam('bitovi'))).toBe(15);
    expect(normalize.getTeamMembers!(issue, forTeam('bitovi'))).toBe(6);
  });

  it('a team inheriting the unit with its own team members', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'devDays', teamMembers: 3 } },
      bitovi: { [EPIC]: { teamMembers: 8 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(80);
    expect(normalize.getTeamMembers!(issue, forTeam('bitovi'))).toBe(8);
    // Another team takes both answers from the global defaults.
    expect(normalize.getVelocity!(issue, forTeam('other'))).toBe(30);
  });

  it('a legacy team-time unit inherits its share from the global work item type', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks' }, [EPIC]: { estimateTeamShare: 'half' } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(4);
    // Half of the default 5 developers.
    expect(normalize.getPointsPerPersonDay!(issue, forTeam('bitovi'))).toBeCloseTo(1 / (2.5 * 5));
    // The global default level has no share of its own, so it falls back to the full team.
    expect(normalize.getVelocity!(issue, forTeam('bitovi', 0))).toBe(2);
  });

  it('a team inheriting the global unit and X with its own headcount scales', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.04, teamMembers: 10 } },
      bitovi: { defaults: { teamMembers: 11 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('other'))).toBeCloseTo(4);
    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBeCloseTo(4.4);
    expect(normalize.getPointsPerPersonDay!(issue, forTeam('bitovi'))).toBe(0.04);
  });

  it('a level overriding the unit does not read a less specific X', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { estimateUnit: 'storyPoints', pointsPerPersonDay: 0.3, teamMembers: 10 } },
      bitovi: { [EPIC]: { estimateUnit: 'teamWeeks', estimateTeamShare: 'half' } },
    } as never);

    // Derived from the Epic level's own share (half of 10), not the global story points X.
    expect(normalize.getPointsPerPersonDay!(issue, forTeam('bitovi'))).toBeCloseTo(0.04);
    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBeCloseTo(4);
  });

  it('a legacy velocity on a more specific level anchors capacity over a global X', () => {
    const normalize = normalizeFor({
      __GLOBAL__: { defaults: { pointsPerPersonDay: 0.3, teamMembers: 10 } },
      bitovi: { defaults: { velocityPerSprint: 21 } },
    } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBe(21);
    expect(normalize.getVelocity!(issue, forTeam('other'))).toBeCloseTo(30);
  });

  it('a stored X with no saved headcount uses the default of 5', () => {
    const normalize = normalizeFor({ bitovi: { defaults: { pointsPerPersonDay: 0.3 } } } as never);

    expect(normalize.getVelocity!(issue, forTeam('bitovi'))).toBeCloseTo(15);
  });
});
