import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ConfigureTeams from "./ConfigureTeams";
import { useSaveDefaultConfiguration } from "./services/team-defaults/useSaveDefaultConfiguration";
import { useDefaultConfiguration } from "./services/team-defaults/useDefaultConfiguration";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (props) => {
  // Only render the configuration when inside of jira for now
  if (!AP) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback="loading">
        <ConfigureTeams
          useSave={useSaveDefaultConfiguration}
          useDefaults={useDefaultConfiguration}
          appKey="bitovi.timeline-report.local"
          {...props}
        />
      </Suspense>
    </QueryClientProvider>
  );
};

export default TeamConfigurationWrapper;
