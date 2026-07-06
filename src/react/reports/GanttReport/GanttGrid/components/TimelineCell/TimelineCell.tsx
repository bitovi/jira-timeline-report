import React from 'react';
import { TimelineBar } from '../TimelineBar';
import type { AxisRange, IssueOrRelease, WorkTypeWithWork } from '../../types';

export interface TimelineCellProps {
  issue: IssueOrRelease;
  range: AxisRange;
  roundTo: string;
  isDense: boolean;
  isBreakdown: boolean;
  workTypesWithWork: WorkTypeWithWork[];
  /** CSS `grid-column` spanning the month columns for this row, e.g. `"3 / span 6"`. */
  gridColumn: string;
}

/**
 * The grid cell that hosts a row's `TimelineBar`, spanning the month columns.
 *
 * The dates tooltip lives inside `TimelineBar` (wrapping the bar element(s)) so it anchors to the
 * bar rather than this full-height cell.
 */
export const TimelineCell: React.FC<TimelineCellProps> = ({
  issue,
  range,
  roundTo,
  isDense,
  isBreakdown,
  workTypesWithWork,
  gridColumn,
}) => (
  <div style={{ gridColumn, position: 'relative', zIndex: 20 }}>
    <TimelineBar
      issue={issue}
      range={range}
      roundTo={roundTo}
      isDense={isDense}
      isBreakdown={isBreakdown}
      workTypesWithWork={workTypesWithWork}
    />
  </div>
);
