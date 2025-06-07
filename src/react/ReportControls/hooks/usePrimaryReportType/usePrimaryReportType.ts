import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';
import { ReportKeys } from '../../../../configuration/reports';

export type PrimaryReportType = ReportKeys;
export type SetPrimaryReportType = SetRouteData<PrimaryReportType>;

export const usePrimaryReportType = (): readonly [PrimaryReportType, SetPrimaryReportType] => {
  return useRouteData<PrimaryReportType>('primaryReportType');
};
