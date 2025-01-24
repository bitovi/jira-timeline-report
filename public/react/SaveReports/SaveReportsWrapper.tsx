import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { CanObservable } from "../hooks/useCanObservable";
import type { LinkBuilderFactory } from "../../routing/common";

import React, { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import SectionMessage from "@atlaskit/section-message";
import { FlagsProvider } from "@atlaskit/flag";

import Skeleton from "../components/Skeleton";
import SaveReports from "./SaveReports";
import { StorageProvider } from "../services/storage";
import { queryClient } from "../services/query";
import { useCanObservable } from "../hooks/useCanObservable";
import { RoutingProvider } from "../services/routing";

interface SaveReportsWrapperProps {
  storage: AppStorage;
  linkBuilder: ReturnType<LinkBuilderFactory>;
  onViewReportsButtonClicked: () => void;
  queryParamObservable: CanObservable<string>;
  shouldShowReportsObservable: CanObservable<boolean>;
}

const SaveReportsWrapper: FC<SaveReportsWrapperProps> = ({
  storage,
  shouldShowReportsObservable,
  linkBuilder,
  ...saveReportProps
}) => {
  const shouldShowReports = useCanObservable(shouldShowReportsObservable);

  if (!shouldShowReports) {
    return null;
  }

  return (
    <StorageProvider storage={storage}>
      <RoutingProvider routing={{ linkBuilder }}>
        <ErrorBoundary fallback={<SaveReportError />}>
          <FlagsProvider>
            <Suspense fallback={<SaveReportSkeleton />}>
              <QueryClientProvider client={queryClient}>
                <SaveReports {...saveReportProps} />
              </QueryClientProvider>
            </Suspense>
          </FlagsProvider>
        </ErrorBoundary>
      </RoutingProvider>
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
  return <Skeleton height="32px" />;
};
