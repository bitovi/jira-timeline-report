import { groupIssues, type IssueGroup } from '../../../shared/timeline/helpers/groupIssues';
import type { GanttRow, GroupHeader, GroupByOption, IssueOrRelease } from '../types';

/**
 * Recursively expand the hierarchy into rows, honoring per-key expand state.
 *
 * Replaces gantt-grid.js's `makeGetRows`.
 */
export const flattenIssueRows = (
  issues: IssueOrRelease[],
  isExpanded: (key: string) => boolean,
  getChildren: (issue: IssueOrRelease) => IssueOrRelease[],
  depth = 0,
): GanttRow[] =>
  issues.flatMap((issue) => {
    const showing = isExpanded(issue.key);
    const row: GanttRow = { type: 'issue', issue, isShowingChildren: showing, depth };
    return showing ? [row, ...flattenIssueRows(getChildren(issue), isExpanded, getChildren, depth + 1)] : [row];
  });

export interface BuildGanttRowsConfig {
  primaryIssues: IssueOrRelease[];
  allIssues: IssueOrRelease[];
  groupBy: GroupByOption;
  primaryIssueType: string;
  isExpanded: (key: string) => boolean;
  getChildren: (issue: IssueOrRelease) => IssueOrRelease[];
}

/**
 * Map an `IssueGroup` to the minimal `GroupHeader` a group row needs.
 *
 * `status` drives the legacy label tint (`specialStatusTextClass`) and is non-null only for
 * `'parent'` grouping, where `group.parent` is populated (plan §Known issues #6).
 */
export const toGroupHeader = (group: Pick<IssueGroup, 'key' | 'title' | 'parent'>): GroupHeader => ({
  key: group.key,
  summary: group.title ?? group.key,
  status: group.parent?.rollupStatuses?.rollup?.status ?? null,
  parent: (group.parent as IssueOrRelease | undefined) ?? null,
});

/**
 * Top-level row assembly — apply grouping (or not), then flatten each group.
 *
 * Replaces the four branches of gantt-grid.js's `gridRowData` + `getSortedParents`.
 */
export const buildGanttRows = (cfg: BuildGanttRowsConfig): GanttRow[] => {
  const grouped = cfg.groupBy !== '' && cfg.primaryIssueType !== 'Release';
  if (!grouped) {
    return flattenIssueRows(cfg.primaryIssues, cfg.isExpanded, cfg.getChildren);
  }
  const groups = groupIssues(cfg.primaryIssues, cfg.allIssues, cfg.groupBy);
  return groups.flatMap((g) => [
    { type: 'group', issue: toGroupHeader(g), depth: 0 } as GanttRow,
    ...flattenIssueRows(g.issues, cfg.isExpanded, cfg.getChildren),
  ]);
};
