import type { FC } from 'react';

import React from 'react';
import { StorageProvider } from '../services/storage';
import routeData from '../../canjs/routing/route-data';
import StatusKey from './StatusKey';
import { FlagsProvider } from '@atlaskit/flag';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../services/query';

interface StatusKeyWrapperProps {}

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
