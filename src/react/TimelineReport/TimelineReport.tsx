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
import { getTheme, applyThemeToCssVars, getFont, applyFontToCssVars } from '../../jira/theme';
import { useCanObservable } from '../hooks/useCanObservable';
import { useRouteData } from '../hooks/useRouteData';

import { TimelineReportViewModel } from './timeline-report-view-model';
import { useReportLoadingState as defaultUseReportLoadingState } from './hooks/useReportLoadingState';
import { ReportArea } from './components/ReportArea';
import { unsupportedReportType } from './unsupportedReportType';

import { JiraProvider } from '../services/jira';
import { queryClient } from '../services/query';

import ReportControls from '../ReportControls';
import SavedReports from '../SaveReports';
import SampleDataNotice from '../SampleDataNotice';
import SettingsSidebar from '../SettingsSidebar';
import ViewReports from '../ViewReports';
import ReportFooter, { reportNeedsFooterClearance } from '../ReportFooter/ReportFooter';
import PrintHeader from '../PrintHeader';

import { reportComponents } from '../reports/shellRegistry';
import { propsFor } from '../reports/reportProps';
import { ReportLayoutProvider } from '../services/report-layout';

// Reports that own their own data instead of consuming the shell's single JQL-driven request.
const SELF_MANAGED_REPORT_TYPES = new Set(['report-of-reports']);

// Every report type the shell can render. `registry.test.ts` pins these keys to `configuration/
// reports.ts`, so anything outside this list is a key no build of this app ever had — or no longer
// has. See unsupportedReportType.ts.
const KNOWN_REPORT_TYPES = Object.keys(reportComponents);

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
  const [primaryIssueType] = useRouteData<string>('primaryIssueType');
  // The open saved report's record, which seeds the report-of-reports document tree. `reportsData`
  // is populated before React mounts whenever `?report=` is present (shared/main-helper.js), and is
  // briefly absent for a just-created report — the provider treats that as "unknown", not "empty".
  const openReportObs = useMemo(() => value.from<any>(rd, 'reportData'), []);
  const openReport = useCanObservable(openReportObs);

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
  // Colors and font are separate storage keys, so they resolve independently; a failure in one must
  // not stop the other from applying.
  useEffect(() => {
    getTheme(storage)
      .then(applyThemeToCssVars)
      .catch((error) => console.error('Something went wrong getting the theme', error));

    getFont(storage)
      .then(applyFontToCssVars)
      .catch((error) => console.error('Something went wrong getting the font', error));
  }, [storage]);

  // Report props — the same `*Obs` contract the StacheElement passed. Built once (vm/routeData are
  // stable) so reports don't resubscribe on every shell render. The shell's source is the global
  // `routeData`; embedded children build the same bag from their own config (spec/016 Phase 2).
  const baseProps = useMemo(() => propsFor(vm, routeData), [vm]);

  const onUpdateTeamsConfiguration = ({ fields, ...configuration }: any) => {
    // A save that could not derive its config passes `{}` (see useSaveAllTeamData's guards), so
    // `fields` is undefined. Writing that through clears `fieldsToRequest`, which makes
    // `getRawIssues` return undefined and leaves the report on `derivedIssuesPromise`'s
    // never-settling promise — a spinner that can never clear. Keep the last known-good config
    // instead; the report stays on the data it already has. See spec/015-field-selection.
    if (!fields) {
      console.warn(
        [
          'onUpdateTeamsConfiguration (TimelineReport):',
          'Ignoring a team configuration update that carried no fields.',
          'The report keeps its previous configuration.',
        ].join('\n'),
      );
      return;
    }

    queues.batch.start();
    rd.fieldsToRequest = fields;
    rd.normalizeOptions = configuration;
    queues.batch.stop();
  };

  // The report type the config actually asked for, when this build cannot render it. Derived through
  // a CanJS observation rather than a `useQueryParams` subscription so the shell re-renders only when
  // this string changes — subscribing the root to every URL change would re-render the whole tree on
  // things like a compare-slider drag. Tracks both sources the helper reads (the search string and
  // the open saved report), so switching report type clears the message.
  const unsupportedReportTypeObs = useMemo(
    () =>
      value.returnedBy<string | undefined>(() =>
        unsupportedReportType({
          urlParams: new URLSearchParams(pushStateObservable.value as string),
          savedReport: rd.reportData,
          knownReportTypes: KNOWN_REPORT_TYPES,
        }),
      ),
    [],
  );
  const deadReportType = useCanObservable(unsupportedReportTypeObs);

  const PrimaryReport = primaryReportType ? reportComponents[primaryReportType] : undefined;

  const ReportControlsAny = ReportControls as ComponentType<any>;

  return (
    // Holds the report-of-reports document tree. Mounted here because its consumers are sibling
    // subtrees: the report body below renders it, and SaveReports persists it (spec/016 Phase 3).
    <ReportLayoutProvider savedReport={openReport}>
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
          {/* Wrapped in the same QueryClient + JiraProvider as the report body (below) so controls
              that fetch Jira data — e.g. the Table report's TableReportControls calling
              useJiraIssueFields — work here too. queryClient is a shared singleton, so the fields
              query is deduped with the body rather than fetched twice. */}
          <QueryClientProvider client={queryClient}>
            <JiraProvider jira={rd.jiraHelpers}>
              <ReportControlsAny
                rolledupAndRolledBackIssuesAndReleasesObs={baseProps.allIssuesOrReleasesObs}
                primaryIssuesOrReleasesObs={baseProps.primaryIssuesOrReleasesObs}
              />
            </JiraProvider>
          </QueryClientProvider>
        </div>

        <ReportArea
          loadingState={loadingState}
          isLoggedIn={isLoggedIn}
          jql={jql}
          primaryIssueType={primaryIssueType}
          primaryIssuesCount={primaryIssuesOrReleases.length}
          selfManagesData={SELF_MANAGED_REPORT_TYPES.has(primaryReportType)}
          unsupportedReportType={deadReportType}
        >
          <div id="print-header">
            <PrintHeader />
          </div>

          {PrimaryReport && (
            // `mb-10`, only when the sticky footer below actually needs the clearance — see
            // `reportNeedsFooterClearance`'s own doc comment. Lives here rather than on each report
            // component so GanttGrid/ScatterTimeline/TableReport don't each carry their own copy of a
            // margin that, for two of the three, isn't protecting against anything.
            <div id="react-report-container" className={reportNeedsFooterClearance(primaryReportType) ? 'mb-10' : ''}>
              <QueryClientProvider client={queryClient}>
                <JiraProvider jira={rd.jiraHelpers}>
                  <PrimaryReport key={primaryReportType} {...baseProps} />
                </JiraProvider>
              </QueryClientProvider>
            </div>
          )}

          <div id="report-footer" className="sticky bottom-0 z-40">
            <ReportFooter />
          </div>
        </ReportArea>
      </div>
    </ReportLayoutProvider>
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
