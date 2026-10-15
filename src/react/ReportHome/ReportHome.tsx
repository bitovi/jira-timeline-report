import type { FC } from 'react';
import type { Report } from '../../jira/reports';

import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';

import LinkButton from '../components/LinkButton';
import { ReportTableHeader, ReportTableRow, describeReport } from '../components/ReportListing';
import { effectiveOwnerId, isOwnedBy } from '../services/user';
import { lastUpdatedAt } from '../../jira/reports';

export interface ReportHomeProps {
  /** Most recent first; already narrowed to reports that still exist. Only the first 5 are shown. */
  recentReports: Report[];
  currentAccountId: string | null;
  starredIds: Set<string>;
  onToggleStar: (report: Report) => void;
  onViewAllReports: () => void;
  onCreateReport: () => void;
  onCreateReportOfReports: () => void;
  onOpenSources: () => void;
}

export const MAX_RECENT_ON_HOME = 5;

/**
 * What you see with no report open: recent reports and the ways to start a new one. Replaces the
 * old one-line "Configure a JQL in the sidebar" prompt. Presentational — `ReportHomeContainer`
 * reads the data and wires the actions. See spec/041-saved-reports-redesign/phase1/plan.md § 7.
 */
export const ReportHome: FC<ReportHomeProps> = ({
  recentReports,
  currentAccountId,
  starredIds,
  onToggleStar,
  onViewAllReports,
  onCreateReport,
  onCreateReportOfReports,
  onOpenSources,
}) => {
  const recents = recentReports.slice(0, MAX_RECENT_ON_HOME);
  const sources = (
    <LinkButton type="button" onClick={onOpenSources}>
      Sources
    </LinkButton>
  );

  return (
    <div className="mx-auto w-full max-w-[960px] py-16">
      <Heading size="large">Pick up where you left off</Heading>
      <p className="pt-2 text-neutral-801">
        {recents.length > 0 ? (
          <>Open a recent report, or choose work items in {sources} to build a new one.</>
        ) : (
          <>You haven&apos;t opened any reports yet. Choose work items in {sources} to build your first one.</>
        )}
      </p>

      {recents.length > 0 ? (
        <section aria-labelledby="report-home-recents" className="pt-8">
          <div className="flex items-center justify-between pb-2">
            <h2 id="report-home-recents" className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
              Recently opened
            </h2>
            <LinkButton type="button" onClick={onViewAllReports} className="text-sm">
              All saved reports →
            </LinkButton>
          </div>
          <div
            role="table"
            aria-labelledby="report-home-recents"
            className="rounded-xl border border-neutral-41 bg-white shadow-sm"
          >
            <ReportTableHeader className="rounded-t-xl" />
            {recents.map((report) => (
              <ReportTableRow
                key={report.id}
                compact
                described={describeReport(report)}
                ownerId={effectiveOwnerId(report)}
                isMine={isOwnedBy(report, currentAccountId)}
                updatedAt={lastUpdatedAt(report)}
                isStarred={starredIds.has(report.id)}
                onToggleStar={() => onToggleStar(report)}
                href={`?report=${report.id}`}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="pt-8">
          <Button onClick={onViewAllReports}>All saved reports</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-8">
        <Button appearance="primary" onClick={onCreateReport}>
          Create new report
        </Button>
        <Button onClick={onCreateReportOfReports}>Create Report of Reports</Button>
      </div>
    </div>
  );
};

export default ReportHome;
