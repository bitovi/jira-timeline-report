import type { Dispatch, SetStateAction } from "react";

import { useState } from "react";

export const useLocalStorage = <TData = string>(
  key: string,
  config?: { serialize?: (data: TData) => string; deserialize?: (value: string) => TData }
) => {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = config ?? {};

  const [value, setValue] = useState(() => deserialize(localStorage.getItem(key) ?? "") as TData);

  const set: Dispatch<SetStateAction<TData>> = (newValue) => {
    try {
      const evaluated = newValue instanceof Function ? newValue(value) : newValue;

      window.localStorage.setItem(key, serialize(evaluated));
      setValue(evaluated);
    } catch (error) {
      console.warn(["Could not set local storage at key " + key].join("\n"));
    }
  };

  return [value, set] as const;
};
