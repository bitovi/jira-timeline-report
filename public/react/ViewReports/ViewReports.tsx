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
import Skeleton from "../components/Skeleton";
import { ErrorBoundary } from "react-error-boundary";
import SectionMessage from "@atlaskit/section-message";
import LinkButton from "../components/LinkButton";

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
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <SectionMessage appearance="error" title="Unable to load saved reports">
          We're having trouble connecting to Jira. Please try again later. Click here to{" "}
          <LinkButton onClick={() => viewReportProps.onBackButtonClicked()}>return to create reports</LinkButton>.
        </SectionMessage>
      )}
    >
      <StorageProvider storage={storage}>
        <Suspense fallback={<ViewReportSkeleton {...viewReportProps} />}>
          <QueryClientProvider client={queryClient}>
            <ViewReports {...viewReportProps} />
          </QueryClientProvider>
        </Suspense>
      </StorageProvider>
    </ErrorBoundary>
  );
}

const ViewReportSkeleton: FC<{ onBackButtonClicked: () => void }> = ({ onBackButtonClicked }) => {
  const selectedReportExists = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("report");
  }, []);

  const rows = [...Array.from({ length: 10 }).keys()].map((i) => {
    return {
      key: i.toString(),
      cells: [
        {
          key: `${i}-report`,
          content: <Skeleton height="40px" />,
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
          {selectedReportExists && <Skeleton />}
        </div>
      </SidebarButton>
      <div className="py-4">
        <Heading size="large">Saved Reports</Heading>
      </div>
      <DynamicTable head={{ cells: [{ key: "report-heading", content: "Report" }] }} rows={rows} />
    </div>
  );
};

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
