import type { FC } from 'react';

import React, { Suspense } from 'react';
import { FlagsProvider } from '@atlaskit/flag';
import { QueryClientProvider } from '@tanstack/react-query';
import StatusKey from './StatusKey';
import { StorageProvider } from '../../../services/storage';
import { queryClient } from '../../../services/query';
import Skeleton from '../../../components/Skeleton';
import routeData from '../../../../canjs/routing/route-data';

const StatusKeyWrapper: FC = () => {
  return (
    <FlagsProvider>
      <Suspense fallback={<Skeleton />}>
        <QueryClientProvider client={queryClient}>
          <StorageProvider storage={routeData.storage}>
            <StatusKey />
          </StorageProvider>
        </QueryClientProvider>
      </Suspense>
    </FlagsProvider>
  );
};

export default StatusKeyWrapper;
