import React, { FC, Suspense, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppStorage } from "../../jira/storage/common";
import { StorageProvider } from "../services/storage";
import { useAllReports } from "../SaveReports/services/reports/useAllReports";
import DynamicTable from "@atlaskit/dynamic-table";
import Heading from "@atlaskit/heading";
import { CanObservable, useCanObservable } from "../hooks/useCanObservable";
import SidebarButton from "../components/SidebarButton";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";

const queryClient = new QueryClient();

export default function ({
  storage,
  showingReportsObservable,
  ...viewReportProps
}: {
  storage: AppStorage;
  showingReportsObservable: CanObservable<boolean>;
  onBackButtonClicked: () => void;
}) {
  const shouldShowReports = useCanObservable(showingReportsObservable);

  if (!shouldShowReports) {
    return null;
  }

  return (
    <StorageProvider storage={storage}>
      <Suspense>
        <QueryClientProvider client={queryClient}>
          <ViewReports {...viewReportProps} />
        </QueryClientProvider>
      </Suspense>
    </StorageProvider>
  );
}

const ViewReports: FC<{ onBackButtonClicked: () => void }> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const selectedReport = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return "";
    }

    return (
      Object.values(reports)
        .filter((r) => !!r)
        .find(({ id }) => id === selectedReport)?.name || ""
    );
  }, []);

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
    <div className="p-6">
      <SidebarButton className="flex items-center" onClick={() => onBackButtonClicked()}>
        <ArrowLeftCircleIcon label="go back" />
        <div className="flex-col gap-1">
          Back to report
          {selectedReport && <p>{selectedReport}</p>}
        </div>
      </SidebarButton>
      <div className="py-4">
        <Heading size="large">Saved Reports</Heading>
      </div>
      <DynamicTable head={{ cells: [{ key: "report-heading", content: "Report" }] }} rows={reportRows} />
    </div>
  );
};
