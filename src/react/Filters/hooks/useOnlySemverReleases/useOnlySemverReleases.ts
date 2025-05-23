import { value } from '../../../../can';
import routeData from '../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../hooks/useCanObservable';

export const useShowOnlySemverReleases = () => {
  const showOnlySemverReleases = useCanObservable<boolean>(value.from(routeData, 'showOnlySemverReleases'));

  const setShowOnlySemverReleases = (newShowOnlySemverReleases: boolean) => {
    // @ts-expect-error
    routeData.showOnlySemverReleases = newShowOnlySemverReleases;
  };

  return { showOnlySemverReleases, setShowOnlySemverReleases };
};
