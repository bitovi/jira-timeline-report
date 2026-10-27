import type { FC } from 'react';

import React, { Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';

import FiltersPanel from '../FiltersPanel';
import type { FiltersPanelProps } from '../FiltersPanel/FiltersPanel';
import { queryClient } from '../../../services/query';
import { StorageProvider } from '../../../services/storage';
import routeData from '../../../../canjs/routing/route-data';

export type FiltersProps = FiltersPanelProps;

/**
 * The panel's option hooks (`useSelectableStatuses` and friends) need `QueryClientProvider`/
 * `StorageProvider`/`Suspense` ancestors that `ReportControls`'s standalone React root doesn't
 * otherwise provide — mirrors `ViewSettings.tsx`, the other `ReportControls` child in the same
 * position.
 */
const Filters: FC<FiltersProps> = (props) => (
  <ErrorBoundary fallback={() => <></>}>
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <StorageProvider storage={routeData.storage}>
          <FiltersPanel {...props} />
        </StorageProvider>
      </QueryClientProvider>
    </Suspense>
  </ErrorBoundary>
);

export default Filters;
