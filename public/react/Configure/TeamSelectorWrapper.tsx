import type { FC } from "react";
import type { AppStorage } from "../../jira/storage/common";
import type { ConfigureTeamsProps } from "./components/Teams/ConfigureTeams";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";

import { StorageProvider } from "./services/storage";

// TODO: Move type to module
import jiraOidcHelpers from "../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;
import { JiraProvider } from "./services/jira";
import TeamSelector from "./TeamSelector";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {
  storage: AppStorage;
  jira: Jira;
  // TODO derive from Team selector
  onBackButtonClicked: () => void;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ storage, jira, ...props }) => {
  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <Suspense fallback="...loading">
        <QueryClientProvider client={queryClient}>
          <FlagsProvider>
            <JiraProvider jira={jira}>
              {/* <StorageProvider storage={storage}> */}
              <TeamSelector storage={storage} {...props} />
              {/* </StorageProvider> */}
            </JiraProvider>
          </FlagsProvider>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;
