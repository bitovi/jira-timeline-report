import { SetRouteData, useRouteData } from '../../../hooks/useRouteData';
import { DueReport, StartDueReport, TableReport } from '../../utilities';

export type Reports = [StartDueReport, DueReport, TableReport];

export type SetReports = SetRouteData<Reports>;

export const useReports = (): readonly [Reports, SetReports] => useRouteData<Reports>('reports');
