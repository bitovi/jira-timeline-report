import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import SectionMessage from "@atlaskit/section-message";

import LinkButton from "../components/LinkButton";
import Skeleton from "../components/Skeleton";
import { StorageProvider } from "../services/storage";
import { useCanObservable } from "../hooks/useCanObservable";
import { FlagsProvider } from "@atlaskit/flag";
import { queryClient } from "../services/query";
import Theme from "./Theme";

interface ThemeWrapper {
  storage: AppStorage;
  showingThemeObservable: CanObservable<boolean>;
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ThemeWrapper> = ({ storage, showingThemeObservable, ...props }) => {
  const showTheme = useCanObservable(showingThemeObservable);

  console.log(showTheme);

  if (!showTheme) {
    return null;
  }

  return (
    <div className="w-80 py-4 px-6">
      <FlagsProvider>
        <ErrorBoundary fallback={<ThemeError onBackButtonClicked={props.onBackButtonClicked} />}>
          <StorageProvider storage={storage}>
            <Suspense fallback={<ThemeSkeleton {...props} />}>
              <QueryClientProvider client={queryClient}>
                <Theme {...props} />
              </QueryClientProvider>
            </Suspense>
          </StorageProvider>
        </ErrorBoundary>
      </FlagsProvider>
    </div>
  );
};

export default ViewReportsWrapper;

interface ThemeErrorProps {
  onBackButtonClicked: () => void;
}

const ThemeError: FC<ThemeErrorProps> = ({ onBackButtonClicked }) => {
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

interface ThemeSkeletonProps {
  onBackButtonClicked: () => void;
}

const ThemeSkeleton: FC<ThemeSkeletonProps> = ({ onBackButtonClicked }) => {
  return <Skeleton height="40px" />;
};
