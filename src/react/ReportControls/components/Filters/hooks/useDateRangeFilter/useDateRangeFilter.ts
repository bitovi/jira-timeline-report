import { useRouteData } from '../../../../../hooks/useRouteData';
import { getDateRangePresets } from '../../components/DateRangeFilter/quarterPresets';

/**
 * "Due date range" filter — reads/writes the `scatterDateRangeStart` / `scatterDateRangeEnd`
 * route params (ISO `YYYY-MM-DD` strings, empty = unbounded). Despite the `scatter*` param
 * names (kept for URL/back-compat), this is shared by the Scatter Plot and Gantt Chart reports.
 */
export const useDateRangeFilter = () => {
  const [dateRangeStart, setDateRangeStart] = useRouteData<string>('scatterDateRangeStart');
  const [dateRangeEnd, setDateRangeEnd] = useRouteData<string>('scatterDateRangeEnd');

  const clearDateRange = () => {
    setDateRangeStart('');
    setDateRangeEnd('');
  };

  const applyPreset = (from: string, to: string) => {
    setDateRangeStart(from);
    setDateRangeEnd(to);
  };

  return {
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    clearDateRange,
    applyPreset,
    presets: getDateRangePresets(),
  };
};
