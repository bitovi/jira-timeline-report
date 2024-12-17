import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { Suspense, useMemo } from "react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import SectionMessage from "@atlaskit/section-message";
import DynamicTable from "@atlaskit/dynamic-table";

import ViewReports from "./ViewReports";
import LinkButton from "../components/LinkButton";
import ViewReportLayout from "./components/ViewReportsLayout";
import Skeleton from "../components/Skeleton";
import { StorageProvider } from "../services/storage";
import { useCanObservable } from "../hooks/useCanObservable";
import { FlagsProvider } from "@atlaskit/flag";
import { queryClient } from "../services/query";

interface ViewReportsWrapperProps {
  storage: AppStorage;
  showingReportsObservable: CanObservable<boolean>;
  onBackButtonClicked: () => void;
}

// const queryClient = new QueryClient();

const ViewReportsWrapper: FC<ViewReportsWrapperProps> = ({
  storage,
  showingReportsObservable,
  ...viewReportProps
}) => {
  const shouldShowReports = useCanObservable(showingReportsObservable);

  if (!shouldShowReports) {
    return null;
  }

  return (
    <FlagsProvider>
      <ErrorBoundary
        fallback={<ViewReportsError onBackButtonClicked={viewReportProps.onBackButtonClicked} />}
      >
        <StorageProvider storage={storage}>
          <Suspense fallback={<ViewReportSkeleton {...viewReportProps} />}>
            <QueryClientProvider client={queryClient}>
              <ViewReports {...viewReportProps} />
            </QueryClientProvider>
          </Suspense>
        </StorageProvider>
      </ErrorBoundary>
    </FlagsProvider>
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
      <DynamicTable head={{ cells: [{ key: "report-heading", content: "Report" }] }} rows={rows} />
    </ViewReportLayout>
  );
};
