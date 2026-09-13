import { roundTo } from '../../../../utils/number/number';

export interface FloorSummary {
  /** Mean longest dependency chain, in working days. */
  floorDays: number;
  /** Mean plan finish minus the floor, in working days. */
  queueingDays: number;
}

/**
 * Both inputs are means over every run, which is why the panel never follows the confidence slider.
 * See spec/024-critical-path/confidence-aware-floor.md.
 */
export function summariseFloor(args: { meanPathLength: number; meanPlanFinishDays: number }): FloorSummary {
  const { meanPathLength, meanPlanFinishDays } = args;

  // Per run the chain ignores contention, so it cannot exceed that run's finish, and the same holds
  // of the two means. The clamp only absorbs float noise when a plan queues for nothing at all,
  // which would otherwise render as "-0.0 d".
  return {
    floorDays: meanPathLength,
    queueingDays: roundTo(Math.max(0, meanPlanFinishDays - meanPathLength), 1),
  };
}
