import type { StoredNode } from '../../react/reports/ReportOfReports/model/sections';

import routeData from '../../canjs/routing/route-data';
import { AppStorage } from '../storage/common';

export type Report = {
  id: string;
  name: string;
  queryParams: string;
  /**
   * Report-of-reports document tree. Absent on every other report type, and absent on
   * report-of-reports saved before this field existed — readers must tolerate that.
   * Type-only import, so this adds no runtime dependency on the React layer.
   * See spec/016-report-of-reports.
   */
  sections?: StoredNode[];
};

export type Reports = Partial<Record<string, Report>>;

const reportsKey = 'saved-reports';

export const getAllReports = async (storage: AppStorage): Promise<Reports> => {
  const reports = await storage.get<Reports>(reportsKey).then((reports) => reports || {});

  // @ts-ignore
  routeData.reportsData = reports;

  return reports;
};

export const updateReports = (storage: AppStorage, updates: Reports): Promise<void> => {
  return storage.update(reportsKey, updates);
};
