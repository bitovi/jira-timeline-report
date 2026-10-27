import { useRouteData } from '../../../../../hooks/useRouteData';
import {
  childLevelKey,
  type HierarchyLevel,
  type LevelFilter,
  type LevelFilters,
  type LevelKey,
} from '../../../../../../jira/rollup/filter-rows/level-filters';

const EMPTY_FILTER: LevelFilter = { rows: [] };

/**
 * One level's entry in `levelFilters` (spec/043-filters-redesign). `filter` is the effective value,
 * so a level that has no entry yet shows its legacy fallback. `hasOwnEntry` tells the legacy
 * dropdown hooks whether to write here or to their old params.
 */
export const useLevelFilter = (key: LevelKey | undefined) => {
  const [levelFilters, setLevelFilters] = useRouteData<LevelFilters | undefined>('levelFilters');
  const [effectiveLevelFilters] = useRouteData<LevelFilters | undefined>('effectiveLevelFilters');

  const filter = (key && effectiveLevelFilters?.[key]) || EMPTY_FILTER;
  const hasOwnEntry = !!key && !!levelFilters?.[key];

  const setFilter = (next: LevelFilter) => {
    if (!key) {
      return;
    }
    setLevelFilters({ ...(levelFilters ?? {}), [key]: next });
  };

  return { filter, hasOwnEntry, setFilter };
};

/** The Report on level's key: its type name, or `'Release'`. */
export const useReportOnLevelKey = (): LevelKey | undefined => {
  const [primaryIssueType] = useRouteData<string | undefined>('primaryIssueType');
  return primaryIssueType || undefined;
};

/** The key of the level directly below Report on (the Cards children). */
export const useChildLevelKey = (): LevelKey | undefined => {
  const [primaryIssueType] = useRouteData<string | undefined>('primaryIssueType');
  const [secondaryIssueType] = useRouteData<string | undefined>('secondaryIssueType');
  const [issueHierarchy] = useRouteData<HierarchyLevel[] | null>('issueHierarchy');
  return childLevelKey({ primaryIssueType, secondaryIssueType, issueHierarchy });
};

/**
 * The legacy dropdown's read/write rule: read the Report on level's effective filter; write to the
 * level's `levelFilters` entry once the panel has created one, otherwise to the old param.
 */
export const useReportOnLevelFilter = () => useLevelFilter(useReportOnLevelKey());
