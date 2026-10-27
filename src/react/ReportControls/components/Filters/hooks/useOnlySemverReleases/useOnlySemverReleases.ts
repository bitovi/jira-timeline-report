import { useRouteData } from '../../../../../hooks/useRouteData';
import { useReportOnLevelFilter } from '../useLevelFilter';

export const useShowOnlySemverReleases = () => {
  const { filter, hasOwnEntry, setFilter } = useReportOnLevelFilter();
  const [, setLegacy] = useRouteData<boolean>('showOnlySemverReleases');

  return {
    showOnlySemverReleases: !!filter.showOnlySemverReleases,
    setShowOnlySemverReleases: (showOnlySemverReleases: boolean) =>
      hasOwnEntry ? setFilter({ ...filter, showOnlySemverReleases }) : setLegacy(showOnlySemverReleases),
  };
};
