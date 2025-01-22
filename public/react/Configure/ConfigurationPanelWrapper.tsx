import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../jira/normalized/normalize";
import { useCanObservable, type CanObservable } from "../hooks/useCanObservable";
import type { AppStorage } from "../../jira/storage/common";
import type { Jira } from "../../jira-oidc-helpers";

import React, { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";
import Spinner from "@atlaskit/spinner";

import { StorageProvider } from "../services/storage";
import { JiraProvider } from "../services/jira";
import ConfigurationPanel from "./ConfigurationPanel";
import { queryClient } from "../services/query";

interface TeamConfigurationWrapperProps {
  onBackButtonClicked: () => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jira: Jira;
  storage: AppStorage;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
  showingTeamsObservable: CanObservable<boolean>;
  showSidebarBranding: boolean;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({
  jira,
  storage,
  showingTeamsObservable,
  ...props
}) => {
  const isShowingTeam = useCanObservable(showingTeamsObservable);

  if (!isShowingTeam) {
    return null;
  }

  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <Suspense
        fallback={
          <div className=" w-56 p-4 flex justify-center h-full items-center">
            <Spinner size="large" label="loading" />
          </div>
        }
      >
        <StorageProvider storage={storage}>
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
