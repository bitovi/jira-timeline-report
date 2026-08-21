import type { DateRangeFilter } from '../../../shared/timeline/helpers/dateRangeFilter';
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
 * DECISION (spec/028-fix-gantt-date-filters/plan.md, narrowing spec/005-gantt-rewrite §Known
 * issues #1): the axis starts at TODAY *by default* — the Gantt is a future-looking timeline —
 * but yields to an explicitly-chosen due-date window. With no `range`, `axisStart === today` and
 * this reduces exactly to the pre-028 behavior. `start` is computed for the default/clamp math
 * only; it is NOT the axis start.
 *
 * Replaces gantt-grid.js's `quartersAndMonths` getter (range portion).
 */
export const computeAxisRange = (
  issues: IssueOrRelease[],
  today = new Date(),
  range: DateRangeFilter = {},
): { axisStart: Date; axisEnd: Date } => {
  const axisStart = range.from ?? today;

  // An explicit upper bound wins outright. The `>= axisStart` guard rejects an inverted window
  // (the two date inputs are independent, so `from > to` is easy to type) rather than handing
  // `getQuartersAndMonths` a negative span, which yields zero month columns.
  if (range.to && range.to >= axisStart) {
    return { axisStart, axisEnd: range.to };
  }

  const rollups = issues.map((i) => i.rollupStatuses.rollup);
  let { start, due } = mergeStartAndDue(rollups);
  if (!start) start = axisStart;
  if (!due) due = new Date(start.getTime() + 90 * DAY_MS); // default +90d
  if (due < axisStart) due = new Date(axisStart.getTime() + 90 * DAY_MS); // clamp past-due

  return { axisStart, axisEnd: due };
};
