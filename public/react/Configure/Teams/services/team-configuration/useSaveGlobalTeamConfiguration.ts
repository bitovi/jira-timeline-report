import type { UseMutateFunction } from "@tanstack/react-query";
import type { SprintDefaults } from "./defaults";

import { useMutation } from "@tanstack/react-query";

import { useStorage } from "../storage";
import { globalTeamConfigurationStorageKey } from "./key-factory";

export type UseSaveDefaultConfiguration = () => UseMutateFunction<void, Error, SprintDefaults>;

export const useSaveGlobalTeamConfiguration: UseSaveDefaultConfiguration = () => {
  const { update } = useStorage();

  const { mutate } = useMutation<void, Error, SprintDefaults>({
    mutationFn: (values) => {
      return update<SprintDefaults>(globalTeamConfigurationStorageKey, values);
    },
  });

  return mutate;
};
