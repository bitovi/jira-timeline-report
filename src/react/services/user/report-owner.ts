import type { Report } from '../../../jira/reports';

/**
 * Who owns a report, as an account id: its `ownerId`, else (Reports Space only) the work item's
 * creator. Legacy-storage reports saved before spec/041 have neither.
 *
 * Ids only — turning one into a name needs `read:jira-user`, which is phase 2. See
 * spec/041-saved-reports-redesign/phase1.md § 4.
 */
export const effectiveOwnerId = (report: Report): string | undefined => report.ownerId || report.creatorId || undefined;

/** Whether the current user owns the report. Always `false` when nobody is signed in. */
export const isOwnedBy = (report: Report, currentAccountId: string | null): boolean =>
  !!currentAccountId && effectiveOwnerId(report) === currentAccountId;

/**
 * Whether the delete button is offered: your own reports, and reports nobody owns. A UI convenience,
 * not a permission — see `Report.ownerId`.
 */
export const canDeleteReport = (report: Report, currentAccountId: string | null): boolean =>
  !report.ownerId || (!!currentAccountId && report.ownerId === currentAccountId);
