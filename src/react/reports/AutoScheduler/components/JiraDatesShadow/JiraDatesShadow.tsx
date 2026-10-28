import type { FC } from 'react';

import React from 'react';
import { barBorderClasses, barCornerClass } from '../../../GanttReport/GanttGrid/helpers/barClasses';

interface JiraDatesShadowProps {
  /** Business-day offsets from the plan start; `dueDay` is exclusive. Either can be outside the grid. */
  startDay: number;
  dueDay: number;
  gridNumberOfDays: number;
  /** Offset of the grid's first column; negative when the grid begins before the start date. */
  gridStartDay?: number;
  /** The bar drawn on top, in the same units. The shadow hides when it lines up with it exactly. */
  barStartDay: number;
  barDueDay: number;
  /**
   * The lock is hovered: fill the dates in as the bar that would land there, sharp and on top, even
   * where they line up with the bar.
   */
  previewing?: boolean;
  /** The row is hovered. Otherwise the shadow stays hidden unless a lock somewhere in the report is. */
  revealed?: boolean;
}

const SAME = 0.01;

/**
 * Hidden until wanted, so a chart full of them doesn't compete with the plan. Any hovered or focused
 * lock in the report (the `group/report` container) reveals them all, for comparing before freezing.
 */
const REVEAL_ON_ANY_LOCK =
  'opacity-0 group-has-[.freeze-toggle:hover]/report:opacity-100 group-has-[.freeze-toggle:focus-visible]/report:opacity-100';

/**
 * An item's current Jira dates, drawn as the Gantt draws last period's dates
 * (`GanttReport/.../ShadowBar`): a blurred outline behind the bar. Placed by business-day offsets
 * because the Gantt's version is tied to its own date axis. A clipped edge is drawn open.
 */
export const JiraDatesShadow: FC<JiraDatesShadowProps> = ({
  startDay,
  dueDay,
  gridNumberOfDays,
  gridStartDay = 0,
  barStartDay,
  barDueDay,
  previewing = false,
  revealed = false,
}) => {
  const gridEndDay = gridStartDay + gridNumberOfDays;
  if (dueDay <= gridStartDay || startDay >= gridEndDay || dueDay <= startDay) return null;

  const left = Math.max(startDay, gridStartDay);
  const right = Math.min(dueDay, gridEndDay);
  if (!previewing && Math.abs(left - barStartDay) < SAME && Math.abs(right - barDueDay) < SAME) return null;

  const extents = { startExtends: startDay < gridStartDay, endExtends: dueDay > gridEndDay };
  const look = previewing ? 'z-10 border-neutral-300 bg-neutral-100' : 'border-black blur-xs';
  const visibility = previewing || revealed ? 'opacity-100' : REVEAL_ON_ANY_LOCK;

  return (
    <div
      data-testid="jira-dates-shadow"
      data-previewing={previewing || undefined}
      aria-hidden
      className={`pointer-events-none absolute top-1 h-4 transition-all duration-150 ${look} ${visibility} ${barBorderClasses(extents).join(' ')} ${barCornerClass(extents)}`}
      style={{
        left: `${((left - gridStartDay) / gridNumberOfDays) * 100}%`,
        width: `${((right - left) / gridNumberOfDays) * 100}%`,
      }}
    />
  );
};
