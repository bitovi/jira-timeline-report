import type { DerivedIssue } from '../../../../jira/derived/derive';

export interface StatusPeriod {
  statusName: string;
  fromDate: Date;
  toDate: Date;
  durationMs: number;
}

export function calculateTimeInStatus(issue: DerivedIssue): StatusPeriod[] {
  const changelog = issue.issue.changelog;
  if (!changelog || changelog.length === 0) {
    return [];
  }

  // Collect all status-change events sorted chronologically
  const statusEvents: { statusName: string; date: Date }[] = [];

  for (const entry of changelog) {
    for (const change of entry.items) {
      if (change.field === 'status' && change.toString) {
        statusEvents.push({ statusName: change.toString, date: new Date(entry.created) });
      }
    }
  }

  statusEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (statusEvents.length === 0) {
    return [];
  }

  const periods: StatusPeriod[] = [];
  const now = new Date();

  for (let i = 0; i < statusEvents.length; i++) {
    const fromDate = statusEvents[i].date;
    const toDate = i + 1 < statusEvents.length ? statusEvents[i + 1].date : now;
    const durationMs = toDate.getTime() - fromDate.getTime();

    periods.push({
      statusName: statusEvents[i].statusName,
      fromDate,
      toDate,
      durationMs,
    });
  }

  return periods;
}
