import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import SelectCloud from './SelectCloud';
import { JiraProvider } from '../services/jira';
import { queryClient } from '../services/query';
import routeData from '../../canjs/routing/route-data';

/**
 * Mount target for the site picker. Supplies the providers the container needs
 * and reads the shared observables/helpers off `routeData` (both set in
 * main-helper.js before this renders).
 */
const SelectCloudWrapper: FC = () => (
  <JiraProvider jira={routeData.jiraHelpers}>
    <QueryClientProvider client={queryClient}>
      {/*
        routeData's observables carry placeholder types from the CanJS route-data
        (.js); at runtime this is the real login observable set in main-helper.js.
      */}
      <SelectCloud isLoggedInObservable={routeData.isLoggedInObservable as unknown as CanObservable<boolean>} />
    </QueryClientProvider>
  </JiraProvider>
);

export default SelectCloudWrapper;
