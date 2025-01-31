import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { IssueFields } from "./services/team-configuration";

import React from "react";
import { withProfiler, ErrorBoundary } from "@sentry/react";

import ConfigureTeams from "./ConfigureTeams";

export interface TeamConfigurationWrapperProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
  jiraFields: IssueFields;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (props) => {
  return (
    <ErrorBoundary fallback={({ error }) => <TeamConfigurationErrorBoundary error={error} />}>
      <ConfigureTeams {...props} />
    </ErrorBoundary>
  );
};

export default withProfiler(TeamConfigurationWrapper, { name: "Teams Configuration Panel" });

const TeamConfigurationErrorBoundary: FC<{ error: unknown }> = ({ error }) => {
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
