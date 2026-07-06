import React from 'react';
import { getStatusColorClass } from '../../../../shared/timeline/helpers/status';

export type StatusCircleVariant = 'empty-set-current' | 'past-due' | 'empty-set-past';

export interface StatusCircleProps {
  variant: StatusCircleVariant;
  /** Rollup status — used for `'past-due'`; ignored for the two empty-set variants (which
   * always use the "notstarted" look, matching the legacy `makeEmptySetCurrent`/`makeEmptySetInThePast`). */
  status?: string;
  isDense: boolean;
}

/**
 * A small circular status marker rendered in place of a timeline bar when there is no work to
 * show (undated issue) or when the work is entirely in the past.
 *
 * Ports gantt-grid.js's `makeCircleForStatus`, `makeEmptySetCurrent`, `makeEmptySetInThePast`.
 */
export const StatusCircle: React.FC<StatusCircleProps> = ({ variant, status, isDense }) => {
  if (variant === 'empty-set-past') {
    // Text-only (no background fill) — matches `makeEmptySetInThePast`'s `color-text-notstarted`.
    return (
      <div className={`${isDense ? 'pl-1' : 'pl-2'} flex content-center h-full flex-wrap`}>
        <span
          className="color-text-notstarted w-4 h-4 text-xs rounded-full flex items-center justify-center relative z-30"
          data-testid="status-circle"
        >
          ∅
        </span>
      </div>
    );
  }

  const circleStatus = variant === 'empty-set-current' ? 'notstarted' : (status ?? 'notstarted');

  return (
    <div className={isDense ? 'p-1' : 'p-2'}>
      <span
        className={`${getStatusColorClass(circleStatus)} w-4 h-4 text-xs rounded-full flex items-center justify-center relative z-30`}
        data-testid="status-circle"
      >
        {variant === 'empty-set-current' ? <img src="/images/empty-set.svg" alt="" /> : '←'}
      </span>
    </div>
  );
};
