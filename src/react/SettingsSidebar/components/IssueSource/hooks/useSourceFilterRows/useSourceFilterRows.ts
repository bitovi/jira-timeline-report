import type { SourceFilterRow } from '../../../../../../jira/rollup/filter-rows/source-filter-rows';

import routeData from '../../../../../../canjs/routing/route-data';
import { useRouteData } from '../../../../../hooks/useRouteData';

/**
 * The Sources panel's "Filter loaded issues" rules. They only filter issues already loaded (no Jira
 * request), so each change is written straight to route data, like the report Filters' rows.
 *
 * Reads `effectiveSourceFilterRows`, so a legacy `statusesToExclude` shows up as a `Status · is not`
 * rule. Writes go to `sourceFilterRows` and clear the legacy param, so deleting every rule on an old
 * report really removes its filter.
 */
export const useSourceFilterRows = () => {
  const [effectiveSourceFilterRows] = useRouteData<SourceFilterRow[]>('effectiveSourceFilterRows');

  const setSourceFilterRows = (rows: SourceFilterRow[]) => {
    routeData.assign({ sourceFilterRows: rows, statusesToExclude: [] });
  };

  return {
    sourceFilterRows: effectiveSourceFilterRows ?? [],
    setSourceFilterRows,
  };
};
