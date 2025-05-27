import { useState } from 'react';
import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';

export type CompareTo = number;
export type SetCompareToArg = number | string;
export type SetCompareTo = SetRouteData<SetCompareToArg>;

export const useCompareTo = (): readonly [CompareTo, SetCompareTo] => {
  return useRouteData<CompareTo, SetCompareToArg>('compareTo');

  // TODO: delete this temp code
  // const [value, setValue] = useState(0);

  // return [value, (value: number | string) => {
  //   return +value;
  // }];
};
