import type { FC } from 'react';
import type { LinkBuilderFactory } from '../../routing/common';

import React, { Suspense, useMemo } from 'react';

import { createPortal } from 'react-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';
import SectionMessage from '@atlaskit/section-message';
import { FlagsProvider } from '@atlaskit/flag';

import ViewReports from './ViewReports';
import ViewReportLayout from './components/ViewReportsLayout';
import LinkButton from '../components/LinkButton';
import Skeleton from '../components/Skeleton';
import { queryClient } from '../services/query';
import { StorageProvider } from '../services/storage';
import { RoutingProvider } from '../services/routing';
import { JiraProvider } from '../services/jira';
import { useRouteData } from '../hooks/useRouteData';
import routeData from '../../canjs/routing/route-data';

interface ViewReportsWrapperProps {
  onBackButtonClicked: () => void;
  /** Builds each report row's link. Absent in tests and stories, which want plain hrefs. */
  linkBuilder?: ReturnType<LinkBuilderFactory>;
  /** See `Routing.interceptLinkClicks`. */
  interceptLinkClicks?: boolean;
}

const ViewReportsWrapper: FC<ViewReportsWrapperProps> = ({ linkBuilder, interceptLinkClicks, ...viewReportProps }) => {
  const [showSettings] = useRouteData<string>('showSettings');

  if (showSettings !== 'REPORTS') {
    return null;
  }

  return createPortal(
    <StorageProvider storage={routeData.storage}>
      <RoutingProvider routing={{ linkBuilder: linkBuilder ?? ((query) => query), interceptLinkClicks }}>
        <FlagsProvider>
          <QueryClientProvider client={queryClient}>
            <JiraProvider jira={(routeData as any).jiraHelpers}>
              <ErrorBoundary fallback={<ViewReportsError onBackButtonClicked={viewReportProps.onBackButtonClicked} />}>
                <Suspense fallback={<ViewReportSkeleton {...viewReportProps} />}>
                  <div className="absolute top-0 left-0 right-0 bottom-0 bg-white z-50">
                    <ViewReports {...viewReportProps} />
                  </div>
                </Suspense>
              </ErrorBoundary>
            </JiraProvider>
          </QueryClientProvider>
        </FlagsProvider>
      </RoutingProvider>
    </StorageProvider>,
    document.body,
  );
};

export default ViewReportsWrapper;

interface ViewReportsErrorProps {
  onBackButtonClicked: () => void;
}

const ViewReportsError: FC<ViewReportsErrorProps> = ({ onBackButtonClicked }) => {
  return (
    <SectionMessage appearance="error" title="Unable to load saved reports">
      We're having trouble connecting to Jira. Please try again later. Click here to{' '}
      <LinkButton underlined onClick={() => onBackButtonClicked()}>
        return to create reports
      </LinkButton>
      .
    </SectionMessage>
  );
};

interface ViewReportSkeletonProps {
  onBackButtonClicked: () => void;
}

const numberOfSkeletonRows = 5;

const ViewReportSkeleton: FC<ViewReportSkeletonProps> = ({ onBackButtonClicked }) => {
  const selectedReportExists = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('report');
  }, []);

  return (
    <ViewReportLayout onBackButtonClicked={onBackButtonClicked} reportInfo={selectedReportExists ? <Skeleton /> : null}>
      <div className="flex flex-col gap-1">
        {[...Array.from({ length: numberOfSkeletonRows }).keys()].map((i) => (
          <Skeleton key={i} height="48px" />
        ))}
      </div>
    </ViewReportLayout>
  );
};
