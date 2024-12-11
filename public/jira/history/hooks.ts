import { useEffect, useState } from 'react';
import routeDataObservable from '@routing-observable';

export const useJiraStateValue:
  (key: string) => [string | undefined, (val: string | undefined) => void] =
  (key) => {
    const [value, setValue] = useState<string | undefined>(routeDataObservable.get(key));
    useEffect(() => {
      const handler = (newVal?: string) => {
        setValue(newVal);
      };

      routeDataObservable.on(key, handler);

      const setValue = (val: string | undefined) => routeDataObservable.set(key, val ?? null);

      return () => routeDataObservable.off(key, handler);
    }, []);

    return [value, setValue];
  };

export const useJiraState:
  () => [Record<string, string | null>, (val: Record<string, string | null>) => void] =
  () => {
    const [value, setValue] = useState<Record<string, string | null>>((routeDataObservable.get() ?? {}));
    useEffect(() => {
      const handler = (newVal: Record<string, string | null>) => {
        setValue(newVal ?? {});
      };

      routeDataObservable.on(undefined, handler);

      const setValue = (val: Record<string, string | null>) => routeDataObservable.set(val);

      return () => routeDataObservable.off(undefined, handler);
    }, []);

    return [value, setValue];
  };

