import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';

export type PrimaryReportType = 'auto-scheduler' | 'estimate-analysis' | 'start-due' | 'due' | 'table';
export type SetPrimaryReportType = SetRouteData<PrimaryReportType>;

export const usePrimaryReportType = (): readonly [PrimaryReportType, SetPrimaryReportType] => {
  return useRouteData<PrimaryReportType>('primaryReportType');
};
