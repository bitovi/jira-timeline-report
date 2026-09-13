import type { StatsUIData } from '../scheduler/stats-analyzer';

export type CriticalPathEpicRow = {
  key: string;
  summary: string;
  url: string;
  teamName: string;
  /** Average days this epic contributed to the critical path. Sums to the path length. */
  daysAdded: number;
  /** Fraction of simulation runs in which this epic was on the critical path. */
  onPathIndex: number;
};

/**
 * Ranks by days added rather than by `onPathIndex`, because the percentage is size-blind: a short
 * epic that is always on the path would outrank a long one that is usually on it, while being
 * worth far less to shorten. See spec/024-critical-path/mockups/earliest-finish.html section 4.
 */
export function buildCriticalPathEpics(uiData: StatsUIData): CriticalPathEpicRow[] {
  return uiData.simulationIssueResults
    .map((result) => ({
      key: result.linkedIssue.key,
      summary: result.linkedIssue.summary,
      url: result.linkedIssue.url,
      teamName: result.linkedIssue.team.name,
      daysAdded: result.sequencingDaysAdded,
      onPathIndex: result.sequencingCriticalityIndex,
    }))
    .sort((a, b) => (b.daysAdded !== a.daysAdded ? b.daysAdded - a.daysAdded : a.key < b.key ? -1 : 1));
}
