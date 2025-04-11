import routeData from "../../canjs/routing/route-data";
import { AppStorage } from "../storage/common";

export type Report = {
  id: string;
  name: string;
  queryParams: string;
};

export type Reports = Partial<Record<string, Report>>;

const reportsKey = "saved-reports";

export const getAllReports = async (storage: AppStorage): Promise<Reports> => {
  const reports = await storage.get<Reports>(reportsKey).then((reports) => reports || {});

  // @ts-ignore
  routeData.reportsData = reports;

  return reports;
};

export const updateReports = (storage: AppStorage, updates: Reports): Promise<void> => {
  return storage.update(reportsKey, updates);
};
