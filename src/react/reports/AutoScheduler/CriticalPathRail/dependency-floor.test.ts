import { describe, expect, it } from 'vitest';
import { summariseFloor } from './dependency-floor';

const base = { meanPathLength: 53.8, planBottomDays: 91, planTopDays: 91 };

describe('summariseFloor', () => {
  it('reports the gap at the average', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 'average' })).toEqual({
      floorDays: 53.8,
      queueingDays: 37.2,
    });
  });

  it('suppresses the gap at the median, because that mixes a median with a mean', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 50 }).queueingDays).toBeNull();
  });

  it('suppresses the gap at every percentile, where the plan finish is a range', () => {
    for (const weight of [60, 70, 80, 90]) {
      expect(summariseFloor({ ...base, uncertaintyWeight: weight, planTopDays: 112 }).queueingDays).toBeNull();
    }
  });

  it('still reports the floor when the gap is suppressed', () => {
    expect(summariseFloor({ ...base, uncertaintyWeight: 80 }).floorDays).toBe(53.8);
  });

  it('never reports a negative gap', () => {
    expect(
      summariseFloor({ meanPathLength: 95, planBottomDays: 91, planTopDays: 91, uncertaintyWeight: 'average' })
        .queueingDays,
    ).toBe(0);
  });
});
