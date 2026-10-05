import { describe, expect, it, vi } from 'vitest';

import { applyCapacityOverrides } from './applyCapacityOverrides';

// `normalize.ts` calls these with (issue, configWithDefaults); only `getTeamKey` is read here.
const config = { getTeamKey: (issue: any) => issue.teamKey } as any;
const issue = (teamKey: string) => ({ teamKey }) as any;

const base = {
  getVelocity: () => 21,
  getParallelWorkLimit: () => 1,
  getDaysPerSprint: () => 10,
} as any;

describe('applyCapacityOverrides', () => {
  it('returns the base values when there is no override for the team', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { velocityPerSprint: 35 } });

    expect(wrapped.getVelocity!(issue('STORE'), config)).toBe(21);
    expect(wrapped.getParallelWorkLimit!(issue('STORE'), config)).toBe(1);
  });

  it('overrides velocity for the named team only', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { velocityPerSprint: 35 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(35);
    expect(wrapped.getParallelWorkLimit!(issue('ORDER'), config)).toBe(1);
  });

  it('overrides tracks independently of velocity', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { tracks: 3 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(21);
    expect(wrapped.getParallelWorkLimit!(issue('ORDER'), config)).toBe(3);
  });

  it('passes through every other config key untouched', () => {
    const wrapped = applyCapacityOverrides(base, {});

    expect(wrapped.getDaysPerSprint).toBe(base.getDaysPerSprint);
  });

  it('returns the base object itself when there are no overrides at all', () => {
    const wrapped = applyCapacityOverrides(base, {});

    expect(wrapped).toBe(base);
  });

  it('falls back to the base when the team has an override object with no values', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: {} });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(21);
  });

  it('does not call the base getters when an override supplies the value', () => {
    const getVelocity = vi.fn(() => 21);
    const wrapped = applyCapacityOverrides({ ...base, getVelocity } as any, {
      ORDER: { velocityPerSprint: 35 },
    });

    wrapped.getVelocity!(issue('ORDER'), config);

    expect(getVelocity).not.toHaveBeenCalled();
  });
});
