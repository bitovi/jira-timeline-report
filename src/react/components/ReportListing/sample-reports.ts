import type { Report } from '../../../jira/reports';

/** Story fixtures shared by the report-listing stories. Not used by the app. */
export const sampleReport = (
  id: string,
  name: string,
  primaryReportType: string,
  jql = '',
  ownerId?: string,
): Report => ({
  id,
  name,
  queryParams: new URLSearchParams({ primaryReportType, ...(jql ? { jql } : {}) }).toString(),
  ...(ownerId ? { ownerId } : {}),
});

export const SAMPLE_ACCOUNT_IDS = {
  me: '557058:me',
  ada: '557058:ada',
  grace: '557058:grace',
  former: '557058:former',
};

export const SAMPLE_REPORTS: Report[] = [
  sampleReport('1', 'All Outcomes', 'start-due', 'issueType = Outcome ORDER BY Rank', SAMPLE_ACCOUNT_IDS.me),
  sampleReport('2', 'All Outcomes copy', 'start-due', 'issueType = Outcome ORDER BY Rank', SAMPLE_ACCOUNT_IDS.ada),
  sampleReport(
    '3',
    'ECom — In Progress Initiatives',
    'due',
    'project = ECOM AND status = "In Progress"',
    SAMPLE_ACCOUNT_IDS.grace,
  ),
  sampleReport('4', 'Arthur simple table', 'table', '', SAMPLE_ACCOUNT_IDS.me),
  sampleReport('5', 'Q3 Flow Metrics', 'flow-metrics', 'project = ECOM', SAMPLE_ACCOUNT_IDS.former),
  sampleReport('6', 'Cycle time by status', 'time-in-status'),
  sampleReport('7', 'arthur test report of reports', 'report-of-reports', '', SAMPLE_ACCOUNT_IDS.me),
  sampleReport('8', 'Retired grouper view', 'grouper'),
];

export const SAMPLE_OWNERS = {
  [SAMPLE_ACCOUNT_IDS.me]: { accountId: SAMPLE_ACCOUNT_IDS.me, displayName: 'Arthur Pankiewicz', active: true },
  [SAMPLE_ACCOUNT_IDS.ada]: { accountId: SAMPLE_ACCOUNT_IDS.ada, displayName: 'Ada Lovelace', active: true },
  [SAMPLE_ACCOUNT_IDS.grace]: { accountId: SAMPLE_ACCOUNT_IDS.grace, displayName: 'Grace Hopper', active: true },
  [SAMPLE_ACCOUNT_IDS.former]: { accountId: SAMPLE_ACCOUNT_IDS.former, displayName: 'Former Person', active: false },
};
