import type { FC } from 'react';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import StatusKey from './StatusKey';
import { StorageProvider } from '../services/storage';
import routeData from '../../canjs/routing/route-data';
import { queryClient } from '../services/query';

const StatusKeyWrapper: FC = () => {
  return (
    <FlagsProvider>
      <QueryClientProvider client={queryClient}>
        <StorageProvider storage={routeData.storage}>
          <StatusKey />
        </StorageProvider>
      </QueryClientProvider>
    </FlagsProvider>
  );
};

export default StatusKeyWrapper;
