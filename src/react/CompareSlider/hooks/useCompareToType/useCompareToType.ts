import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';

export type CompareToType = 'date' | 'seconds';
export type SetCompareToType = SetRouteData<CompareToType>;

export const useCompareToType = (): readonly [CompareToType, SetCompareToType] =>
  useRouteData<CompareToType>('compareToType');
