import type { UseMutateFunction } from "@tanstack/react-query";
import type { SprintDefaults } from "./defaults";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../storage";
import { globalTeamConfigurationStorageKey } from "./key-factory";

export type UseSaveDefaultConfiguration = () => UseMutateFunction<void, Error, SprintDefaults>;

export const useSaveGlobalTeamConfiguration: UseSaveDefaultConfiguration = () => {
  const { showFlag } = useFlags();
  const { update } = useStorage();

  const { mutate } = useMutation<void, Error, SprintDefaults>({
    mutationFn: (values) => {
      return update<SprintDefaults>(globalTeamConfigurationStorageKey, values);
    },
    onError: (error) => {
      let description = error?.message;

      if (!description) {
        description = "Something went wrong";
      }

      showFlag({
        title: "Uh Oh!",
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon label="error" />,
      });
    },
  });

  return mutate;
};
