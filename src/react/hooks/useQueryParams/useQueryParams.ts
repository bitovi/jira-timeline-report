import type { CanObservable } from '../useCanObservable';

import { useEffect } from 'react';
import { useCanObservable } from '../useCanObservable';

export const useQueryParams = (
  queryParamObservable: CanObservable<string>,
  config?: { onChange: (params: URLSearchParams) => void },
) => {
  const queryParamString = useCanObservable(queryParamObservable);

  useEffect(() => {
    const params = new URLSearchParams(queryParamString);

    config?.onChange(params);
  }, [queryParamString]);

  return { queryParamString, queryParams: new URLSearchParams(queryParamString) };
};
