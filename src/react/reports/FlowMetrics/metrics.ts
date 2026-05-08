import type { MetricsIssue } from './adapter';

type HistoryEntry = MetricsIssue['changelog']['histories'][number];

// Core logic: last transition from "new" (To Do) → "indeterminate" (In Progress).
// Using the *last* such transition means accidental starts sent back to To Do don't count.
// Done → In Progress transitions are ignored — resolution date covers re-opened work.
export function getInProgressDateFromHistories(
  histories: HistoryEntry[],
  statusCategoryMap: Map<string, string>,
): Date | null {
  const sorted = [...histories].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  let result: Date | null = null;
  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field !== 'status' || !item.from || !item.to) continue;
      const fromCategory = statusCategoryMap.get(item.from);
      const toCategory = statusCategoryMap.get(item.to);
      if (fromCategory === 'new' && toCategory === 'indeterminate') {
        result = new Date(history.created);
      }
    }
  }
  return result;
}

export function getInProgressDate(issue: MetricsIssue, statusCategoryMap: Map<string, string>): Date | null {
  return getInProgressDateFromHistories(issue.changelog.histories, statusCategoryMap);
}

export interface CycleTimeStats {
  avg: number;
  median: number;
  p85: number; // 85th percentile — used as SLE
  count: number; // issues with calculable cycle time
  throughput: number; // all done issues in the period
  samples: number[]; // sorted raw cycle times for Monte Carlo bootstrap sampling
}

// Parses a "YYYY-MM-DD" date string as local midnight.
// new Date("YYYY-MM-DD") parses as UTC midnight, which shifts the date in non-UTC timezones.
export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function calculateCycleTimeStats(
  issues: MetricsIssue[],
  statusCategoryMap: Map<string, string>,
): CycleTimeStats | null {
  const cycleTimes: number[] = [];

  for (const issue of issues) {
    const inProgressDate = getInProgressDate(issue, statusCategoryMap);
    const resolutionDate = issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null;
    if (inProgressDate && resolutionDate) {
      const ct = Math.floor((resolutionDate.getTime() - inProgressDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      cycleTimes.push(ct);
    }
  }

  if (cycleTimes.length === 0) return null;

  cycleTimes.sort((a, b) => a - b);

  return {
    avg: Math.round((cycleTimes.reduce((s, ct) => s + ct, 0) / cycleTimes.length) * 10) / 10,
    median: Math.round(percentile(cycleTimes, 50) * 10) / 10,
    p85: Math.round(percentile(cycleTimes, 85) * 10) / 10,
    count: cycleTimes.length,
    throughput: issues.length,
    samples: cycleTimes,
  };
}

export interface WipItem {
  key: string;
  age: number; // in days
}

export interface WipAgeResult {
  items: WipItem[];
  avgAge: number;
  medianAge: number;
  maxAge: number;
  maxAgeKey: string;
}

export function calculateWipAge(issues: MetricsIssue[], statusCategoryMap: Map<string, string>): WipAgeResult | null {
  const items: WipItem[] = [];

  for (const issue of issues) {
    const inProgressDate = getInProgressDate(issue, statusCategoryMap);
    if (inProgressDate) {
      const age = Math.floor((Date.now() - inProgressDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      items.push({ key: issue.key, age });
    }
  }

  if (items.length === 0) return null;

  const sortedAges = [...items].map((i) => i.age).sort((a, b) => a - b);
  const avgAge = Math.round((sortedAges.reduce((s, a) => s + a, 0) / sortedAges.length) * 10) / 10;
  const medianAge = Math.round(percentile(sortedAges, 50) * 10) / 10;
  const maxItem = items.reduce((max, item) => (item.age > max.age ? item : max));
  return { items, avgAge, medianAge, maxAge: maxItem.age, maxAgeKey: maxItem.key };
}
