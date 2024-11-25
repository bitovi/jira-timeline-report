import type { FC } from "react";

import React, { useMemo } from "react";
import DynamicTable from "@atlaskit/dynamic-table";

import { useAllReports } from "../SaveReports/services/reports/useAllReports";
import ViewReportsLayout from "./components/ViewReportsLayout";

interface ViewReportProps {
  onBackButtonClicked: () => void;
}

const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const selectedReport = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return "";
    }

    return (
      Object.values(reports)
        .filter((report) => !!report)
        .find(({ id }) => id === selectedReport)?.name || ""
    );
  }, [reports]);

  const reportRows = Object.values(reports)
    .filter((r) => !!r)
    .map((report) => {
      return {
        key: report.id,
        cells: [
          {
            key: `${report.id}-report`,
            content: (
              <a href={"?" + report.queryParams} className="flex items-center font-normal text-sm leading-5 h-10">
                Report name {report.name}
              </a>
            ),
          },
        ],
      };
    });

  return (
    <ViewReportsLayout
      onBackButtonClicked={onBackButtonClicked}
      reportInfo={selectedReport ? <p>{selectedReport}</p> : null}
    >
      <DynamicTable head={{ cells: [{ key: "report-heading", content: "Report" }] }} rows={reportRows} />
    </ViewReportsLayout>
  );
};

export default ViewReports;
