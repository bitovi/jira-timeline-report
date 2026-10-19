import type { FC, ReactNode } from 'react';
import React from 'react';

import type { ReportLoadingState } from '../hooks/useReportLoadingState';
import { EmptyResultMessage, ErrorMessage, UnsupportedReportTypeMessage } from './ReportMessages';
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
  /**
   * The raw report type the config asked for, when this build has no entry for it (see
   * `unsupportedReportType.ts`). Takes precedence over every other view state: the report type is
   * dead whatever the request does, so saying so must not wait on data that would only produce the
   * wrong report — route-data clamps a dead key to the first entry in `REPORTS`, so without this the
   * user gets a Gantt and no explanation.
   */
  unsupportedReportType?: string;
  /**
   * The report clamps itself to the viewport and scrolls internally, rather than growing the page.
   * Makes the report block a `min-h-0` flex column so its child can be given the leftover height.
   * See `REPORT_TYPES_FILLING_HEIGHT` in TimelineReport.
   */
  fillsHeight?: boolean;
  /**
   * What to show with no JQL and no self-managed report: the home page (recent reports, create
   * buttons). A slot so this component stays pure — the home page reads storage and Jira, this
   * doesn't. Never rendered for a logged-out (sample data) session. See spec/041-saved-reports-redesign/phase1/plan.md § 7.
   */
  home?: ReactNode;
  /**
   * The user has left home to build a report (a Create button, or a link that names a report
   * type). From then on, no JQL means "this report needs sources" — `setup`, with the controls
   * visible — rather than home, which would hide the controls they need. Resets on reload.
   */
  startedReport?: boolean;
  /** What to show with no JQL once `startedReport`: a prompt to choose sources. A slot, like `home`. */
  setup?: ReactNode;
  /** Opens the Sources panel from the empty-result and error messages. */
  onOpenSources?: () => void;
  /** The report block (print header + report hosts + footer); rendered only when resolved with data. */
  children: ReactNode;
}

type NoJqlStateProps = Pick<
  ReportAreaProps,
  'jql' | 'isLoggedIn' | 'selfManagesData' | 'unsupportedReportType' | 'startedReport'
>;

/** Signed in, no JQL, and a report type that needs one: home or the setup prompt, never a report. */
const needsJql = ({ jql, isLoggedIn, selfManagesData = false, unsupportedReportType }: NoJqlStateProps): boolean =>
  !unsupportedReportType && !jql && isLoggedIn && !selfManagesData;

/**
 * Whether the report area is showing home. Shared with `TimelineReport`, which hides the report
 * controls row while it is.
 */
export const isShowingHome = (props: NoJqlStateProps): boolean => needsJql(props) && !props.startedReport;

/**
 * Whether the user is past home: they pressed a Create button (`startedFlag`), or a saved report is
 * open. The second is read from the URL because a saved report's type comes from the saved record,
 * not the URL, and opening one from home or Saved Reports doesn't reload — so without it, a saved
 * Report of Reports switched to Gantt would land back on home with the controls hidden.
 */
export const hasStartedReport = (startedFlag: boolean, search: string): boolean =>
  startedFlag || !!new URLSearchParams(search).get('report');

/** Whether the report area is showing the "choose sources" prompt instead of home. */
export const isShowingSetup = (props: NoJqlStateProps): boolean => needsJql(props) && !!props.startedReport;

/**
 * Pure view-state selector for the report area — decides which of {report / home / loading /
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
  unsupportedReportType,
  fillsHeight = false,
  home,
  startedReport = false,
  setup,
  onOpenSources,
  children,
}) => {
  const { status, rejectReason } = loadingState;
  const resolved = status === 'resolved';
  const pending = status === 'pending';
  const rejected = status === 'rejected';

  if (unsupportedReportType) {
    return <UnsupportedReportTypeMessage reportType={unsupportedReportType} />;
  }

  return (
    <>
      {isShowingHome({ jql, isLoggedIn, selfManagesData, startedReport }) && home}
      {isShowingSetup({ jql, isLoggedIn, selfManagesData, startedReport }) && setup}

      {((selfManagesData && !rejected) || (resolved && primaryIssuesCount > 0)) && (
        // `report-font-scope` confines the Theme panel's font choice to the report block. It sits
        // here rather than higher up because everything above — nav, sidebar, saved reports, report
        // controls — is app chrome and keeps the default stack. See src/css/fonts.css.
        <div
          className={`report-font-scope my-2 border-box color-bg-white flex-1 ${
            fillsHeight ? 'flex min-h-0 flex-col' : ''
          }`}
        >
          {children}
        </div>
      )}

      {!selfManagesData && resolved && primaryIssuesCount === 0 && (
        <EmptyResultMessage primaryIssueType={primaryIssueType} onOpenSources={onOpenSources} />
      )}

      {!selfManagesData && jql && pending && <LoadingProgressContainer loadingState={loadingState} />}

      {rejected && <ErrorMessage errorMessage={rejectReason?.errorMessages?.[0]} onOpenSources={onOpenSources} />}
    </>
  );
};

export default ReportArea;
