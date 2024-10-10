import type { TeamConfiguration } from "./reconcile";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../services/storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";

export type UseDefaultConfiguration = () => Partial<TeamConfiguration> | null;

export const useGlobalTeamConfiguration: UseDefaultConfiguration = () => {
  const { get } = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.globalConfiguration(),
    queryFn: async () => {
      return get<Partial<TeamConfiguration>>(globalTeamConfigurationStorageKey);
    },
  });

  return data;
};
