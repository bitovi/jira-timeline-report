import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import SectionMessage from "@atlaskit/section-message";
import { FlagsProvider } from "@atlaskit/flag";

import { StorageProvider } from "../services/storage";
import Skeleton from "../components/Skeleton";
import SaveReports from "./SaveReports";
import { queryClient } from "../services/query";

interface SaveReportsWrapperProps {
  storage: AppStorage;
  onViewReportsButtonClicked: () => void;
  queryParamObservable: CanObservable<string>;
}

const SaveReportsWrapper: FC<SaveReportsWrapperProps> = ({ storage, ...saveReportProps }) => {
  return (
    <StorageProvider storage={storage}>
      <ErrorBoundary fallback={<SaveReportError />}>
        <FlagsProvider>
          <Suspense fallback={<SaveReportSkeleton />}>
            <QueryClientProvider client={queryClient}>
              <SaveReports {...saveReportProps} />
            </QueryClientProvider>
          </Suspense>
        </FlagsProvider>
      </ErrorBoundary>
    </StorageProvider>
  );
};

export default SaveReportsWrapper;

const SaveReportError: FC = () => {
  return (
    <SectionMessage title="Cannot connect to app data" appearance="error">
      There is an issue communicating with Jira. We're unable to load or save reports. Please try
      again later.
    </SectionMessage>
  );
};

const SaveReportSkeleton: FC = () => {
  return <div style={{border: '1px solid red'}}>
  <Skeleton height="32px" />;
  </div>
};
