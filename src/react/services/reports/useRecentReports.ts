import type { Report, Reports } from '../../../jira/reports';

import { useSyncExternalStore } from 'react';
import { lastUpdatedAt } from '../../../jira/reports';

const maxRecentSize = 5;

const getReportKey = () => {
  const base = 'local-reports';

  if (window.env?.JIRA_APP_KEY) {
    return window.env.JIRA_APP_KEY + '-' + base;
  }

  return window.localStorage.getItem('scopeId') + '-' + base;
};

const parseRecentIds = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }

    console.warn('Ran into an unexpected value deserializing local-reports', parsed);
  } catch {
    console.warn('Ran into an unexpected value deserializing local-reports', raw);
  }

  return [];
};

/**
 * Recents are one list in localStorage shared by every hook instance: the Saved reports dropdown,
 * home and the Saved Reports page are mounted at once, and each used to keep its own copy, so an
 * update in one never reached the others and could be overwritten by a stale copy.
 */
const listeners = new Set<() => void>();
let snapshot: { key: string; raw: string | null; ids: string[] } | null = null;

const readRecentIds = (): string[] => {
  const key = getReportKey();
  const raw = window.localStorage.getItem(key);

  // `useSyncExternalStore` needs the same array back while nothing changed.
  if (!snapshot || snapshot.key !== key || snapshot.raw !== raw) {
    snapshot = { key, raw, ids: parseRecentIds(raw) };
  }

  return snapshot.ids;
};

const writeRecentIds = (update: (current: string[]) => string[]) => {
  try {
    window.localStorage.setItem(getReportKey(), JSON.stringify(update(readRecentIds())));
  } catch {
    console.warn('Could not set local storage at key ' + getReportKey());
  }

  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Another tab opened a report.
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/**
 * The reports every recents list shows, so home and the Saved reports dropdown always match: the
 * recent ids, most recent first, skipping reports deleted since; then, if that's fewer than `limit`,
 * the most recently updated other saved reports, so someone who hasn't opened anything yet still
 * gets a list.
 */
export const resolveRecentReports = (recentIds: string[], reports: Reports, limit = maxRecentSize): Report[] => {
  const recent = recentIds.map((id) => reports[id]).filter((report): report is Report => !!report);

  if (recent.length >= limit) {
    return recent.slice(0, limit);
  }

  const recentSet = new Set(recent.map(({ id }) => id));
  const others = (Object.values(reports) as Array<Report | undefined>)
    .filter((report): report is Report => !!report && !recentSet.has(report.id))
    // ISO timestamps sort as strings; reports saved before it was kept go last.
    .sort((a, b) => (lastUpdatedAt(b) ?? '').localeCompare(lastUpdatedAt(a) ?? ''));

  return [...recent, ...others].slice(0, limit);
};

export const useRecentReports = () => {
  const recentReports = useSyncExternalStore(subscribe, readRecentIds);

  const addReportToRecents = (newReportId: string) => {
    writeRecentIds((current) => [newReportId, ...current.filter((id) => id !== newReportId)].slice(0, maxRecentSize));
  };

  const removeFromRecentReports = (reportId: string) => {
    writeRecentIds((current) => current.filter((id) => id !== reportId));
  };

  return { recentReports, addReportToRecents, removeFromRecentReports };
};
