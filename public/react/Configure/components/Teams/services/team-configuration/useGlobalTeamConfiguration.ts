import type { Configuration } from "./data";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../services/storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";

export type UseDefaultConfiguration = () => Partial<Configuration> | null;

export const useGlobalTeamConfiguration: UseDefaultConfiguration = () => {
  const { get } = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.globalConfiguration(),
    queryFn: async () => {
      return get<Partial<Configuration>>(globalTeamConfigurationStorageKey);
    },
  });

  return data;
};
