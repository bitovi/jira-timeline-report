import { AppStorage } from "../storage/common";

export type Report = {
  id: string;
  stringifiedParams: string;
};

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

export const getAllReports = (storage: AppStorage): Promise<Report[]> => {
  return storage.get<Report[] | undefined>("saved-reports").then((reports) => reports || []);
};

export const getReport = (id: string, allReports: Report[]): Report | undefined => {
  return allReports.find((report) => report.id === id);
};
