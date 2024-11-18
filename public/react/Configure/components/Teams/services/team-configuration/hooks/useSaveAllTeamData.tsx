import type { NormalizeIssueConfig } from "../../../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../team-configuration";
import type { UseJiraIssueFields } from "../../../../../../services/jira";
import type { UseAllTeamData } from "./useAllTeamData";

import React from "react";
import { UseMutateFunction, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import { createFullyInheritedConfig, createUpdatedTeamData, updateAllTeamData } from "../team-configuration";
import { createNormalizeConfiguration } from "../../../shared/normalize";
import { jiraKeys } from "../../../../../../services/jira";

type UseSaveAllTeamData = (config?: { onUpdate?: (config: Partial<NormalizeIssueConfig>) => void }) => {
  save: UseMutateFunction<void, Error, AllTeamData, { previousUserData: AllTeamData | undefined }>;
  isSaving: boolean;
};

export const useSaveAllTeamData: UseSaveAllTeamData = (config) => {
  const queryClient = useQueryClient();
  const storage = useStorage();

  const { showFlag } = useFlags();

  const { mutate, isPending } = useMutation({
    mutationFn: (values: AllTeamData) => {
      return updateAllTeamData(storage, values);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: updateTeamConfigurationKeys.allTeamData });

      const previousUserData = queryClient.getQueryData<AllTeamData>(updateTeamConfigurationKeys.allTeamData);

      queryClient.setQueryData(updateTeamConfigurationKeys.allTeamData, updates);

      return { previousUserData };
    },
    onSettled: (data, error, allTeamData) => {
      queryClient.invalidateQueries({ queryKey: updateTeamConfigurationKeys.allTeamData });
      const jiraFields = queryClient.getQueryData<ReturnType<UseJiraIssueFields>>(jiraKeys.allIssueFields());

      if (!jiraFields) {
        console.warn(
          [
            "useSaveAllTeamData (react/team-configuration):",
            "Tried to derive all team data without jirafields.",
            "Empty normalize override was returned",
          ].join("\n")
        );

        config?.onUpdate?.({});
        return;
      }

      const fullConfig = createFullyInheritedConfig(allTeamData, jiraFields);

      config?.onUpdate?.(createNormalizeConfiguration(fullConfig));
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(updateTeamConfigurationKeys.allTeamData, context?.previousUserData);

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

  return { save: mutate, isSaving: isPending };
};

type UseSaveTeamData = (config: {
  teamName: string;
  issueType: keyof TeamConfiguration;
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  save: (updates: Configuration) => void;
  isSaving: boolean;
};

export const useSaveTeamData: UseSaveTeamData = (config) => {
  const { teamName, issueType, onUpdate } = config;

  const queryClient = useQueryClient();
  const { save, isSaving } = useSaveAllTeamData({ onUpdate });

  return {
    isSaving,
    save: (updates: Configuration) => {
      const allTeamData = queryClient.getQueryData<ReturnType<UseAllTeamData>["userAllTeamData"]>(
        updateTeamConfigurationKeys.allTeamData
      );

      if (!allTeamData) {
        console.warn("Could not save without all team data");
        return;
      }

      save(
        createUpdatedTeamData(allTeamData, {
          teamName,
          issueType,
          configuration: updates,
        })
      );
    },
  };
};
