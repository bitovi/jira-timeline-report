import type { FC } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable';

import React, { Suspense } from 'react';
import { ErrorBoundary } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import SectionMessage from '@atlaskit/section-message';

import routeData from '../../../canjs/routing/route-data';
import { pushStateObservable } from '../../../canjs/routing/state-storage';
import { StorageProvider } from '../../services/storage';
import { JiraProvider } from '../../services/jira';
import { queryClient } from '../../services/query';
import { useQueryParams } from '../../hooks/useQueryParams';
import { ReportOfReports } from './ReportOfReports';

/**
 * Provider stack for {@link ReportOfReports}, matching the other standalone islands
 * (SelectReportTypeWrapper, SaveReportsWrapper): the report body in `TimelineReport` supplies a
 * QueryClient but no `StorageProvider` or `Suspense`, and `useAllReports` needs both.
 *
 * `JiraProvider` is here rather than relied on from above: `TimelineReport` does wrap the report body
 * in one, but inline values (`useInlineExpression`) need the Jira client, and an island that supplies
 * its own storage should supply its own Jira client too rather than break when mounted elsewhere.
 */
const ReportOfReportsWrapper: FC = () => {
  const { queryParams } = useQueryParams(pushStateObservable as unknown as CanObservable<string>);

  return (
    <StorageProvider storage={routeData.storage}>
      <ErrorBoundary fallback={<ReportOfReportsError />}>
        <QueryClientProvider client={queryClient}>
          <JiraProvider jira={routeData.jiraHelpers}>
            <Suspense fallback={'Loading…'}>
              <ReportOfReports currentReportId={queryParams.get('report')} />
            </Suspense>
          </JiraProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StorageProvider>
  );
};

export default ReportOfReportsWrapper;

const ReportOfReportsError: FC = () => (
  <SectionMessage title="Cannot connect to app data" appearance="error">
    There is an issue communicating with Jira. We're unable to load your saved reports.
  </SectionMessage>
);
