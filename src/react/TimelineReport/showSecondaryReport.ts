/**
 * Primary report types whose View Settings expose the Secondary Report Type selector — i.e. the only
 * primaries the secondary Work Breakdown report is meaningful for: the Gantt Chart ('start-due') and
 * the Scatter Plot ('due'). Derived from where `<SecondaryReportType>` is actually rendered
 * (GanttViewSettings / ScatterPlotViewSettings); keep this in sync if that set changes.
 */
export const PRIMARY_REPORT_TYPES_SUPPORTING_SECONDARY = ['start-due', 'due'] as const;

/**
 * Whether the secondary Work Breakdown report should render. It requires BOTH a primary report that
 * supports a secondary AND a `secondaryReportType` that maps to a Work Breakdown view ('status' or
 * 'breakdown'). Gating on the primary matters because a URL can carry a stale
 * `secondaryReportType=status` after switching to a primary that has no secondary (e.g.
 * `estimate-analysis`) — without this check the Work Breakdown would render orphaned below it.
 */
export function showSecondaryReport(
  primaryReportType: string | undefined,
  secondaryReportType: string | undefined,
): boolean {
  const primarySupportsSecondary = (PRIMARY_REPORT_TYPES_SUPPORTING_SECONDARY as readonly string[]).includes(
    primaryReportType ?? '',
  );

  return primarySupportsSecondary && (secondaryReportType === 'status' || secondaryReportType === 'breakdown');
}
