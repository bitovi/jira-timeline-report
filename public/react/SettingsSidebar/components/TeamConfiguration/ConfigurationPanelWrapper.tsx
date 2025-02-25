import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { CanObservable } from "../../../hooks/useCanObservable";

import React, { Suspense } from "react";
import { ErrorBoundary } from "@sentry/react";
import Spinner from "@atlaskit/spinner";

import ConfigurationPanel from "./ConfigurationPanel";

interface TeamConfigurationWrapperProps {
  onBackButtonClicked: () => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig & { fields: string[] }>) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (props) => {
  return (
    <ErrorBoundary fallback={({ error }) => <ConfigurationPanelErrorBoundary error={error} />}>
      <Suspense
        fallback={
          <div className="w-60 p-4 flex justify-center h-full items-center">
            <Spinner size="large" label="loading" />
          </div>
        }
      >
        <ConfigurationPanel {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;

const ConfigurationPanelErrorBoundary: FC<{ error: unknown }> = ({ error }) => {
  if (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return <>{error?.message}</>;
  }

  return "Something went wrong";
};
