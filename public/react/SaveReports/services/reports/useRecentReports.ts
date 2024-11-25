import { Dispatch, SetStateAction, useState } from "react";

const useLocalStorage = <TData = string>(
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

const getReportKey = () => {
  const base = "local-reports";

  if (window.env?.JIRA_APP_KEY) {
    return window.env.JIRA_APP_KEY + "-" + base;
  }

  return window.localStorage.getItem("scopeId") + "-" + base;
};

export const useRecentReports = () => {
  const [recentReports, setRecentReports] = useLocalStorage(getReportKey(), {
    deserialize: (value) => {
      if (!value) {
        return [];
      }
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed)) {
        console.warn("Ran into an unexpected value deserializing local-reports");
        return [];
      }

      return parsed as string[];
    },
  });

  const addReportToRecents = (newReportId: string) => {
    setRecentReports((current) => {
      return [newReportId, ...current.filter((id) => id !== newReportId)];
    });
  };

  return { recentReports, addReportToRecents };
};
