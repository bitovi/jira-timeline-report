import type { Report } from '../../../jira/reports';
import type { JiraUser } from './useUsers';

import { useMemo } from 'react';

import { useUsers } from './useUsers';

/**
 * Who to show as a report's owner: its `ownerId`, else (Reports Space only) the work item's
 * creator. Legacy-storage reports saved before spec/041 have neither.
 */
export const effectiveOwnerId = (report: Report): string | undefined => report.ownerId || report.creatorId || undefined;

/**
 * Whether the delete button is offered: your own reports, reports nobody owns, and reports whose
 * owner has left. A UI convenience, not a permission — see `Report.ownerId`.
 */
export const canDeleteReport = (report: Report, currentAccountId: string | null, owner?: Pick<JiraUser, 'active'>) =>
  !report.ownerId || (!!currentAccountId && report.ownerId === currentAccountId) || owner?.active === false;

export interface ReportOwners {
  /** Keyed by account id. Missing entries simply have no name (yet). */
  owners: Record<string, JiraUser>;
  /** See `UseUsersResult.needsReauth`. */
  needsReauth: boolean;
}

/** One `/user/bulk` lookup for every distinct owner across `reports`. Never suspends. */
export const useReportOwners = (reports: Report[]): ReportOwners => {
  const ids = useMemo(() => reports.map(effectiveOwnerId).filter((id): id is string => !!id), [reports]);
  const { users, needsReauth } = useUsers(ids);

  return { owners: users, needsReauth };
};
