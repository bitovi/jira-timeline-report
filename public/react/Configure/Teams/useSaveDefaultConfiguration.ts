import type { UseMutateFunction } from "@tanstack/react-query";
import type { SprintDefaults } from "./plugin";

import { useMutation } from "@tanstack/react-query";

import { setSprintDefaults } from "./plugin";

export type UseSaveDefaultConfiguration = (configuration: {
  appKey: string;
}) => UseMutateFunction<void, Error, SprintDefaults>;

export const useSaveDefaultConfiguration: UseSaveDefaultConfiguration = ({ appKey }) => {
  const { mutate } = useMutation<void, Error, SprintDefaults>({
    mutationFn: (values) => {
      return setSprintDefaults(values, { appKey });
    },
  });

  return mutate;
};
