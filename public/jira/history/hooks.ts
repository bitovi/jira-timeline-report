import { useEffect, useState } from 'react';
import routeDataObservable, { pushStateObservable } from '@routing-observable';

export const useHistoryStateValue:
  (key: string) => [string | undefined, (val: string | undefined) => void] =
  (key) => {
    const [value, setValue] = useState<string | undefined>(routeDataObservable.get(key));
    useEffect(() => {
      const handler = (newVal?: string) => {
        setValue(newVal);
      };

      routeDataObservable.on(key, handler);

      return () => routeDataObservable.off(key, handler);
    }, []);

    const exportSetValue = (val: string | undefined) => routeDataObservable.set(key, val ?? null);
    return [value, exportSetValue];
  };

export const useHistoryState:
  () => [Record<string, string | null>, (val: Record<string, string | null>) => void] =
  () => {
    const [value, setValue] = useState<Record<string, string | null>>((routeDataObservable.get() ?? {}));
    useEffect(() => {
      const handler = (newVal: Record<string, string | null>) => {
        setValue(newVal ?? {});
      };

      routeDataObservable.on(undefined, handler);

      return () => routeDataObservable.off(undefined, handler);
    }, []);

    const exportSetValue = (val: Record<string, string | null>) => routeDataObservable.set(val);
    return [value, exportSetValue];
  };

export const useHistoryParams:
  () => [string, (val: string) => void] =
  () => {
    const [value, setValue] = useState<string>(pushStateObservable.value);
    useEffect(() => {
      const handler = () => {
        setValue(pushStateObservable.value);
      };

      routeDataObservable.on(handler);

      return () => routeDataObservable.off(handler);
    }, []);

    const exportSetValue = (val: string) => pushStateObservable.set(val);
    return [value, setValue];
  };


export const useHistoryValueCallback:
  (key: string, callback: (newVal: string | undefined) => void) => void =
  (key, callback) => {
    useEffect(() => {
      routeDataObservable.on(key, callback);
      return () => routeDataObservable.off(key, callback);
    }, [key, callback]);
  };

export const useHistoryCallback:
  (callback: (newVal: Record<string, string>) => void) => void =
  (callback) => {
    useEffect(() => {
      routeDataObservable.on(undefined, callback);
      return () => routeDataObservable.off(undefined, callback);
    }, [callback]);
  };

