import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { SprintDefaults } from "./plugin";

import { useSuspenseQuery } from "@tanstack/react-query";

import { createNormalizeConfiguration } from "../../shared/normalize";
import { useStorage } from "../storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";

export type UseDefaultConfiguration = (config: {
  onInitialDefaultsLoad?: (config: Partial<NormalizeIssueConfig>) => void;
}) => SprintDefaults;

export const useGlobalTeamConfiguration: UseDefaultConfiguration = ({ onInitialDefaultsLoad }) => {
  const { get } = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.globalConfiguration(),
    queryFn: async () => {
      const defaults = await get<SprintDefaults>(globalTeamConfigurationStorageKey);

      onInitialDefaultsLoad?.(createNormalizeConfiguration(defaults));

      return defaults ?? null;
    },
  });

  return data;
};
