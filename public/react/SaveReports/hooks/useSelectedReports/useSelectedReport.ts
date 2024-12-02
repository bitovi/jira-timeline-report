import type { Report, Reports } from "../../../../jira/reports";

import { useMemo, useState } from "react";
import { useQueryParams } from "../../../hooks/useQueryParams";
import { CanObservable } from "../../../hooks/useCanObservable";
import { useUpdateReport } from "../../services/reports/useSaveReports";
import { getReportFromParams, paramsMatchReport } from "./utilities";

export const useSelectedReport = ({
  reports,
  queryParamObservable,
}: {
  queryParamObservable: CanObservable<string>;
  reports: Reports;
}) => {
  const { updateReport } = useUpdateReport();
  const selectedReport = useMemo<Report | undefined>(() => getReportFromParams(reports), [reports]);

  const [isDirty, setIsDirty] = useState(
    () => !paramsMatchReport(new URLSearchParams(window.location.search), reports)
  );

  useQueryParams(queryParamObservable, {
    onChange: (params) => {
      setIsDirty(() => !paramsMatchReport(params, reports));
    },
  });

  return {
    selectedReport,
    updateSelectedReport: () => {
      if (!selectedReport) {
        console.warn("Tried to update the selectedReport without it being set");
        return;
      }

      const queryParams = new URLSearchParams(window.location.search);

      queryParams.delete("settings");

      updateReport(selectedReport.id, { queryParams: queryParams.toString() }, { onSuccess: () => setIsDirty(false) });
    },
    isDirty,
  };
};
