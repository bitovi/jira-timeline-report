import type { StatusAggregate, TimeByStatus } from './aggregateTimeByStatus';

export type TimeByCategory = Record<string, StatusAggregate>;

export function aggregateTimeByCategory(
  timeByStatus: TimeByStatus,
  categoryMap: Record<string, string>,
): TimeByCategory {
  const result: TimeByCategory = {};

  for (const [statusName, aggregate] of Object.entries(timeByStatus)) {
    const category = categoryMap[statusName] ?? 'Unknown';

    if (!result[category]) {
      result[category] = { totalMs: 0, periods: [] };
    }
    result[category].totalMs += aggregate.totalMs;
    result[category].periods.push(...aggregate.periods);
  }

  return result;
}
