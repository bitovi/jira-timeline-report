import { useRouteData } from '../../../../../hooks/useRouteData';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';
import { useReportOnLevelFilter } from '../useLevelFilter';

/**
 * The primary Filters control's filter rows. Reads the Report on level's effective filter, which
 * falls back to `routeData.effectiveFilterRows` — itself seeded from the legacy `statusesToShow`/
 * `statusesToRemove` params when `filterRows` is empty/unset — so old bookmarks and saved reports
 * keep filtering without the user having to do anything. Writes go to the raw `filterRows` param,
 * or to `levelFilters` once the Filters panel has written this level.
 */
export const useFilterRows = () => {
  const { filter, hasOwnEntry, setFilter } = useReportOnLevelFilter();
  const [, setLegacyFilterRows] = useRouteData<FilterRow[]>('filterRows');

  return {
    filterRows: filter.rows ?? [],
    setFilterRows: (rows: FilterRow[]) => (hasOwnEntry ? setFilter({ ...filter, rows }) : setLegacyFilterRows(rows)),
  };
};
