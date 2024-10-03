import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";

import ConfigureTeams from "./ConfigureTeams";

import { StorageFactory } from "../../../jira/storage/common";
import { StorageProvider } from "./services/storage";

// TODO: Move type to module
import jiraOidcHelpers from "../../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;
import { JiraProvider } from "./services/jira";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {
  storage: ReturnType<StorageFactory>;
  jira: Jira;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ storage, jira, ...props }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <FlagsProvider>
        <ErrorBoundary fallbackRender={() => "Something went wrong"}>
          <Suspense fallback="loading">
            <JiraProvider jira={jira}>
              <StorageProvider storage={storage}>
                <ConfigureTeams {...props} />
              </StorageProvider>
            </JiraProvider>
          </Suspense>
        </ErrorBoundary>
      </FlagsProvider>
    </QueryClientProvider>
  );
};

export default TeamConfigurationWrapper;
