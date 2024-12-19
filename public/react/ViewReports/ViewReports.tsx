import type { FC } from "react";

import React, { useMemo } from "react";
import DynamicTable from "@atlaskit/dynamic-table";

import ViewReportsLayout from "./components/ViewReportsLayout";
import { useAllReports } from "../services/reports";
import { RoutingLink } from "../../jira/history/components";
import routeDataObservable from "@routing-observable";
import { useHistoryStateValue } from "../../jira/history/hooks";

interface ViewReportProps {
  onBackButtonClicked: () => void;
}

const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const [selectedReportId] = useHistoryStateValue("report");
  const selectedReportName = useMemo(() => {
    if (!selectedReportId) {
      return "";
    }

    return (
      Object.values(reports)
        .filter((report) => !!report)
        .find(({ id }) => id === selectedReportId)?.name || ""
    );
  }, [reports, selectedReportId]);

  const reportRows = Object.values(reports)
    .filter((r) => !!r)
    .map((report) => {
      return {
        key: report.id,
        cells: [
          {
            key: `${report.id}-report`,
            content: (
              <RoutingLink
                href={"?" + report.queryParams}
                className="flex items-center font-normal text-sm leading-5 h-10"
                replaceAll
              >
                Report name {report.name}
              </RoutingLink>
            ),
          },
        ],
      };
    });

  return (
    <ViewReportsLayout
      onBackButtonClicked={onBackButtonClicked}
      reportInfo={selectedReportName ? <p>{selectedReportName}</p> : null}
    >
      <DynamicTable head={{ cells: [{ key: "report-heading", content: "Report" }] }} rows={reportRows} />
    </ViewReportsLayout>
  );
};

export default ViewReports;
