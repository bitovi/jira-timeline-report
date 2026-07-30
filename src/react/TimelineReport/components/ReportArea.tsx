import type { FC, ReactNode } from 'react';
import React from 'react';

import type { ReportLoadingState } from '../hooks/useReportLoadingState';
import { NoJqlMessage, EmptyResultMessage, ErrorMessage } from './ReportMessages';
import { LoadingProgressContainer } from './LoadingProgress';

export interface ReportAreaProps {
  /** Request loading state (see useReportLoadingState). */
  loadingState: ReportLoadingState;
  isLoggedIn: boolean;
  /** Current JQL — empty string means none configured. */
  jql: string;
  primaryIssueType?: string;
  /** Number of primary issues/releases after filtering — drives report vs. empty-result. */
  primaryIssuesCount: number;
  /**
   * The report owns its own data, so the shell's JQL / empty-result / loading gates don't apply.
   * Set for `report-of-reports`, which has no JQL and no primary issues of its own — each embedded
   * child fetches for itself. With no JQL the shell's request never runs (getRawIssues returns
   * undefined) and its status sits at 'pending' forever, so without this the document would be
   * replaced by the no-JQL prompt and the loading stepper. Rejections still surface.
   * See spec/016-report-of-reports.
   */
  selfManagesData?: boolean;
  /** The report block (print header + report hosts + footer); rendered only when resolved with data. */
  children: ReactNode;
}

/**
 * Pure view-state selector for the report area — decides which of {report / no-JQL / loading /
 * empty / error} renders, from explicit props. No routeData/vm dependency, so every state
 * (including the pending LoadingProgress stepper with its growing counts) is unit-testable by
 * passing props. The report block itself is supplied as `children` and mounted only in the
 * resolved-with-data state.
 *
 * Conditions mirror the old `<timeline-report>` template exactly.
 */
export const ReportArea: FC<ReportAreaProps> = ({
  loadingState,
  isLoggedIn,
  jql,
  primaryIssueType,
  primaryIssuesCount,
  selfManagesData = false,
  children,
}) => {
  const { status, rejectReason } = loadingState;
  const resolved = status === 'resolved';
  const pending = status === 'pending';
  const rejected = status === 'rejected';

  return (
    <>
      {!jql && isLoggedIn && !selfManagesData && <NoJqlMessage />}

      {((selfManagesData && !rejected) || (resolved && primaryIssuesCount > 0)) && (
        <div className="my-2 border-box color-bg-white flex-1">{children}</div>
      )}

      {!selfManagesData && resolved && primaryIssuesCount === 0 && (
        <EmptyResultMessage count={primaryIssuesCount} primaryIssueType={primaryIssueType} />
      )}

      {!selfManagesData && jql && pending && <LoadingProgressContainer loadingState={loadingState} />}

      {rejected && (
        <ErrorMessage
          noLicense={rejectReason?.type === 'no-licensing'}
          errorMessage={rejectReason?.errorMessages?.[0]}
        />
      )}
    </>
  );
};

export default ReportArea;
