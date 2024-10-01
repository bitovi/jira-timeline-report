import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider, useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

import ConfigureTeams from "./ConfigureTeams";
import { useSaveDefaultConfiguration } from "./useSaveDefaultConfiguration";
import { useDefaultConfiguration } from "./useDefaultConfiguration";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends ConfigureTeamsProps {}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (
  props: Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad">
) => {
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
