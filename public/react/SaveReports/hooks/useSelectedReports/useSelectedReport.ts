import type { Report, Reports } from "../../../../jira/reports";

import { useMemo, useState } from "react";
import { CanObservable } from "../../../hooks/useCanObservable";
import { useUpdateReport } from "../../../services/reports";
import { getReportFromParams, paramsMatchReport } from "./utilities";
import { useHistoryCallback, useHistoryParams, useHistoryState } from "../../../../jira/history/hooks";
import routeDataObservable from "@routing-observable";
import { param } from "../../../../can";

export const useSelectedReport = ({ reports }: { reports: Reports }) => {
  const { updateReport } = useUpdateReport();
  const [selectedReport, setSelectedReport] = useState<Report | undefined>(() =>
    getReportFromParams(reports),
  );

  const [initial] = useHistoryState();

  const [search] = useHistoryParams();

  const [isDirty, setIsDirty] = useState(() => !paramsMatchReport(new URLSearchParams(search), reports));

  useHistoryCallback((params) => {
    const newSelectedReport = getReportFromParams(reports);

    if (newSelectedReport?.id !== selectedReport?.id) {
      setSelectedReport(newSelectedReport);
    }

    setIsDirty(() => !paramsMatchReport(new URLSearchParams(params), reports));
  });

  return {
    selectedReport,
    updateSelectedReport: () => {
      if (!selectedReport) {
        console.warn("Tried to update the selectedReport without it being set");
        return;
      }

      const queryParams = routeDataObservable.get();
      delete queryParams.settings;

      updateReport(
        selectedReport.id,
        { queryParams: param(queryParams) },
        { onSuccess: () => setIsDirty(false) },
      );
    },
    isDirty,
  };
};
