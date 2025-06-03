import type { FC } from 'react';

import React from 'react';
import { FlagsProvider } from '@atlaskit/flag';
import { QueryClientProvider } from '@tanstack/react-query';
import StatusKey from './StatusKey';
import { StorageProvider } from '../../../services/storage';
import { queryClient } from '../../../services/query';
import routeData from '../../../../canjs/routing/route-data';

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
