import { useRouteData } from '../../../../../hooks/useRouteData';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';

/**
 * The secondary (Work Breakdown) report's own filter rows — independent route-persisted state
 * from the primary `filterRows`. No legacy migration needed, this param is new.
 */
export const useSecondaryFilterRows = () => {
  const [filterRows, setFilterRows] = useRouteData<FilterRow[]>('secondaryFilterRows');

  return {
    filterRows: filterRows ?? [],
    setFilterRows,
  };
};
