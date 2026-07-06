import React from 'react';
import { computeBarPosition } from '../../helpers/barPosition';
import { barBorderClasses, barCornerClass } from '../../helpers/barClasses';
import type { AxisRange, BarPosition, Work } from '../../types';

export interface ShadowBarProps {
  /** The prior period's `{ start, due }` to render as a blurred "behind" bar. */
  work: Work | null | undefined;
  range: AxisRange;
  roundTo: string;
  /** The current period's computed position, to detect an unchanged (skip) shadow. */
  currentPosition: BarPosition;
  /** Height class: `densityClasses(isDense).shadowBarSize` for rollup mode, `'h-2'` for breakdown. */
  sizeClass: string;
}

/**
 * The "last period" shadow bar behind a timeline bar — a blurred, bordered duplicate showing
 * where the bar used to be. Renders nothing when there's no prior period, the prior period is
 * identical to the current one, or the prior period is entirely in the past.
 *
 * Ports gantt-grid.js's `makeLastPeriodElement`.
 */
export const ShadowBar: React.FC<ShadowBarProps> = ({ work, range, roundTo, currentPosition, sizeClass }) => {
  if (!work?.start || !work?.due) return null;

  const position = computeBarPosition(range, work, roundTo);
  if (position.isEmpty) return null;
  if (position.endIsBeforeFirstDay) return null;
  if (
    position.marginLeftPercent === currentPosition.marginLeftPercent &&
    position.widthPercent === currentPosition.widthPercent
  ) {
    return null;
  }

  return (
    <div
      className={`border-black blur-xs ${barBorderClasses(position).join(' ')} ${barCornerClass(position)} ${sizeClass}`}
      style={{
        backgroundClip: 'content-box',
        position: 'relative',
        width: `${position.widthPercent}%`,
        marginLeft: `max(${position.marginLeftPercent}%, 1px)`,
      }}
      data-testid="shadow-bar"
    />
  );
};
