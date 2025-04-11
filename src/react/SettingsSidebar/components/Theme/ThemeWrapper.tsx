import type { FC } from "react";

import React, { Suspense } from "react";
import { ErrorBoundary } from "@sentry/react";
import SectionMessage from "@atlaskit/section-message";
import Heading from "@atlaskit/heading";

import LinkButton from "../../../components/LinkButton";
import Skeleton from "../../../components/Skeleton";
import Theme from "./Theme";

interface ThemeWrapper {
  onBackButtonClicked: () => void;
}

const ViewReportsWrapper: FC<ThemeWrapper> = ({ onBackButtonClicked, ...props }) => {
  return (
    <ErrorBoundary fallback={<ThemeError onBackButtonClicked={onBackButtonClicked} />}>
      <Suspense fallback={<ThemeSkeleton {...props} />}>
        <Theme {...props} />
      </Suspense>
    </ErrorBoundary>
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
