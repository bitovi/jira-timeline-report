import { groupIssues, type IssueGroup, type AncestorRef } from '../../../shared/timeline/helpers/groupIssues';
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
  /**
   * The full, unfiltered-by-hierarchy issue set — used as a fallback ancestor lookup for
   * `'parent'`/`'grandparent'` grouping when an ancestor falls outside `allIssues`'s
   * primary-type-and-below scope (see `groupIssues`'s doc comment). Optional; defaults to none.
   */
  allDerivedIssues?: AncestorRef[];
  groupBy: GroupByOption;
  primaryIssueType: string;
  isExpanded: (key: string) => boolean;
  getChildren: (issue: IssueOrRelease) => IssueOrRelease[];
}

/**
 * Map an `IssueGroup` to the minimal `GroupHeader` a group row needs.
 *
 * `status` drives the legacy label tint (`specialStatusTextClass`) and is non-null only for
 * `'parent'`/`'grandparent'` grouping, where `group.parent` is populated (plan §Known issues #6).
 *
 * `group.parent` may be a minimal `AncestorRef` (e.g. resolved only via the `allDerivedIssues`
 * fallback for an ancestor outside `allIssues`'s scope) rather than a full rolled-up
 * `IssueOrRelease` — `GroupRow`'s clickable `IssueTooltip` needs the latter, so `parent` is only
 * populated here when a `rollupStatuses` is present (i.e. it's a genuine rolled-up issue).
 */
export const toGroupHeader = (group: Pick<IssueGroup, 'key' | 'title' | 'parent'>): GroupHeader => ({
  key: group.key,
  summary: group.title ?? group.key,
  status: group.parent?.rollupStatuses?.rollup?.status ?? null,
  parent: group.parent?.rollupStatuses ? (group.parent as IssueOrRelease) : null,
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
  const groups = groupIssues(cfg.primaryIssues, cfg.allIssues, cfg.groupBy, undefined, cfg.allDerivedIssues ?? []);
  return groups.flatMap((g) => [
    { type: 'group', issue: toGroupHeader(g), depth: 0 } as GanttRow,
    ...flattenIssueRows(g.issues, cfg.isExpanded, cfg.getChildren),
  ]);
};
