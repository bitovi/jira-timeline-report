import type { UseMutateFunction } from "@tanstack/react-query";
import type { Configuration } from "./team-configuration";
import type { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../../../../services/storage";
import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "./key-factory";
import { createNormalizeConfiguration } from "../../shared/normalize";

export type UseSaveDefaultConfiguration = (config: {
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => UseMutateFunction<void, Error, Configuration>;

export const useSaveGlobalTeamConfiguration: UseSaveDefaultConfiguration = ({ onUpdate }) => {
  const queryClient = useQueryClient();

  const { showFlag } = useFlags();
  const { update } = useStorage();

  const { mutate } = useMutation<void, Error, Configuration>({
    mutationFn: (values) => {
      return update<Configuration>(globalTeamConfigurationStorageKey, values);
    },
    onSuccess: (_, updatedValues) => {
      onUpdate?.(createNormalizeConfiguration(updatedValues));

      queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.globalConfiguration() });
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
