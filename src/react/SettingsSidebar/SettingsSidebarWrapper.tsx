import type { FC } from 'react';
import type { LinkBuilderFactory } from '../../routing/common';
import type { NormalizeIssueConfig } from '../../jira/normalized/normalize';

import React from 'react';
import { FlagsProvider } from '@atlaskit/flag';
import { ErrorBoundary } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import SettingsSidebar from './SettingsSidebar';
import { StorageProvider } from '../services/storage';
import { RoutingProvider } from '../services/routing';
import { queryClient } from '../services/query';
import { JiraProvider } from '../services/jira';
import routeData from '../../canjs/routing/route-data';

export interface SettingsSidebarProps {
  showSidebarBranding: boolean;
  linkBuilder: ReturnType<LinkBuilderFactory>;
  onUpdateTeamsConfiguration: (overrides: Partial<NormalizeIssueConfig & { fields: string[] }>) => void;
}

const SettingsSidebarWrapper: FC<SettingsSidebarProps> = ({ linkBuilder, ...props }) => {
  return (
    <FlagsProvider>
      <ErrorBoundary>
        <RoutingProvider routing={{ linkBuilder }}>
          <StorageProvider storage={routeData.storage}>
            <JiraProvider jira={routeData.jiraHelpers}>
              <QueryClientProvider client={queryClient}>
                <SettingsSidebar {...props} />
              </QueryClientProvider>
            </JiraProvider>
          </StorageProvider>
        </RoutingProvider>
      </ErrorBoundary>
    </FlagsProvider>
  );
};

export default SettingsSidebarWrapper;
