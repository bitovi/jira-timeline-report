import type { FC } from 'react';

import React, { Suspense } from 'react';
import DropdownMenu from '@atlaskit/dropdown-menu';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';

import ScatterPlotViewSettings from './components/ScatterPlotViewSettings';
import GanttViewSettings from './components/GanttViewSettings';
import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { queryClient } from '../../../services/query';
import { StorageProvider } from '../../../services/storage';
import { EstimateAnalysisViewSettings } from '../../../reports/EstimateAnalysis/EstimateAnalysisViewSettings';
import { FlowMetricsViewSettings } from '../../../reports/FlowMetrics/FlowMetricsViewSettings';
import { TimeInStatusViewSettings } from '../../../reports/TimeInStatus/TimeInStatusViewSettings';
import routeData from '../../../../canjs/routing/route-data';

const reports = [
  {
    key: 'start-due',
    name: 'Gantt Chart',
  },
  {
    key: 'due',
    name: 'Scatter Plot',
  },
  {
    key: 'table',
    name: 'Estimation Table',
  },
  {
    key: 'flow-metrics',
    name: 'Flow Metrics',
  },
  {
    key: 'time-in-status',
    name: 'Time in Status',
  },
] as const;

type ReportTypes = (typeof reports)[number]['key'];

const viewSettingsMap: Record<Exclude<ReportTypes, 'table'>, FC> = {
  'start-due': GanttViewSettings,
  due: ScatterPlotViewSettings,
  'flow-metrics': FlowMetricsViewSettings,
  'time-in-status': TimeInStatusViewSettings,
};

const ViewSettings: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (
    primaryReportType !== 'start-due' &&
    primaryReportType !== 'due' &&
    primaryReportType !== 'flow-metrics' &&
    primaryReportType !== 'time-in-status'
  ) {
    return null;
  }

  const Settings = viewSettingsMap[primaryReportType];

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="view-settings-nested-modal-visibility-override">
      <ErrorBoundary fallback={() => <p>Something went wrong</p>}>
        <Suspense>
          <QueryClientProvider client={queryClient}>
            <StorageProvider storage={routeData.storage}>
              <DropdownMenu
                shouldRenderToParent
                trigger={
                  primaryReportType === 'flow-metrics' || primaryReportType === 'time-in-status'
                    ? 'Filter Results'
                    : 'View settings'
                }
              >
                <div className="p-6 w-[475px]">
                  <Settings />
                </div>
              </DropdownMenu>
            </StorageProvider>
          </QueryClientProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default ViewSettings;
