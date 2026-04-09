import React from 'react';
import Tooltip from '@atlaskit/tooltip';
import type { StatusPeriod } from '../data/calculateTimeInStatus';
import { timeRangeShorthand } from '../../../../utils/date/time-range-shorthand';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface TimeInStatusCellProps {
  totalMs: number;
  periods: StatusPeriod[];
}

export function TimeInStatusCell({ totalMs, periods }: TimeInStatusCellProps) {
  const totalDays = Math.floor(totalMs / MS_PER_DAY);
  const label = totalMs > 0 ? timeRangeShorthand(totalDays) : '—';

  if (totalMs === 0) {
    return <span className="text-neutral-40">—</span>;
  }

  const tooltipContent = (
    <div className="text-xs">
      {periods.map((p, i) => (
        <div key={i} className="whitespace-nowrap">
          {DATE_FORMAT.format(p.fromDate)} → {DATE_FORMAT.format(p.toDate)}
        </div>
      ))}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      {(tooltipProps) => (
        <span {...tooltipProps} className="cursor-default underline decoration-dotted">
          {label}
        </span>
      )}
    </Tooltip>
  );
}
