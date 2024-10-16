import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { IssueFields } from "./services/team-configuration";

import React from "react";
import { ErrorBoundary } from "react-error-boundary";

import ConfigureTeams from "./ConfigureTeams";

export interface TeamConfigurationWrapperProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
  jiraFields: IssueFields;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (props) => {
  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <ConfigureTeams {...props} />
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;
