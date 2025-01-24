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
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";

import { queryClient } from "../services/query";
import Theme from "./Theme";
import SidebarButton from "../components/SidebarButton";
import Heading from "@atlaskit/heading";

interface ThemeWrapper {
  storage: AppStorage;
  showingThemeObservable: CanObservable<boolean>;
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ThemeWrapper> = ({ storage, showingThemeObservable, ...props }) => {
  const showTheme = useCanObservable(showingThemeObservable);

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
    <SectionMessage appearance="error" title="Unable to load theme">
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
  return (
    <>
      <SidebarButton onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        Go back
      </SidebarButton>
      <div className="my-4">
        <Heading size="small">Theme</Heading>
      </div>
      <div className="pt-6 flex flex-col gap-8">
        {[...Array.from({ length: 9 }).keys()].map((i) => (
          <Skeleton key={i} height="44px" />
        ))}
      </div>
    </>
  );
};
