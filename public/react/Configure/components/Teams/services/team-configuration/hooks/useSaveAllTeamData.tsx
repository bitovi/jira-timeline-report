import type { NormalizeIssueConfig } from "../../../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../team-configuration";
import type { UseJiraIssueFields } from "../../../../../../services/jira";
import type { TeamDataCache } from "./useAllTeamData";

import React from "react";
import { UseMutateFunction, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

import { useStorage } from "../../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import { createFullyInheritedConfig, updateAllTeamData } from "../team-configuration";
import { createNormalizeConfiguration } from "../../../shared/normalize";
import { jiraKeys } from "../../../../../../services/jira";
import { sanitizeAllTeamData } from "./sanitizeAllTeamData";

type UseSaveAllTeamData = (config?: {
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  save: UseMutateFunction<
    void,
    Error,
    AllTeamData,
    { previousSavedUserData: TeamDataCache | undefined }
  >;
  isSaving: boolean;
};

/**
 * Handles saving all team data, allowing for an update of the entire team configuration
 */
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

      const previousSavedUserData = queryClient.getQueryData<TeamDataCache>(
        updateTeamConfigurationKeys.allTeamData
      );

      queryClient.setQueryData<TeamDataCache>(updateTeamConfigurationKeys.allTeamData, {
        ...(previousSavedUserData ?? { issueHeirarchy: [] }),
        savedUserData: updates,
      });

      return { previousSavedUserData };
    },
    onSettled: (data, error, allTeamData) => {
      queryClient.invalidateQueries({ queryKey: updateTeamConfigurationKeys.allTeamData });
      const jiraFields = queryClient.getQueryData<ReturnType<UseJiraIssueFields>>(
        jiraKeys.allIssueFields()
      );

      const allData = queryClient.getQueryData<TeamDataCache>(
        updateTeamConfigurationKeys.allTeamData
      );

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

      if (!allData) {
        console.warn(
          [
            "useSaveAllTeamData (react/team-configuration):",
            "Tried to derive all team data without heirarchyeLevels.",
            "Empty normalize override was returned",
          ].join("\n")
        );

        config?.onUpdate?.({});
        return;
      }

      const fullConfig = createFullyInheritedConfig(
        allTeamData,
        jiraFields,
        allData?.issueHeirarchy?.map((level) => level.hierarchyLevel.toString())
      );

      config?.onUpdate?.(createNormalizeConfiguration(fullConfig));
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(
        updateTeamConfigurationKeys.allTeamData,
        context?.previousSavedUserData
      );

      let description = error?.message;

      if (!description) {
        description = "Something went wrong";
      }

      showFlag({
        title: <Text color="color.text.danger">"Uh Oh!"</Text>,
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });
    },
  });

  return { save: mutate, isSaving: isPending };
};

type UseSaveTeamData = (config: {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  save: (updates: Configuration) => void;
  isSaving: boolean;
};

/**
 * hook handles saving team-specific data for a particular team and hierarchy level. It works in conjunction with
 * `useSaveAllTeamData` to update specific portions of the team configuration.
 */
export const useSaveTeamData: UseSaveTeamData = (config) => {
  const { teamName, hierarchyLevel, onUpdate } = config;

  const queryClient = useQueryClient();
  const { save, isSaving } = useSaveAllTeamData({ onUpdate });

  return {
    isSaving,
    save: (updates: Configuration) => {
      const allTeamData = queryClient.getQueryData<TeamDataCache>(
        updateTeamConfigurationKeys.allTeamData
      );

      if (!allTeamData) {
        console.warn("Could not save without all team data");
        return;
      }

      const sanitized = sanitizeAllTeamData(
        allTeamData.savedUserData,
        teamName,
        hierarchyLevel,
        updates
      );

      save(sanitized);
    },
  };
};
