export { calculatePositionPercentages } from './positioning';
export {
  intersect,
  packIssuesIntoRows,
  packIssuesIntoRowsWithSides,
  sortIssuesByLeftPosition,
  filterIssuesWithDates,
  partitionIssuesByDate,
} from './collision';
export type { LabelSide, SidePackBounds } from './collision';
export { computeDateRange, filterIssuesByDateRange, parseISODateRangeBoundary } from './dateRange';
export type { DateRangeFilter } from './dateRange';
export { computePlottedIssues } from './plotting';
export type { PlotConfig } from './plotting';
export { computeOccupiedDateExtent } from './trimRange';
// getStatusColorClass/getStatusLabel/countIssuesByStatus/STATUS_LEGEND_ORDER, shouldUseDensityOptimizations,
// groupIssues/GroupByOption/IssueGroup, calculateTodayMargin, computeGridColumnCSS moved to
// ../shared/timeline (Phase 0 of the gantt-rewrite plan) — import them from there directly.
