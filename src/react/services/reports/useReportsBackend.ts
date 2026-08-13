import type { ReportsBackend } from '../../../jira/reports/backend';

import { useMemo } from 'react';

import { getReportsBackend } from '../../../jira/reports/backend';
import { useStorage } from '../storage';

/**
 * Where this session reads and writes saved reports.
 *
 * Built from the storage context rather than a context of its own, so every tree that can already
 * reach reports can reach their backend — including the standalone React roots (`Filters`,
 * `SelectReportType`, `ReportOfReports`) that mount their own providers. The facade resolves the
 * real backend per call, so switching the Storage setting takes effect without a reload.
 */
export const useReportsBackend = (): ReportsBackend => {
  const storage = useStorage();

  return useMemo(() => getReportsBackend(storage), [storage]);
};
