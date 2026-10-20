import React from 'react';
import { TimelineBar } from '../TimelineBar';
import { TimelineBoundaryContext } from '../DatesTooltip';
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
 * The dates tooltip lives inside `TimelineBar` and anchors to the bar element. This cell is the
 * timeline area, provided as the tooltip's boundary so it never extends past the timeline.
 */
export const TimelineCell: React.FC<TimelineCellProps> = ({
  issue,
  range,
  roundTo,
  isDense,
  isBreakdown,
  workTypesWithWork,
  gridColumn,
}) => {
  const [cell, setCell] = React.useState<HTMLElement | null>(null);
  return (
    <div ref={setCell} style={{ gridColumn, position: 'relative', zIndex: 20 }}>
      <TimelineBoundaryContext.Provider value={cell}>
        <TimelineBar
          issue={issue}
          range={range}
          roundTo={roundTo}
          isDense={isDense}
          isBreakdown={isBreakdown}
          workTypesWithWork={workTypesWithWork}
        />
      </TimelineBoundaryContext.Provider>
    </div>
  );
};
