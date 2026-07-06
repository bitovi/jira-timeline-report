import type { IssueOrRelease } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Earliest start / latest due across a set of rollups — a local, decoupled version of the
 * pipeline's `mergeStartAndDueData` so this module has no dependency on `jira/rollup`. */
const mergeStartAndDue = (rollups: { start?: Date | null; due?: Date | null }[]) => {
  const starts = rollups.map((r) => r.start).filter((d): d is Date => !!d);
  const dues = rollups.map((r) => r.due).filter((d): d is Date => !!d);
  const start = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : undefined;
  const due = dues.length ? new Date(Math.max(...dues.map((d) => d.getTime()))) : undefined;
  return { start, due };
};

/**
 * Reproduce the legacy `quartersAndMonths` range computation, including its defaults.
 *
 * DECISION (plan §Known issues #1): the axis intentionally starts at TODAY — the Gantt is a
 * future-looking timeline. `start` is computed for the default/clamp math only; it is NOT the
 * axis start. Isolating this here makes the choice explicit and easy to revisit.
 *
 * Replaces gantt-grid.js's `quartersAndMonths` getter (range portion).
 */
export const computeAxisRange = (issues: IssueOrRelease[], today = new Date()): { axisStart: Date; axisEnd: Date } => {
  const rollups = issues.map((i) => i.rollupStatuses.rollup);
  let { start, due } = mergeStartAndDue(rollups);
  if (!start) start = today;
  if (!due) due = new Date(start.getTime() + 90 * DAY_MS); // default +90d
  if (due < today) due = new Date(today.getTime() + 90 * DAY_MS); // clamp past-due

  return { axisStart: today, axisEnd: due };
};
