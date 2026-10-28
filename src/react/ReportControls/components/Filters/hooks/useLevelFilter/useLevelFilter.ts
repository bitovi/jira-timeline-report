import { useRouteData } from '../../../../../hooks/useRouteData';
import {
  type LevelFilter,
  type LevelFilters,
  type LevelKey,
} from '../../../../../../jira/rollup/filter-rows/level-filters';

const EMPTY_FILTER: LevelFilter = { rows: [] };

/**
 * One level's entry in `levelFilters` (spec/043-filters-redesign). `filter` is the effective value,
 * so a level that has no entry yet shows its legacy fallback; the first edit writes its own entry.
 */
export const useLevelFilter = (key: LevelKey | undefined) => {
  const [levelFilters, setLevelFilters] = useRouteData<LevelFilters | undefined>('levelFilters');
  const [effectiveLevelFilters] = useRouteData<LevelFilters | undefined>('effectiveLevelFilters');

  const filter = (key && effectiveLevelFilters?.[key]) || EMPTY_FILTER;

  const setFilter = (next: LevelFilter) => {
    if (!key) {
      return;
    }
    setLevelFilters({ ...(levelFilters ?? {}), [key]: next });
  };

  return { filter, setFilter };
};
