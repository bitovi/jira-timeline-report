import { describe, expect, it, vi } from 'vitest';

import { applyCapacityOverrides } from './applyCapacityOverrides';

// `normalize.ts` calls these with (issue, configWithDefaults); only `getTeamKey` is read here.
const config = { getTeamKey: (issue: any) => issue.teamKey } as any;
const issue = (teamKey: string) => ({ teamKey }) as any;

// A Team Weeks team, 5 people per estimate: X = 0.04, 10 developers, 10-day period → V = 4.
const base = {
  getVelocity: () => 4,
  getPointsPerPersonDay: () => 0.04,
  getTeamMembers: () => 10,
  getParallelWorkLimit: () => 1,
  getDaysPerSprint: () => 10,
} as any;

/** What `normalize.ts` derives: team capacity per working day. */
const teamPerDay = (wrapped: any, team = 'ORDER') =>
  wrapped.getVelocity(issue(team), config) / wrapped.getDaysPerSprint(issue(team), config);

describe('applyCapacityOverrides', () => {
  it('returns the base values when there is no override for the team', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { teamMembers: 11 } });

    expect(wrapped.getVelocity!(issue('STORE'), config)).toBe(4);
    expect(wrapped.getTeamMembers!(issue('STORE'), config)).toBe(10);
    expect(wrapped.getParallelWorkLimit!(issue('STORE'), config)).toBe(1);
  });

  it('a team members override scales velocity: X × N × P', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { teamMembers: 11 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBeCloseTo(4.4);
    expect(wrapped.getTeamMembers!(issue('ORDER'), config)).toBe(11);
    expect(wrapped.getPointsPerPersonDay!(issue('ORDER'), config)).toBe(0.04);
  });

  it.each([
    ['Story Points, 21 / sprint', 0.21, 2.31],
    ['Dev Days', 1, 11],
    ['Team Days, 5 people', 0.2, 2.2],
    ['Team Sprints, 5 people', 0.02, 0.22],
  ])('a team members override scales %s by 10%% at 10 → 11', (_unit, pointsPerPersonDay, perDay) => {
    const wrapped = applyCapacityOverrides(
      { ...base, getPointsPerPersonDay: () => pointsPerPersonDay, getVelocity: () => pointsPerPersonDay * 100 },
      { ORDER: { teamMembers: 11 } },
    );

    expect(teamPerDay(wrapped)).toBeCloseTo(perDay);
  });

  it('a points-per-person-day override replaces X at the base headcount', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { pointsPerPersonDay: 0.3 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBeCloseTo(30);
    expect(wrapped.getPointsPerPersonDay!(issue('ORDER'), config)).toBe(0.3);
  });

  it('combines a headcount and an X override', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { pointsPerPersonDay: 0.3, teamMembers: 11 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBeCloseTo(33);
  });

  it('a tracks override leaves the team capacity per day unchanged', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { tracks: 3 } });

    expect(teamPerDay(wrapped)).toBeCloseTo(0.4);
    expect(wrapped.getParallelWorkLimit!(issue('ORDER'), config)).toBe(3);
  });

  it('passes through every other config key untouched', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { tracks: 3 } });

    expect(wrapped.getDaysPerSprint).toBe(base.getDaysPerSprint);
  });

  it('returns the base object itself when there are no overrides at all', () => {
    const wrapped = applyCapacityOverrides(base, {});

    expect(wrapped).toBe(base);
  });

  it('falls back to the base when the team has an override object with no values', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: {} });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(4);
  });

  it('does not call the base velocity when an override supplies the capacity', () => {
    const getVelocity = vi.fn(() => 4);
    const wrapped = applyCapacityOverrides({ ...base, getVelocity } as any, { ORDER: { teamMembers: 11 } });

    wrapped.getVelocity!(issue('ORDER'), config);

    expect(getVelocity).not.toHaveBeenCalled();
  });

  it('falls back to the normalize defaults when the base has no X, headcount or period getters', () => {
    const wrapped = applyCapacityOverrides({ getVelocity: () => 21, getParallelWorkLimit: () => 1 } as any, {
      ORDER: { teamMembers: 10 },
    });

    // Default X = 21 / (10 days × 5 people), default period 10 days.
    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBeCloseTo(42);
  });
});
