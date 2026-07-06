import React from 'react';
import { computeBarPosition } from '../../helpers/barPosition';
import { barCornerClass } from '../../helpers/barClasses';
import { getStatusColorClass } from '../../../../shared/timeline/helpers/status';
import { StatusCircle } from '../StatusCircle';
import { ShadowBar } from '../ShadowBar';
import { DatesTooltip } from '../DatesTooltip';
import { buildDatesTooltip, buildWorkDatesTooltip } from '../../helpers/datesTooltip';
import type { AxisRange, IssueOrRelease, WorkTypeWithWork } from '../../types';
import { densityClasses } from '../../helpers/density';

export interface TimelineBarProps {
  issue: IssueOrRelease;
  range: AxisRange;
  roundTo: string;
  isDense: boolean;
  isBreakdown: boolean;
  workTypesWithWork: WorkTypeWithWork[];
}

/**
 * The bar (or circle) rendered in an issue row's timeline cell.
 *
 * Ports gantt-grid.js's `getReleaseTimeline`.
 */
export const TimelineBar: React.FC<TimelineBarProps> = ({
  issue,
  range,
  roundTo,
  isDense,
  isBreakdown,
  workTypesWithWork,
}) => {
  const rollup = issue.rollupStatuses.rollup;
  const density = densityClasses(isDense);

  if (!rollup.start || !rollup.due) {
    return <StatusCircle variant="empty-set-current" isDense={isDense} />;
  }

  if (isBreakdown) {
    const visibleTypes = workTypesWithWork.filter((w) => w.hasWork);
    return (
      <div className="relative">
        <div className="absolute inset-0">
          {visibleTypes.map(({ type }) => {
            const work = issue.rollupStatuses[type];
            if (!work) return null;
            const position = computeBarPosition(range, work, roundTo);
            return (
              <ShadowBar
                key={type}
                work={work.lastPeriod}
                range={range}
                roundTo={roundTo}
                currentPosition={position}
                sizeClass="h-2"
              />
            );
          })}
        </div>
        {visibleTypes.map(({ type }) => {
          const work = issue.rollupStatuses[type];
          if (!work) return null;
          const position = computeBarPosition(range, work, roundTo);
          return (
            <DatesTooltip key={type} data={buildWorkDatesTooltip(type, work)}>
              <div
                className={`${type}_time h-[6px] my-[1px] rounded-sm ${getStatusColorClass(work.status)} relative`}
                style={{ width: `${position.widthPercent}%`, marginLeft: `max(${position.marginLeftPercent}%, 1px)` }}
              />
            </DatesTooltip>
          );
        })}
      </div>
    );
  }

  const position = computeBarPosition(range, rollup, roundTo);

  // NOTE: vertical spacing uses PADDING (not margin) on this wrapper, not the bar itself.
  // Margin on the bar would collapse through the intervening non-BFC `relative` divs up to
  // the CSS grid item (IssueRow's cell), which stretches to the full row height — but the
  // shadow bar's `absolute inset-0` overlay sizes itself off THIS wrapper's own box, which
  // (with margin) would stay collapsed to just the bar's content height, misaligning the
  // shadow vertically. Padding contributes to auto-height directly, avoiding that collapse.
  const currentBar = position.endIsBeforeFirstDay ? (
    <StatusCircle variant="past-due" status={rollup.status} isDense={isDense} />
  ) : (
    <div className="py-2">
      {/*
        The tooltip trigger is the `relative` wrapper below, whose box is exactly the bar's height,
        so `position="bottom"` anchors the tooltip to the bar's bottom edge. The absolutely
        positioned overlay expands the *hover* area to the full row band (±8px = the `py-2`
        padding) and full width — so hovering anywhere in the row shows the tooltip — without
        growing the trigger's box (absolute children don't affect layout size), keeping the anchor
        on the bar.
      */}
      <DatesTooltip data={buildDatesTooltip(issue)}>
        <div className="relative">
          <div className="absolute" style={{ top: '-8px', bottom: '-8px', left: 0, right: 0 }} aria-hidden />
          <div
            className={`${density.bigBarSize} ${getStatusColorClass(rollup.status)} ${barCornerClass(position)} identifier-current-time relative z-30`}
            style={{ width: `${position.widthPercent}%`, marginLeft: `max(${position.marginLeftPercent}%, 1px)` }}
          />
        </div>
      </DatesTooltip>
    </div>
  );

  const lastPeriod = rollup.lastPeriod;
  const shadow =
    lastPeriod && lastPeriod.start && lastPeriod.due ? (
      <ShadowBar
        work={lastPeriod}
        range={range}
        roundTo={roundTo}
        currentPosition={position}
        sizeClass={density.shadowBarSize}
      />
    ) : lastPeriod ? (
      <StatusCircle variant="empty-set-past" isDense={isDense} />
    ) : null;

  return (
    <div className="relative">
      {shadow && <div className="pointer-events-none absolute inset-0 py-1">{shadow}</div>}
      {currentBar}
    </div>
  );
};
