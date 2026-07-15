import { useRouteData } from '../../../../../hooks/useRouteData';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';

/**
 * A second, independent filter-row state for the Work Breakdown report, scoped to the CHILD
 * issue type shown within each card. Decides which children (if any) render within an already-
 * shown card — doesn't affect whether the card itself shows (that's `useSecondaryFilterRows`).
 */
export const useSecondaryChildFilterRows = () => {
  const [filterRows, setFilterRows] = useRouteData<FilterRow[]>('secondaryChildFilterRows');

  return {
    filterRows: filterRows ?? [],
    setFilterRows,
  };
};
