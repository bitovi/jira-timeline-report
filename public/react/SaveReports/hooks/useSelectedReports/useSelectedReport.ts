import type { Report, Reports } from "../../../../jira/reports";

import { useMemo, useState } from "react";
import { useQueryParams } from "../../../hooks/useQueryParams";
import { CanObservable } from "../../../hooks/useCanObservable";
import { useUpdateReport } from "../../../services/reports";
import { getReportFromParams, paramsMatchReport } from "./utilities";
import routeData from "../../../../canjs/routing/route-data";

export const useSelectedReport = ({
  reports,
  queryParamObservable,
}: {
  queryParamObservable: CanObservable<string>;
  reports: Reports;
}) => {
  const { updateReport } = useUpdateReport();
  const [selectedReport, setSelectedReport] = useState<Report | undefined>(() =>
    getReportFromParams(reports)
  );

  const [isDirty, setIsDirty] = useState(
    () => !paramsMatchReport(new URLSearchParams(window.location.search), reports)
  );

  useQueryParams(queryParamObservable, {
    onChange: (params) => {
      const newSelectedReport = getReportFromParams(reports);

      if (newSelectedReport?.id !== selectedReport?.id) {
        setSelectedReport(newSelectedReport);
      }

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

      const queryParams = new URLSearchParams(routeData.serialize());

      updateReport(
        selectedReport.id,
        { queryParams: queryParams.toString() },
        {
          onSuccess: () => {
            setIsDirty(false);

            queryParamObservable.set(`?report=${selectedReport.id}`);
          },
        }
      );
    },
    isDirty,
  };
};
