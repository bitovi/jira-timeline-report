import type { FC } from "react";

import React, { Suspense, useMemo } from "react";

import { ErrorBoundary } from "@sentry/react";
import SectionMessage from "@atlaskit/section-message";
import DynamicTable from "@atlaskit/dynamic-table";

import ViewReports from "./ViewReports";
import LinkButton from "../../../components/LinkButton";
import ViewReportLayout from "./components/ViewReportsLayout";
import Skeleton from "../../../components/Skeleton";

interface ViewReportsWrapperProps {
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ViewReportsWrapperProps> = (viewReportProps) => {
  return (
    <ErrorBoundary
      fallback={<ViewReportsError onBackButtonClicked={viewReportProps.onBackButtonClicked} />}
    >
      <Suspense fallback={<ViewReportSkeleton {...viewReportProps} />}>
        <ViewReports {...viewReportProps} />
      </Suspense>
    </ErrorBoundary>
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
