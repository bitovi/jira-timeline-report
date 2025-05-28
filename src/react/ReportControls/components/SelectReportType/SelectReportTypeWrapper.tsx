import React, { Suspense } from 'react';
import { ErrorBoundary } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';

import SelectReportType from './SelectReportType';
import routeData from '../../../../canjs/routing/route-data';
import { StorageProvider } from '../../../services/storage';
import { queryClient } from '../../../services/query';

const SelectReportTypeWrapper = () => {
  return (
    <StorageProvider storage={routeData.storage}>
      <ErrorBoundary fallback={() => <span>Something went wrong</span>}>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={'Loading...'}>
            <SelectReportType />
          </Suspense>
        </QueryClientProvider>
      </ErrorBoundary>
    </StorageProvider>
  );
};

export default SelectReportTypeWrapper;
