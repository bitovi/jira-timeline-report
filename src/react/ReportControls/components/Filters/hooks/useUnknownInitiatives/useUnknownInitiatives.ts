import { useRouteData } from '../../../../../hooks/useRouteData';
import { useReportOnLevelFilter } from '../useLevelFilter';

export const useUnknownInitiatives = () => {
  const { filter, hasOwnEntry, setFilter } = useReportOnLevelFilter();
  const [, setLegacy] = useRouteData<boolean>('hideUnknownInitiatives');

  return {
    hideUnknownInitiatives: !!filter.hideWithoutDates,
    setHideUnknownInitiatives: (hideWithoutDates: boolean) =>
      hasOwnEntry ? setFilter({ ...filter, hideWithoutDates }) : setLegacy(hideWithoutDates),
  };
};
