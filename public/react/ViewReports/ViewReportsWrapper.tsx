import type { FC } from "react";

import React, { Suspense, useMemo } from "react";

// @ts-expect-error we need to do something about all these conflicting react
// types
import { createPortal } from "react-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@sentry/react";
import SectionMessage from "@atlaskit/section-message";
import DynamicTable from "@atlaskit/dynamic-table";
import { FlagsProvider } from "@atlaskit/flag";

import ViewReports from "./ViewReports";
import LinkButton from "../components/LinkButton";
import ViewReportLayout from "./components/ViewReportsLayout";
import Skeleton from "../components/Skeleton";
import { useCanObservable } from "../hooks/useCanObservable";
import { value } from "../../can";
import routeData from "../../canjs/routing/route-data";
import { queryClient } from "../services/query";
import { StorageProvider } from "../services/storage";

interface ViewReportsWrapperProps {
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ViewReportsWrapperProps> = (viewReportProps) => {
  const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));

  if (showSettings !== "REPORTS") {
    return null;
  }

  return createPortal(
    <StorageProvider storage={routeData.storage}>
      <FlagsProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary
            fallback={
              <ViewReportsError onBackButtonClicked={viewReportProps.onBackButtonClicked} />
            }
          >
            <Suspense fallback={<ViewReportSkeleton {...viewReportProps} />}>
              <div className="absolute top-0 left-0 right-0 bottom-0 bg-white z-[100]">
                <ViewReports {...viewReportProps} />
              </div>
            </Suspense>
          </ErrorBoundary>
        </QueryClientProvider>
      </FlagsProvider>
    </StorageProvider>,
    document.body
  );
};

export default ViewReportsWrapper;

interface ViewReportsErrorProps {
  onBackButtonClicked: () => void;
}

const ViewReportsError: FC<ViewReportsErrorProps> = ({ onBackButtonClicked }) => {
  return (
    <SectionMessage appearance="error" title="Unable to load saved reports">
      We're having trouble connecting to Jira. Please try again later. Click here to{" "}
      <LinkButton underlined onClick={() => onBackButtonClicked()}>
        return to create reports
      </LinkButton>
      .
    </SectionMessage>
  );
};

interface ViewReportSkeletonProps {
  onBackButtonClicked: () => void;
}

const numberOfSkeletonRows = 5;

const ViewReportSkeleton: FC<ViewReportSkeletonProps> = ({ onBackButtonClicked }) => {
  const selectedReportExists = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("report");
  }, []);

  const rows = [...Array.from({ length: numberOfSkeletonRows }).keys()].map((i) => {
    return {
      key: i.toString(),
      cells: [{ key: `${i}-report`, content: <Skeleton height="40px" /> }],
    };
  });

  return (
    <ViewReportLayout
      onBackButtonClicked={onBackButtonClicked}
      reportInfo={selectedReportExists ? <Skeleton /> : null}
    >
      <DynamicTable
        head={{
          cells: [
            { key: "report-heading", content: "Report" },
            { key: " manage-reports", content: "Manage" },
          ],
        }}
        rows={rows}
      />
    </ViewReportLayout>
  );
};
