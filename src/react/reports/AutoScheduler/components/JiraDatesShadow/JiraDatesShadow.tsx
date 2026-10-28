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
}

const SAME = 0.01;

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
}) => {
  const gridEndDay = gridStartDay + gridNumberOfDays;
  if (dueDay <= gridStartDay || startDay >= gridEndDay || dueDay <= startDay) return null;

  const left = Math.max(startDay, gridStartDay);
  const right = Math.min(dueDay, gridEndDay);
  if (Math.abs(left - barStartDay) < SAME && Math.abs(right - barDueDay) < SAME) return null;

  const extents = { startExtends: startDay < gridStartDay, endExtends: dueDay > gridEndDay };

  return (
    <div
      data-testid="jira-dates-shadow"
      aria-hidden
      className={`pointer-events-none absolute top-0.5 h-4 border-black blur-xs ${barBorderClasses(extents).join(' ')} ${barCornerClass(extents)}`}
      style={{
        left: `${((left - gridStartDay) / gridNumberOfDays) * 100}%`,
        width: `${((right - left) / gridNumberOfDays) * 100}%`,
      }}
    />
  );
};
