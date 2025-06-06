import { useLocalStorage } from '../../hooks/useLocalStorage';

const maxRecentSize = 5;

const getReportKey = () => {
  const base = 'local-reports';

  if (window.env?.JIRA_APP_KEY) {
    return window.env.JIRA_APP_KEY + '-' + base;
  }

  return window.localStorage.getItem('scopeId') + '-' + base;
};

export const useRecentReports = () => {
  const [recentReports, setRecentReports] = useLocalStorage(getReportKey(), {
    deserialize: (value) => {
      if (!value) {
        return [];
      }
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed)) {
        console.warn('Ran into an unexpected value deserializing local-reports', parsed);
        return [];
      }

      return parsed as string[];
    },
  });

  const addReportToRecents = (newReportId: string) => {
    setRecentReports((current) => {
      return [newReportId, ...current.filter((id) => id !== newReportId)].slice(0, maxRecentSize);
    });
  };

  const removeFromRecentReports = (reportId: string) => {
    setRecentReports((current) => {
      return current.filter((id) => id !== reportId);
    });
  };

  return { recentReports, addReportToRecents, removeFromRecentReports };
};
