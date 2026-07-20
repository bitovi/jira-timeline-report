import type { FC, ComponentType } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';
import type { AppStorage } from '../../jira/storage/common';
import type { LinkBuilderFactory } from '../../routing/common';
import type { ReportLoadingState } from './hooks/useReportLoadingState';

import React, { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { value, queues } from '../../can';
import routeData from '../../canjs/routing/route-data';
import { pushStateObservable } from '../../canjs/routing/state-storage';
import { getTheme, applyThemeToCssVars } from '../../jira/theme';
import { useCanObservable } from '../hooks/useCanObservable';
import { useRouteData } from '../hooks/useRouteData';

import { TimelineReportViewModel } from './timeline-report-view-model';
import { useReportLoadingState as defaultUseReportLoadingState } from './hooks/useReportLoadingState';
import { ReportArea } from './components/ReportArea';
import { showSecondaryReport } from './showSecondaryReport';

import { JiraProvider } from '../services/jira';
import { queryClient } from '../services/query';

import ReportControls from '../ReportControls';
import SavedReports from '../SaveReports';
import SampleDataNotice from '../SampleDataNotice';
import SettingsSidebar from '../SettingsSidebar';
import ViewReports from '../ViewReports';
import ReportFooter from '../ReportFooter/ReportFooter';
import PrintHeader from '../PrintHeader';

import { WorkBreakdown } from '../reports/WorkBreakdown';
import { EstimateAnalysis } from '../reports/EstimateAnalysis/EstimateAnalysis';
import AutoScheduler from '../reports/AutoScheduler/AutoScheduler';
import EstimationProgress from '../reports/EstimationProgress/EstimationProgress';
import { GroupingReport } from '../reports/GroupingReport/GroupingReport';
import { FlowMetrics } from '../reports/FlowMetrics/FlowMetrics';
import { TimeInStatus } from '../reports/TimeInStatus/TimeInStatus';
import { ScatterTimeline } from '../reports/ScatterTimeline';
import { GanttGrid } from '../reports/GanttReport/GanttGrid';
import { EstimationTable } from '../reports/EstimationTable';

// URL `primaryReportType` → the React report that renders it. Typed loosely (each report has its
// own prop subset of the shared `*Obs` bag) — matches the untyped `createElement` registry the
// StacheElement used. This is the seam for future `React.lazy` code-splitting
// (see spec/011-react-rewrite/timeline-report/progressive-loading.md).
const urlParamValuesToReactComponents: Record<string, ComponentType<any>> = {
  'estimate-analysis': EstimateAnalysis,
  'auto-scheduler': AutoScheduler,
  'estimation-progress': EstimationProgress,
  grouper: GroupingReport,
  'flow-metrics': FlowMetrics,
  'time-in-status': TimeInStatus,
  due: ScatterTimeline,
  'start-due': GanttGrid,
  table: EstimationTable,
};

// The `routeData` default export carries placeholder (.js) types; cast the observables/props we
// read off it, mirroring the pattern in SelectCloudWrapper.tsx.
const rd = routeData as any;

export interface TimelineReportProps {
  loginComponent: { isLoggedIn: boolean; login: () => void };
  storage: AppStorage;
  linkBuilder: ReturnType<LinkBuilderFactory>;
  showSidebarBranding: boolean;
  /**
   * Injectable for tests (default-prop dependency injection) — defaults to the real routeData-backed
   * hook. Tests pass a fake to drive any loading/progress/error state without a backend. See
   * spec/011-react-rewrite/testing/explore.md (Approach F).
   */
  useReportLoadingState?: () => ReportLoadingState;
}

/**
 * The app shell, ported from the `<timeline-report>` StacheElement to React. Owns the report-page
 * scaffold, the derived-data pipeline (via {@link TimelineReportViewModel}), the report hosts, and
 * the view-state selection (via {@link ReportArea}). Reports/chrome are unchanged: they still receive
 * `value.from(vm, …)` / `value.bind(routeData, …)` observable props (Option A — see rewrite-plan.md).
 * `routeData` stays CanJS until its own keystone migration.
 */
export const TimelineReport: FC<TimelineReportProps> = ({
  loginComponent,
  storage,
  linkBuilder,
  showSidebarBranding,
  useReportLoadingState = defaultUseReportLoadingState,
}) => {
  // The derived-data pipeline (a CanJS ObservableObject) — created once. Reports observe it.
  // Typed `any` so `value.from(vm, …)` accepts it (can.d.ts types the first arg loosely, the same
  // way `routeData` is untyped).
  const vm: any = useMemo(() => new TimelineReportViewModel(), []);

  // Loading/progress/error state. Injectable (default = real hook); called UNCONDITIONALLY so the
  // default-prop-injected function obeys the rules of hooks.
  const loadingState = useReportLoadingState();

  // --- observed route/login state that drives which view renders ---
  const isLoggedIn = useCanObservable(routeData.isLoggedInObservable as unknown as CanObservable<boolean>);
  const [jql] = useRouteData<string>('jql');
  const [primaryReportType] = useRouteData<string>('primaryReportType');
  const [secondaryReportType] = useRouteData<string>('secondaryReportType');
  const [primaryIssueType] = useRouteData<string>('primaryIssueType');

  const primaryIssuesOrReleasesObs = useMemo(() => value.from<any[]>(vm, 'primaryIssuesOrReleases'), [vm]);
  const primaryIssuesOrReleases = useCanObservable(primaryIssuesOrReleasesObs) ?? [];

  const showingConfiguration = isLoggedIn;

  // Mirror the StacheElement's `updateFullishHeightSection` — set the `--fullish-document-top`
  // CSS var from the `.fullish-vh` element's page position, on mount + load + resize.
  useEffect(() => {
    updateFullishHeightSection();
    window.addEventListener('load', updateFullishHeightSection);
    window.addEventListener('resize', updateFullishHeightSection);
    return () => {
      window.removeEventListener('load', updateFullishHeightSection);
      window.removeEventListener('resize', updateFullishHeightSection);
    };
  }, []);

  // Mirror the StacheElement's `connected()` — apply the saved theme to CSS vars on mount so the
  // stored theme takes effect immediately, instead of only once the user tweaks the Theme panel.
  useEffect(() => {
    getTheme(storage)
      .then(applyThemeToCssVars)
      .catch((error) => console.error('Something went wrong getting the theme', error));
  }, [storage]);

  // Report props — the same `*Obs` contract the StacheElement passed. Built once (vm/routeData are
  // stable) so reports don't resubscribe on every shell render.
  const baseProps = useMemo(
    () => ({
      primaryIssuesOrReleasesObs: value.from(vm, 'primaryIssuesOrReleases'),
      allIssuesOrReleasesObs: value.from(vm, 'rolledupAndRolledBackIssuesAndReleases'),
      rollupTimingLevelsAndCalculationsObs: value.from(vm, 'rollupTimingLevelsAndCalculations'),
      filteredDerivedIssuesObs: value.from(vm, 'filteredDerivedIssues'),
      extraFieldsObs: value.bind(routeData, 'fields'),
      rowGroupObs: value.bind(routeData, 'rowGroup'),
      colGroupObs: value.bind(routeData, 'colGroup'),
      aggregatorsObs: value.bind(routeData, 'aggregators'),
      flowMetricsCycleTimeRangeObs: value.bind(routeData, 'flowMetricsCycleTimeRange'),
      flowMetricsStatusFilterObs: value.bind(routeData, 'flowMetricsStatusFilter'),
      flowMetricsIssueTypeFilterObs: value.bind(routeData, 'flowMetricsIssueTypeFilter'),
      flowMetricsProjectFilterObs: value.bind(routeData, 'flowMetricsProjectFilter'),
      flowMetricsTeamFilterObs: value.bind(routeData, 'flowMetricsTeamFilter'),
      timeInStatusDateRangeObs: value.bind(routeData, 'timeInStatusDateRange'),
      timeInStatusStatusFilterObs: value.bind(routeData, 'timeInStatusStatusFilter'),
      timeInStatusIssueTypeFilterObs: value.bind(routeData, 'timeInStatusIssueTypeFilter'),
      timeInStatusProjectFilterObs: value.bind(routeData, 'timeInStatusProjectFilter'),
      timeInStatusReorderObs: value.bind(routeData, 'timeInStatusReorder'),
      roundToObs: value.bind(routeData, 'roundTo'),
      groupByObs: value.bind(routeData, 'groupBy'),
      dateRangeStartObs: value.bind(routeData, 'scatterDateRangeStart'),
      dateRangeEndObs: value.bind(routeData, 'scatterDateRangeEnd'),
      primaryIssueTypeObs: value.bind(routeData, 'primaryIssueType'),
      breakdownObs: value.bind(routeData, 'primaryReportBreakdown'),
      showPercentCompleteObs: value.bind(routeData, 'showPercentComplete'),
    }),
    [vm],
  );

  const secondaryProps = useMemo(
    () => ({
      primaryIssuesOrReleasesObs: value.from(vm, 'primaryIssuesOrReleases'),
      allIssuesOrReleasesObs: value.from(vm, 'rolledupAndRolledBackIssuesAndReleases'),
      planningIssuesObs: value.from(vm, 'planningIssues'),
      secondaryReportTypeObs: value.bind(routeData, 'secondaryReportType'),
      filterRowsObs: value.bind(routeData, 'secondaryFilterRows'),
      childFilterRowsObs: value.bind(routeData, 'secondaryChildFilterRows'),
    }),
    [vm],
  );

  const onUpdateTeamsConfiguration = ({ fields, ...configuration }: any) => {
    queues.batch.start();
    rd.fieldsToRequest = fields;
    rd.normalizeOptions = configuration;
    queues.batch.stop();
  };

  const PrimaryReport = primaryReportType ? urlParamValuesToReactComponents[primaryReportType] : undefined;
  // Only the Gantt ('start-due') and Scatter Plot ('due') primaries support a secondary report, so a
  // stale `secondaryReportType` left in the URL must not render the Work Breakdown below an unrelated
  // primary (e.g. estimate-analysis). See showSecondaryReport.ts.
  const showSecondary = showSecondaryReport(primaryReportType, secondaryReportType);

  const WorkBreakdownAny = WorkBreakdown as ComponentType<any>;
  const ReportControlsAny = ReportControls as ComponentType<any>;

  return (
    <>
      {showingConfiguration && (
        <div
          id="timeline-configuration"
          className="app-chrome-hidden border-gray-100 border-r border-neutral-301 relative block bg-white shrink-0"
        >
          <SettingsSidebar
            showSidebarBranding={showSidebarBranding}
            linkBuilder={linkBuilder}
            onUpdateTeamsConfiguration={onUpdateTeamsConfiguration}
          />
        </div>
      )}

      <div className="fullish-vh pl-4 pr-4 flex flex-1 flex-col overflow-y-auto relative">
        <div id="view-reports" className="app-chrome-hidden">
          <ViewReports
            onBackButtonClicked={() => {
              rd.showSettings = '';
            }}
          />
        </div>

        <div id="sample-data-notice" className="app-chrome-hidden pt-4">
          <SampleDataNotice
            shouldHideNoticeObservable={routeData.isLoggedInObservable as unknown as CanObservable<boolean>}
            onLoginClicked={() => loginComponent.login()}
          />
        </div>

        <div id="saved-reports" className="py-4">
          <SavedReports
            queryParamObservable={pushStateObservable as unknown as CanObservable<string>}
            storage={storage}
            linkBuilder={linkBuilder}
            shouldShowReportsObservable={routeData.isLoggedInObservable as unknown as CanObservable<boolean>}
            onViewReportsButtonClicked={() => {
              rd.showSettings = 'REPORTS';
            }}
          />
        </div>

        <div id="report-controls" className="app-chrome-hidden flex gap-1">
          <ReportControlsAny
            rolledupAndRolledBackIssuesAndReleasesObs={baseProps.allIssuesOrReleasesObs}
            primaryIssuesOrReleasesObs={baseProps.primaryIssuesOrReleasesObs}
          />
        </div>

        <ReportArea
          loadingState={loadingState}
          isLoggedIn={isLoggedIn}
          jql={jql}
          primaryIssueType={primaryIssueType}
          primaryIssuesCount={primaryIssuesOrReleases.length}
        >
          <div id="print-header">
            <PrintHeader />
          </div>

          {PrimaryReport && (
            <div id="react-report-container">
              <QueryClientProvider client={queryClient}>
                <JiraProvider jira={rd.jiraHelpers}>
                  <PrimaryReport key={primaryReportType} {...baseProps} />
                </JiraProvider>
              </QueryClientProvider>
            </div>
          )}

          {showSecondary && (
            <div id="react-secondary-report-container">
              <WorkBreakdownAny {...secondaryProps} />
            </div>
          )}

          <div id="report-footer" className="sticky bottom-0 z-40">
            <ReportFooter />
          </div>
        </ReportArea>
      </div>
    </>
  );
};

export default TimelineReport;

function getElementPosition(el: Element | null) {
  const rect = el?.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return { x: (rect?.left ?? 0) + scrollLeft, y: (rect?.top ?? 0) + scrollTop };
}

function updateFullishHeightSection() {
  const position = getElementPosition(document.querySelector('.fullish-vh'));
  document.documentElement.style.setProperty('--fullish-document-top', `${position.y}px`);
}
