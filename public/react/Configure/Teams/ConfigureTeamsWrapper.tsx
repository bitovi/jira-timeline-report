import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ConfigureTeams from "./ConfigureTeams";

import { StorageFactory } from "../../../jira/storage/common";
import { StorageProvider } from "./services/storage";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {
  storage: ReturnType<StorageFactory>;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ storage, ...props }) => {
  console.log("here");
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback="loading">
        <StorageProvider storage={storage}>
          <ConfigureTeams {...props} />
        </StorageProvider>
      </Suspense>
    </QueryClientProvider>
  );
};

export default TeamConfigurationWrapper;
