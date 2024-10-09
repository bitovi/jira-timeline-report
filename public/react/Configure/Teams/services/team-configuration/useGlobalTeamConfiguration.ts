import type { TeamConfiguration } from "./reconcile";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";

export type UseDefaultConfiguration = () => Partial<TeamConfiguration>;

export const useGlobalTeamConfiguration: UseDefaultConfiguration = () => {
  const { get } = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.globalConfiguration(),
    queryFn: async () => {
      const data = await get<Partial<TeamConfiguration> | undefined>(globalTeamConfigurationStorageKey);

      if (!data) {
        return {};
      }

      return data;
    },
  });

  return data;
};
