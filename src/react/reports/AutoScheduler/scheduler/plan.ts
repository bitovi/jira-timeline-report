import type { LinkedIssue } from './link-issues';
import { resetLinkedIssue } from './link-issues';
import { scheduleIssues } from './schedule';

/** Where the plan pass put one item. Days are business-day offsets from the start date; due is exclusive. */
export type PlannedItem = { startDay: number; dueDay: number; track: number };

export type Plan = {
  /** The shared percentile every length was taken at. */
  quantile: number;
  items: Map<string, PlannedItem>;
  /** The latest due day of any item. */
  finish: number;
  /** The earliest start of any non-frozen item, capped at 0 — comparable to `firstStartDays`. */
  start: number;
};

/**
 * One scheduler run with no randomness: every length is the `quantile` percentile of its own
 * distribution. See spec/044 consistent-plan.md. Mutates the issues' `mutableWorkItem`, so callers
 * must not share `linkedIssues` with a running simulation.
 */
export function runPlan(linkedIssues: LinkedIssue[], quantile: number): Plan {
  for (const issue of linkedIssues) {
    resetLinkedIssue(issue, quantile);
  }
  const teamWork = scheduleIssues(linkedIssues);
  Object.values(teamWork).forEach((team) => {
    team.workPlans.plans.forEach((plan, index) => {
      for (const workItem of plan) {
        workItem.work.track = index;
      }
    });
  });

  const items = new Map<string, PlannedItem>();
  let finish = 0;
  let start = 0;
  for (const issue of linkedIssues) {
    const work = issue.mutableWorkItem;
    const startDay = work.startDay as number;
    const dueDay = startDay + work.daysOfWork;
    items.set(issue.key, { startDay, dueDay, track: work.track ?? 0 });
    finish = Math.max(finish, dueDay);
    if (!issue.frozen) start = Math.min(start, startDay);
  }
  return { quantile, items, finish, start };
}

export type CalibrationTarget = {
  /**
   * Each scheduled item's own finish at the slider (its `dueDayTop` from the simulation), keyed by
   * issue key. Only forward work: frozen items don't move, and work feeding a frozen item is placed
   * from the frozen dates, not from its own finish.
   */
  ownDue: ReadonlyMap<string, number>;
  /** The simulation's plan start at the slider (≤ 0). Used only when no item's finish can move. */
  start: number;
  /** The percentile to use when neither measure responds to it. */
  fallbackQuantile: number;
};

const MIN_QUANTILE = 1;
const MAX_QUANTILE = 99;
const TOLERANCE_DAYS = 0.5;
const MAX_STEPS = 12;

/** The middle of `values`; the mean of the two middle ones for an even count. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How far the typical item's plan end is from its own finish: the median, over the items in
 * `ownDue`, of plan end − own finish. Grows with the percentile, since every bar end moves later.
 */
function typicalMiss(plan: Plan, ownDue: ReadonlyMap<string, number>): number {
  const misses: number[] = [];
  for (const [key, due] of ownDue) {
    const planned = plan.items.get(key);
    if (planned) misses.push(planned.dueDay - due);
  }
  return median(misses);
}

/**
 * Finds the shared percentile whose plan ends the typical item when its own simulation finish says
 * it ends (spec/044 consistent-plan.md): half the items end on or before their own date, half after.
 * The median, so one huge, uncertain epic can't drag the dial for everyone. The plan's last date is
 * then not the whole plan's finish — waiting on parallel branches is a risk no single epic carries,
 * and the Overall timing row shows it. When only frozen items and the work feeding them are left,
 * calibrates the plan's start instead.
 */
export function calibratePlan(linkedIssues: LinkedIssue[], target: CalibrationTarget): Plan {
  const low = runPlan(linkedIssues, MIN_QUANTILE);
  const high = runPlan(linkedIssues, MAX_QUANTILE);

  // Both measures grow with the percentile: bars end later, and the start gets earlier.
  let measure: (plan: Plan) => number;
  let goal: number;
  if (target.ownDue.size && typicalMiss(high, target.ownDue) - typicalMiss(low, target.ownDue) > TOLERANCE_DAYS) {
    measure = (plan) => typicalMiss(plan, target.ownDue);
    goal = 0;
  } else if (low.start - high.start > TOLERANCE_DAYS) {
    measure = (plan) => -plan.start;
    goal = -target.start;
  } else {
    return runPlan(linkedIssues, target.fallbackQuantile);
  }

  if (goal <= measure(low)) return low;
  if (goal >= measure(high)) return high;

  let best = Math.abs(measure(low) - goal) <= Math.abs(measure(high) - goal) ? low : high;
  let lo = MIN_QUANTILE;
  let hi = MAX_QUANTILE;
  for (let step = 0; step < MAX_STEPS; step++) {
    const plan = runPlan(linkedIssues, (lo + hi) / 2);
    const miss = measure(plan) - goal;
    // Keep the closest plan seen, so a rare non-monotone step can't make the result worse.
    if (Math.abs(miss) < Math.abs(measure(best) - goal)) best = plan;
    if (Math.abs(miss) <= TOLERANCE_DAYS) break;
    if (miss < 0) lo = plan.quantile;
    else hi = plan.quantile;
  }
  return best;
}
