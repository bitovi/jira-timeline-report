import { useRouteData } from '../../../../../hooks/useRouteData';
import { getDateRangePresets } from '../../components/DateRangeFilter/quarterPresets';
import { useReportOnLevelFilter } from '../useLevelFilter';

/**
 * "Due date range" filter for the Report on level — reads the level's effective range, which falls
 * back to the `scatterDateRangeStart` / `scatterDateRangeEnd` route params (ISO `YYYY-MM-DD`
 * strings, empty = unbounded). Despite the `scatter*` param names (kept for URL/back-compat), this
 * is shared by the Scatter Plot and Gantt Chart reports. Writes go to `levelFilters` once the
 * Filters panel has written this level.
 */
export const useDateRangeFilter = () => {
  const { filter, hasOwnEntry, setFilter } = useReportOnLevelFilter();
  const [, setLegacyStart] = useRouteData<string>('scatterDateRangeStart');
  const [, setLegacyEnd] = useRouteData<string>('scatterDateRangeEnd');

  const dateRangeStart = filter.dueDateStart ?? '';
  const dateRangeEnd = filter.dueDateEnd ?? '';

  const setRange = (start: string, end: string) => {
    if (hasOwnEntry) {
      setFilter({ ...filter, dueDateStart: start || undefined, dueDateEnd: end || undefined });
    } else {
      setLegacyStart(start);
      setLegacyEnd(end);
    }
  };

  return {
    dateRangeStart,
    setDateRangeStart: (start: string) => setRange(start, dateRangeEnd),
    dateRangeEnd,
    setDateRangeEnd: (end: string) => setRange(dateRangeStart, end),
    clearDateRange: () => setRange('', ''),
    applyPreset: (from: string, to: string) => setRange(from, to),
    presets: getDateRangePresets(),
  };
};
