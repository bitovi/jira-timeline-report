import { describe, expect, it } from 'vitest';
import { summariseFloor } from './dependency-floor';

describe('summariseFloor', () => {
  it('reports the gap between the mean finish and the mean floor', () => {
    expect(summariseFloor({ meanPathLength: 53.8, meanPlanFinishDays: 91 })).toEqual({
      floorDays: 53.8,
      queueingDays: 37.2,
    });
  });

  it('reports no queueing when the plan never waits for a track', () => {
    expect(summariseFloor({ meanPathLength: 91, meanPlanFinishDays: 91 }).queueingDays).toBe(0);
  });

  it('clamps float noise rather than rendering a negative gap', () => {
    expect(summariseFloor({ meanPathLength: 91.0000001, meanPlanFinishDays: 91 }).queueingDays).toBe(0);
  });
});
