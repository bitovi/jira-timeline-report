import { useRouteData } from '../../../../../hooks/useRouteData';
import {
  ALL_LEVELS,
  countActiveFilters,
  RELEASE_LEVEL,
  type HierarchyLevel,
  type LevelFilters,
  type LevelKey,
} from '../../../../../../jira/rollup/filter-rows/level-filters';

export interface FilterTab {
  key: LevelKey;
  /** "All items", "Releases", or the pluralized level name ("Epics", "Stories"). */
  label: string;
  /** Active filters on this tab, for the badge. */
  count: number;
}

/** "Epic" → "Epics", "Story" → "Stories", "Release" → "Releases". */
export const pluralize = (name: string) => {
  if (/[^aeiou]y$/i.test(name)) {
    return name.slice(0, -1) + 'ies';
  }
  if (/(s|x|z|ch|sh)$/i.test(name)) {
    return name + 'es';
  }
  return name + 's';
};

/** All items, then Releases when reporting on releases, then every loaded level top to bottom. */
export const useFilterTabs = (): FilterTab[] => {
  const [issueHierarchy] = useRouteData<HierarchyLevel[] | null>('issueHierarchy');
  const [primaryIssueType] = useRouteData<string | undefined>('primaryIssueType');
  const [effectiveLevelFilters] = useRouteData<LevelFilters | undefined>('effectiveLevelFilters');

  const count = (key: LevelKey) => countActiveFilters(effectiveLevelFilters?.[key]);

  return [
    { key: ALL_LEVELS, label: 'All items', count: count(ALL_LEVELS) },
    ...(primaryIssueType === RELEASE_LEVEL
      ? [{ key: RELEASE_LEVEL, label: pluralize(RELEASE_LEVEL), count: count(RELEASE_LEVEL) }]
      : []),
    ...(issueHierarchy ?? []).map(({ name }) => ({ key: name, label: pluralize(name), count: count(name) })),
  ];
};
