import { value } from '../../../../can';
import routeData from '../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../hooks/useCanObservable';

export const useUnknownInitiatives = () => {
  const hideUnknownInitiatives = useCanObservable<boolean>(value.from(routeData, 'hideUnknownInitiatives'));

  const setHideUnknownInitiatives = (newHideUnknownInitiatives: boolean) => {
    // @ts-expect-error
    routeData.hideUnknownInitiatives = newHideUnknownInitiatives;
  };

  return { hideUnknownInitiatives, setHideUnknownInitiatives };
};
