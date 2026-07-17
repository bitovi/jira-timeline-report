/**
 * Minimal issue/release shape the Estimation Table report reads.
 *
 * Ports the (untyped) fields that [table-grid.js](src/canjs/reports/table-grid.js) accessed off the
 * rolled-up issue objects. The runtime objects are the same fully rolled-up issues every report
 * consumes; this is just the narrow slice this report touches. `issueLastPeriod` is the prior-period
 * snapshot the "last ➡ current" diff formatting compares against, so it is (recursively) the same shape.
 */
export interface EstimationTeam {
  pointsPerDayPerTrack?: number;
  velocity?: number;
  daysPerSprint?: number;
  parallelWorkLimit?: number;
}

export interface EstimationDerivedTiming {
  isStoryPointsMedianValid?: boolean;
  isStoryPointsValid?: boolean;
  isConfidenceValid?: boolean;
  deterministicTotalDaysOfWork?: number;
  storyPointsDaysOfWork?: number;
  datesDaysOfWork?: number;
  deterministicTotalPoints?: number;
  usedConfidence?: number;
}

export interface EstimationIssue {
  key: string;
  summary: string;
  type?: string;
  url?: string;
  storyPointsMedian?: number;
  team?: EstimationTeam | null;
  derivedTiming?: EstimationDerivedTiming;
  completionRollup?: { totalWorkingDays?: number };
  reportingHierarchy: { childKeys: string[] };
  /** Raw Jira issue, only read for its issue-type icon. */
  issue?: { fields?: { 'Issue Type'?: { iconUrl?: string } } };
  issueLastPeriod?: EstimationIssue | null;
}

/** One flattened, depth-tagged row of the recursive issue table. */
export interface TableRow {
  depth: number;
  issue: EstimationIssue;
}
