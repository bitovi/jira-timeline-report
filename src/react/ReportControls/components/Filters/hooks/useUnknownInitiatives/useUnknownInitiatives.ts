import { useRouteData } from '../../../../../hooks/useRouteData';

export const useUnknownInitiatives = () => {
  const [hideUnknownInitiatives, setHideUnknownInitiatives] = useRouteData<boolean>('hideUnknownInitiatives');

  return { hideUnknownInitiatives, setHideUnknownInitiatives };
};
