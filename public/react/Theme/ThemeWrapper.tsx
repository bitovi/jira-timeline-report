import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@sentry/react";
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
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ThemeWrapper> = ({ storage, onBackButtonClicked, ...props }) => {
  return (
    <FlagsProvider>
      <ErrorBoundary fallback={<ThemeError onBackButtonClicked={onBackButtonClicked} />}>
        <StorageProvider storage={storage}>
          <Suspense fallback={<ThemeSkeleton {...props} />}>
            <QueryClientProvider client={queryClient}>
              <Theme {...props} />
            </QueryClientProvider>
          </Suspense>
        </StorageProvider>
      </ErrorBoundary>
    </FlagsProvider>
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

interface ThemeSkeletonProps {}

const ThemeSkeleton: FC<ThemeSkeletonProps> = () => {
  return (
    <>
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
