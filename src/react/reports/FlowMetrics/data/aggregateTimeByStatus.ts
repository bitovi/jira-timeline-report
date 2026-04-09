import type { StatusPeriod } from './calculateTimeInStatus';

export interface StatusAggregate {
  totalMs: number;
  periods: StatusPeriod[];
}

export type TimeByStatus = Record<string, StatusAggregate>;

export function aggregateTimeByStatus(periods: StatusPeriod[]): TimeByStatus {
  const result: TimeByStatus = {};

  for (const period of periods) {
    if (!result[period.statusName]) {
      result[period.statusName] = { totalMs: 0, periods: [] };
    }
    result[period.statusName].totalMs += period.durationMs;
    result[period.statusName].periods.push(period);
  }

  return result;
}
