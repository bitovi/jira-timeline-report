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
  /** The simulation's overall finish at the slider. */
  finish: number;
  /** The simulation's plan start at the slider (≤ 0). Used only when the finish can't move. */
  start: number;
  /** The percentile to use when neither the finish nor the start responds to it. */
  fallbackQuantile: number;
};

const MIN_QUANTILE = 1;
const MAX_QUANTILE = 99;
const TOLERANCE_DAYS = 0.5;
const MAX_STEPS = 12;

/**
 * Finds the shared percentile whose plan finishes when the simulation says the whole plan finishes
 * at the slider's risk — or, when frozen items pin the finish, starts when it says work starts.
 */
export function calibratePlan(linkedIssues: LinkedIssue[], target: CalibrationTarget): Plan {
  const low = runPlan(linkedIssues, MIN_QUANTILE);
  const high = runPlan(linkedIssues, MAX_QUANTILE);

  // Both measures grow with the percentile: the finish gets later, and the start earlier.
  let measure: (plan: Plan) => number;
  let goal: number;
  if (high.finish - low.finish > TOLERANCE_DAYS) {
    measure = (plan) => plan.finish;
    goal = target.finish;
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
