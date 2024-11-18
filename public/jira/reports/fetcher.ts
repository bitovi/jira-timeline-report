import { AppStorage } from "../storage/common";

export type Report = {
  id: string;
  name: string;
  queryParams: string;
};

export type Reports = Partial<Record<string, Report>>;

// export interface Reports extends RawReport {
//   params: Record<string, string | string[] | undefined>;
// }

// export function createReportFromQueryString(id: string, queryString: string): Reports {
//   const searchParams = new URLSearchParams(queryString);
//   const params = Object.fromEntries(searchParams.entries());

//   return {
//     id,
//     stringifiedParams: queryString,
//     params,
//   };
// }

const reportsKey = "saved-reports";

export const getAllReports = (storage: AppStorage): Promise<Reports> => {
  return storage.get<Reports>(reportsKey).then((reports) => reports || {});
};

export const updateReports = (storage: AppStorage, updates: Reports): Promise<void> => {
  return storage.update(reportsKey, updates);
};
