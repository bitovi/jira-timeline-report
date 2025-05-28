import { SetRouteData, useRouteData } from '../../../../../hooks/useRouteData';

export type CompareTo = number;
export type SetCompareToArg = number | string;
export type SetCompareTo = SetRouteData<SetCompareToArg>;

export const useCompareTo = (): readonly [CompareTo, SetCompareTo] =>
  useRouteData<CompareTo, SetCompareToArg>('compareTo');
