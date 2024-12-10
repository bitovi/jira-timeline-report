import { useEffect, useState } from 'react';
import { pushStateObservable } from '../../shared/state-storage';

export const useJiraStateValue:
  (key: string) => [string | undefined, (val: string | undefined) => void] =
  (key) => {
    const [value, setValue] = useState<string | undefined>(pushStateObservable.get(key));
    useEffect(() => {
      const handler = (newVal?: string) => {
        setValue(newVal);
      };

      pushStateObservable.on(key, handler);

      const setValue = (val: string | undefined) => pushStateObservable.set(key, val);

      return () => pushStateObservable.off(key, handler);
    }, []);

    return [value, setValue];
  };

export const useJiraState:
  () => [Record<string, string | null>, (val: Record<string, string | null>) => void] =
  () => {
    const [value, setValue] = useState<Record<string, string | null>>((pushStateObservable.get(undefined) ?? {}));
    useEffect(() => {
      const handler = (newVal: Record<string, string | null>) => {
        setValue(newVal ?? {});
      };

      pushStateObservable.on(undefined, handler);

      const setValue = (val: Record<string, string | null>) => pushStateObservable.set(val);

      return () => pushStateObservable.off(undefined, handler);
    }, []);

    return [value, setValue];
  };

