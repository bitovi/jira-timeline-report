import { useRouteData } from '../../../../../hooks/useRouteData';
import type { CanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { STATUS_LEGEND_ORDER, getStatusLabel } from '../../../../../reports/WorkBreakdown/helpers';
import {
  levelScope,
  RELEASE_LEVEL,
  type HierarchyLevel,
  type LevelKey,
} from '../../../../../../jira/rollup/filter-rows/level-filters';
import type { MinimalRollupIssue } from '../useSelectableRollupStatuses';

export interface MinimalLevelIssue extends MinimalRollupIssue {
  status?: string | null;
  hierarchyLevel?: number;
}

type Option = { label: string; value: string };

const NEWLY_FIELDS = [
  { value: 'newlyStarted', label: 'Newly started' },
  { value: 'newlyCompleted', label: 'Newly completed' },
  { value: 'newlyDated', label: 'Newly dated' },
] as const;

const emptyIssuesObs = {
  value: [],
  getData: () => [],
  get: () => [],
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
} as unknown as CanObservable<MinimalLevelIssue[]>;

/** The route-data slice that decides which issues a tab covers. */
const useScope = (key: LevelKey) => {
  const [primaryIssueType] = useRouteData<string | undefined>('primaryIssueType');
  const [secondaryIssueType] = useRouteData<string | undefined>('secondaryIssueType');
  const [issueHierarchy] = useRouteData<HierarchyLevel[] | null>('issueHierarchy');
  return levelScope(key, { primaryIssueType, secondaryIssueType, issueHierarchy });
};

const inScope = (issue: MinimalLevelIssue, scope: ReturnType<typeof levelScope>) =>
  issue.type === RELEASE_LEVEL
    ? scope.includesReleases
    : issue.hierarchyLevel != null && scope.hierarchyLevels.has(issue.hierarchyLevel);

/** `"value (count)"` options in first-seen order. */
const countedOptions = (values: string[]): Option[] => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ label: `${value} (${count})`, value }));
};

/**
 * Jira statuses with counts for one tab, from `derivedIssues` at that tab's levels (generalizes
 * `useSelectableStatuses`). Releases have no status of their own, so the Releases tab lists the
 * statuses of the level under it, which is what a release is matched on.
 */
export const useLevelStatusOptions = (key: LevelKey): Option[] => {
  const [derivedIssues] = useRouteData<MinimalLevelIssue[] | undefined>('derivedIssues');
  const [secondaryIssueType] = useRouteData<string | undefined>('secondaryIssueType');
  const scope = useScope(key === RELEASE_LEVEL ? (secondaryIssueType ?? key) : key);

  return countedOptions(
    (derivedIssues ?? [])
      .filter((issue) => inScope(issue, scope))
      .map(({ status }) => status)
      .filter((status): status is string => !!status),
  );
};

/**
 * Rollup Status options for one tab, from the rolled-up issues (generalizes
 * `useSelectableRollupStatuses`). Empty above Report on: those levels aren't rolled up, so the field
 * isn't offered there.
 */
export const useLevelRollupStatusOptions = (key: LevelKey, issuesObs?: CanObservable<MinimalLevelIssue[]>) => {
  const issues = useCanObservable(issuesObs ?? emptyIssuesObs);
  const scope = useScope(key);
  if (scope.isAbove) {
    return [];
  }

  const statusCounts: Record<string, number> = {};
  const newlyCounts: Record<string, number> = { newlyStarted: 0, newlyCompleted: 0, newlyDated: 0 };
  for (const issue of (issues ?? []).filter((issue) => inScope(issue, scope))) {
    const rollup = issue.rollupStatuses?.rollup;
    if (rollup?.status) {
      statusCounts[rollup.status] = (statusCounts[rollup.status] ?? 0) + 1;
    }
    for (const { value } of NEWLY_FIELDS) {
      if (rollup?.[value]) {
        newlyCounts[value]++;
      }
    }
  }

  return [
    ...STATUS_LEGEND_ORDER.filter((status) => statusCounts[status] > 0).map((status) => ({
      label: `${getStatusLabel(status)} (${statusCounts[status]})`,
      value: status,
    })),
    ...NEWLY_FIELDS.map(({ value, label }) => ({ label: `${label} (${newlyCounts[value]})`, value })),
  ];
};

/** The distinct issue types at one tab's levels, with counts. */
export const useLevelIssueTypeOptions = (key: LevelKey, issuesObs?: CanObservable<MinimalLevelIssue[]>) => {
  const [derivedIssues] = useRouteData<MinimalLevelIssue[] | undefined>('derivedIssues');
  const rolledUp = useCanObservable(issuesObs ?? emptyIssuesObs);
  const scope = useScope(key);

  // Releases only exist in the rolled-up list; every issue is in `derivedIssues`.
  const releases = scope.includesReleases ? (rolledUp ?? []).filter(({ type }) => type === RELEASE_LEVEL) : [];
  const issues = (derivedIssues ?? []).filter((issue) => inScope(issue, scope));

  return countedOptions([...releases, ...issues].map(({ type }) => type).filter((type): type is string => !!type));
};
