import { useLocalStorage } from "../../hooks/useLocalStorage";

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
        console.warn("Ran into an unexpected value deserializing local-reports", parsed);
        return [];
      }

      return parsed as string[];
    },
  });

  const addReportToRecents = (newReportId: string) => {
    const maxRecentSize = 5;
    setRecentReports((current) => {
      return [newReportId, ...current.filter((id) => id !== newReportId)].slice(0, maxRecentSize);
    });
  };

  return { recentReports, addReportToRecents };
};
