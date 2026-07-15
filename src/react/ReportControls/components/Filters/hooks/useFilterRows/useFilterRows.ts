import { useRouteData } from '../../../../../hooks/useRouteData';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';

/**
 * The primary Filters control's filter rows. Reads `routeData.effectiveFilterRows`, which
 * transparently seeds an equivalent `Jira Status` row from the legacy `statusesToShow`/
 * `statusesToRemove` params the first time `filterRows` itself is empty/unset — so old bookmarks
 * and saved reports keep filtering without the user having to do anything. Writes always go to
 * the raw `filterRows` param.
 */
export const useFilterRows = () => {
  const [effectiveFilterRows] = useRouteData<FilterRow[]>('effectiveFilterRows');
  const [, setFilterRows] = useRouteData<FilterRow[]>('filterRows');

  return {
    filterRows: effectiveFilterRows ?? [],
    setFilterRows,
  };
};
