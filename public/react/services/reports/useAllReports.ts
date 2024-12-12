import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { Reports } from "../../../jira/reports";
import { useStorage } from "../../services/storage";
import { reportKeys } from "./key-factory";
import { getAllReports } from "../../../jira/reports";

export type UseAllReports = () => { data: Reports; refetch: () => Promise<void> };

export const useAllReports: UseAllReports = () => {
  const storage = useStorage();

  const { data, refetch } = useSuspenseQuery({
    queryKey: reportKeys.allReports,
    queryFn: async () => {
      return getAllReports(storage);
    },
  });

  const [result, setResult] = useState(data);

  const refetchResult = async () => {
    const { data: updated } = await refetch();
    if (updated) setResult(updated);
  };

  return { data: result, refetch: refetchResult };
};
