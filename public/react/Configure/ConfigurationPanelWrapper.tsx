import type { FC } from "react";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";

import { JiraProvider } from "./services/jira";
import TeamSelector, { ConfigurationPanelProps } from "./ConfigurationPanel";

// TODO: Move type to module
import jiraOidcHelpers from "../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends ConfigurationPanelProps {
  jira: Jira;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ jira, ...props }) => {
  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <QueryClientProvider client={queryClient}>
        <FlagsProvider>
          <JiraProvider jira={jira}>
            <TeamSelector {...props} />
          </JiraProvider>
        </FlagsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;
