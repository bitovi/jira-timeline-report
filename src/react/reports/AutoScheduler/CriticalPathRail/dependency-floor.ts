import type { UncertaintyWeight } from '../hooks/useUncertaintyWeight';

import { roundTo } from '../../../../utils/number/number';

export interface FloorSummary {
  /** Mean longest dependency chain, in working days. */
  floorDays: number;
  /** Plan finish minus floor, or null when the two are not comparable. */
  queueingDays: number | null;
}

export function summariseFloor(args: {
  meanPathLength: number;
  uncertaintyWeight: UncertaintyWeight;
  planBottomDays: number;
  planTopDays: number;
}): FloorSummary {
  const { meanPathLength, uncertaintyWeight, planTopDays } = args;

  // The floor is unconditionally a mean; the plan finish only is at `average`. A percentile — or a
  // median — minus a mean is not a quantity, so there is nothing to report at any other setting.
  if (uncertaintyWeight !== 'average') {
    return { floorDays: meanPathLength, queueingDays: null };
  }

  // The floor is a lower bound on the mean finish, so a negative gap means something upstream is
  // wrong. Clamp rather than render a negative number at a user.
  return { floorDays: meanPathLength, queueingDays: roundTo(Math.max(0, planTopDays - meanPathLength), 1) };
}
