import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { TeamConfiguration } from "./defaults";

import { useSuspenseQuery } from "@tanstack/react-query";

import { createNormalizeConfiguration } from "../../shared/normalize";
import { useStorage } from "../storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";
import { defaultGlobalTeamConfiguration } from "./defaults";

export type UseDefaultConfiguration = (config: {
  onInitialDefaultsLoad?: (config: Partial<NormalizeIssueConfig>) => void;
}) => TeamConfiguration;

export const useGlobalTeamConfiguration: UseDefaultConfiguration = ({ onInitialDefaultsLoad }) => {
  const { get } = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.globalConfiguration(),
    queryFn: async () => {
      const loaded = await get<TeamConfiguration | undefined>(globalTeamConfigurationStorageKey);
      const values = { ...defaultGlobalTeamConfiguration, ...(loaded ?? {}) };

      onInitialDefaultsLoad?.(createNormalizeConfiguration(values));

      return values;
    },
  });

  return data;
};
