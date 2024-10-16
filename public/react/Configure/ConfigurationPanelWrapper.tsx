import type { FC } from "react";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";

import { JiraProvider } from "./services/jira";
import ConfigurationPanel, { ConfigurationPanelProps } from "./ConfigurationPanel";

// TODO: Move type to module
import jiraOidcHelpers from "../../jira-oidc-helpers";
import { StorageProvider } from "./services/storage";
type Jira = ReturnType<typeof jiraOidcHelpers>;

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends ConfigurationPanelProps {
  jira: Jira;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ jira, ...props }) => {
  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <Suspense>
        <StorageProvider storage={props.storage}>
          <QueryClientProvider client={queryClient}>
            <FlagsProvider>
              <JiraProvider jira={jira}>
                <ConfigurationPanel {...props} />
              </JiraProvider>
            </FlagsProvider>
          </QueryClientProvider>
        </StorageProvider>
      </Suspense>
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;
