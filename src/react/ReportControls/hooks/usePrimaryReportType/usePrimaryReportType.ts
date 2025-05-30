import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';

export type PrimaryReportType = 'start-due' | 'due' | 'table';
export type SetPrimaryReportType = SetRouteData<PrimaryReportType>;

export const usePrimaryReportType = (): readonly [PrimaryReportType, SetPrimaryReportType] => {
  return useRouteData<PrimaryReportType>('primaryReportType');
};
