import type { Reports } from "../../../jira/reports";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../services/storage";
import { reportKeys } from "./key-factory";
import { getAllReports } from "../../../jira/reports";

export type UseAllReports = () => Reports;

export const useAllReports: UseAllReports = () => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: reportKeys.allReports,
    queryFn: async () => {
      return getAllReports(storage);
    },
  });

  return data;
};
