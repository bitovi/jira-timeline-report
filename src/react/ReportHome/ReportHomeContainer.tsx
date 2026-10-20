import type { FC } from 'react';
import type { AppStorage } from '../../jira/storage/common';
import type { LinkBuilderFactory } from '../../routing/common';

import React, { Suspense, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';
import { FlagsProvider } from '@atlaskit/flag';

import ReportHome from './ReportHome';
import Skeleton from '../components/Skeleton';
import routeData from '../../canjs/routing/route-data';
import { queryClient } from '../services/query';
import { StorageProvider } from '../services/storage';
import { RoutingProvider } from '../services/routing';
import { JiraProvider } from '../services/jira';
import { resolveRecentReports, useAllReports, useRecentReports, useStarredReports } from '../services/reports';
import { useCurrentAccountId } from '../services/user';
import { useAsyncFeatures } from '../services/features';
import { getReportTypeOptions } from '../ReportControls/components/SelectReportType/utilities';
import { reports as REPORT_TYPES } from '../../configuration/reports';

/** The `routeData` keys home writes. Typed narrowly so the actions are testable with a plain object. */
export interface HomeRouteTarget {
  showSettings: string;
  primaryReportType: string;
}

/**
 * What home's buttons do, against `routeData` in the app and a plain object in tests.
 *
 * - **Create new report** opens Sources: nothing can be saved without a JQL, and once there is one
 *   the existing Create flow in `SaveReports.tsx` takes over.
 * - **Create Report of Reports** switches the report type. It is in `SELF_MANAGED_REPORT_TYPES`, so
 *   home's condition stops holding and the report area renders it — the way in to the one type that
 *   needs no JQL, since home hides the controls row that holds the type picker.
 */
export const createHomeActions = (target: HomeRouteTarget, onStartReport: () => void = () => {}) => ({
  onOpenSources: () => {
    target.showSettings = 'SOURCES';
  },
  onCreateReport: () => {
    onStartReport();
    target.showSettings = 'SOURCES';
  },
  onViewAllReports: () => {
    target.showSettings = 'REPORTS';
  },
  onCreateReportOfReports: () => {
    onStartReport();
    target.primaryReportType = 'report-of-reports';
  },
});

type HomeActions = ReturnType<typeof createHomeActions>;

const NO_STARS = new Set<string>();

/**
 * Whether Report of Reports is available, by the same rule the report type picker uses, so the two
 * never disagree. `false` while features load, so the button never appears and then vanishes.
 */
const useCanCreateReportOfReports = (): boolean => {
  const { features } = useAsyncFeatures();

  return !!features && getReportTypeOptions(REPORT_TYPES, features).some(({ key }) => key === 'report-of-reports');
};

const ConnectedReportHome: FC<{ actions: HomeActions }> = ({ actions }) => {
  const reports = useAllReports();
  const { recentReports: recentIds } = useRecentReports();
  const currentAccountId = useCurrentAccountId();
  const { starredIds, toggleStar } = useStarredReports();
  const canCreateReportOfReports = useCanCreateReportOfReports();

  const recentReports = useMemo(() => resolveRecentReports(recentIds, reports), [recentIds, reports]);

  return (
    <ReportHome
      {...actions}
      recentReports={recentReports}
      currentAccountId={currentAccountId}
      starredIds={starredIds}
      canCreateReportOfReports={canCreateReportOfReports}
      onToggleStar={(report) => toggleStar(report.id, report.name)}
    />
  );
};

/**
 * Saved reports failed to load: still let the user start a report. Not a Report of Reports, though —
 * with home's own data failing, there's no confirming that feature is on.
 */
const ReportHomeFallback: FC<{ actions: HomeActions }> = ({ actions }) => (
  <ReportHome
    {...actions}
    recentReports={[]}
    currentAccountId={null}
    starredIds={NO_STARS}
    canCreateReportOfReports={false}
    onToggleStar={() => {}}
  />
);

const ReportHomeSkeleton: FC = () => (
  <div className="mx-auto flex w-full max-w-[960px] flex-col gap-2 py-16">
    <Skeleton height="32px" width="320px" />
    <Skeleton height="20px" width="480px" />
    <div className="pt-6" />
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} height="44px" />
    ))}
  </div>
);

export interface ReportHomeContainerProps {
  storage: AppStorage;
  linkBuilder: ReturnType<LinkBuilderFactory>;
  /** See `Routing.interceptLinkClicks`. */
  interceptLinkClicks?: boolean;
  /**
   * Called when a Create button takes the user off home. From then on a report with no JQL shows the
   * "choose sources" prompt instead of home. See `ReportArea`'s `startedReport`.
   */
  onStartReport?: () => void;
}

/**
 * Home, with its own providers: it renders inside the report area, which has none. Mounted by
 * `TimelineReport` into `ReportArea`'s `home` slot.
 */
export const ReportHomeContainer: FC<ReportHomeContainerProps> = ({
  storage,
  linkBuilder,
  interceptLinkClicks,
  onStartReport,
}) => {
  const actions = useMemo(
    () => createHomeActions(routeData as unknown as HomeRouteTarget, onStartReport),
    [onStartReport],
  );

  return (
    <StorageProvider storage={storage}>
      <RoutingProvider routing={{ linkBuilder, interceptLinkClicks }}>
        <FlagsProvider>
          <QueryClientProvider client={queryClient}>
            <JiraProvider jira={(routeData as any).jiraHelpers}>
              <ErrorBoundary fallback={<ReportHomeFallback actions={actions} />}>
                <Suspense fallback={<ReportHomeSkeleton />}>
                  <ConnectedReportHome actions={actions} />
                </Suspense>
              </ErrorBoundary>
            </JiraProvider>
          </QueryClientProvider>
        </FlagsProvider>
      </RoutingProvider>
    </StorageProvider>
  );
};

export default ReportHomeContainer;
