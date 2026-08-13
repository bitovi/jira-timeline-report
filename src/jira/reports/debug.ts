import type { ReportsBackend } from './backend/types';
import type { Report } from './fetcher';

import { readAllReports } from './fetcher';

declare global {
  interface Window {
    /**
     * Console helper: logs every saved report with its data and returns them.
     * Installed by `installSavedReportsDebugger` during app bootstrap.
     */
    logSavedReports?: () => Promise<Record<string, Report>>;
  }
}

/**
 * `queryParams` is stored as a raw search string. Expanding it makes the interesting part of a
 * report — the actual configuration — readable in the console instead of one long URL fragment.
 */
const parseQueryParams = (queryParams: string): Record<string, string> => {
  return Object.fromEntries(new URLSearchParams(queryParams));
};

/**
 * Puts `logSavedReports()` on `window` so saved reports can be inspected from the browser console
 * without digging through wherever they are stored (a Connect app property, the configuration
 * issue, or a work item per report in a Reports Space).
 *
 * Reports are read through `readAllReports`, so what gets logged is the migrated shape the app
 * actually renders — the same thing every report reader sees.
 */
export const installSavedReportsDebugger = (backend: ReportsBackend): void => {
  window.logSavedReports = async () => {
    const { reports, changed, applied } = await readAllReports(backend);
    const entries = Object.entries(reports).filter((entry): entry is [string, Report] => Boolean(entry[1]));

    console.group(`Saved reports (${entries.length})`);

    if (changed) {
      console.log('Migrations applied on read (not yet persisted):', applied);
    }

    console.table(
      entries.map(([id, report]) => ({
        id,
        name: report.name,
        type: parseQueryParams(report.queryParams).primaryReportType ?? '',
        sections: report.sections?.length ?? 0,
      })),
    );

    for (const [id, report] of entries) {
      console.group(`${report.name} (${id})`);
      console.log('queryParams:', parseQueryParams(report.queryParams));
      console.log('raw queryParams:', report.queryParams);

      if (report.sections) {
        console.log('sections:', report.sections);
      }

      console.log('report:', report);
      console.groupEnd();
    }

    console.groupEnd();

    return Object.fromEntries(entries);
  };
};
