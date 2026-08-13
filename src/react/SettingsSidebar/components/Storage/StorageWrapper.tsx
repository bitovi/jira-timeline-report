import type { FC } from 'react';

import React, { Suspense } from 'react';
import { FlagsProvider } from '@atlaskit/flag';
import { ErrorBoundary } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import Heading from '@atlaskit/heading';

import Storage from './Storage';
import Skeleton from '../../../components/Skeleton';
import routeData from '../../../../canjs/routing/route-data';
import { JiraProvider } from '../../../services/jira';
import { queryClient } from '../../../services/query';
import { StorageProvider } from '../../../services/storage';

interface StorageWrapperProps {}

const StorageWrapper: FC<StorageWrapperProps> = () => {
  return (
    <FlagsProvider>
      <ErrorBoundary fallback={({ error }) => <StorageErrorBoundary error={error} />}>
        <Suspense fallback={<StorageSkeleton />}>
          <StorageProvider storage={routeData.storage}>
            <JiraProvider jira={routeData.jiraHelpers}>
              <QueryClientProvider client={queryClient}>
                <Storage />
              </QueryClientProvider>
            </JiraProvider>
          </StorageProvider>
        </Suspense>
      </ErrorBoundary>
    </FlagsProvider>
  );
};

export default StorageWrapper;

const StorageSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Storage</Heading>
      </div>
      <div className="flex flex-col gap-4">
        {[...Array.from({ length: 2 }).keys()].map((i) => (
          <Skeleton key={i} height="160px" />
        ))}
      </div>
    </div>
  );
};

const StorageErrorBoundary: FC<{ error: unknown }> = ({ error }) => {
  if (!!error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return <>{error.message}</>;
  }

  return 'Something went wrong, we are unable to load your storage settings';
};
