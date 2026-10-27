import { useRouteData } from '../../../../../hooks/useRouteData';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';
import { useChildLevelKey, useLevelFilter } from '../useLevelFilter';

/**
 * Filter-row state for the Cards report, scoped to the CHILD issue type shown within each card.
 * Decides which children (if any) render within an already-shown card — it doesn't affect whether
 * the card itself shows. That is the primary `filterRows`, which narrows the issues every report on
 * the page is built from.
 *
 * Reads the child level's effective filter (falling back to `cardsChildFilterRows`), and writes to
 * `levelFilters` once the Filters panel has written that level.
 *
 * Replaces `useSecondaryChildFilterRows`, from when Cards was the secondary slot's report and had a
 * second filter list of its own. See spec/018-card-report/alt-plan.md.
 */
export const useCardsChildFilterRows = () => {
  const { filter, hasOwnEntry, setFilter } = useLevelFilter(useChildLevelKey());
  const [, setLegacyFilterRows] = useRouteData<FilterRow[]>('cardsChildFilterRows');

  return {
    filterRows: filter.rows ?? [],
    setFilterRows: (rows: FilterRow[]) => (hasOwnEntry ? setFilter({ ...filter, rows }) : setLegacyFilterRows(rows)),
  };
};
