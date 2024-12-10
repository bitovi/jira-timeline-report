import type { NormalizeIssueConfig } from "../../../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../team-configuration";
import type { UseJiraIssueFields } from "../../../../../../services/jira";
import type { TeamDataCache } from "./useAllTeamData";

import React from "react";
import { UseMutateFunction, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import {
  createFullyInheritedConfig,
  createUpdatedTeamData,
  updateAllTeamData,
} from "../team-configuration";
import { createNormalizeConfiguration } from "../../../shared/normalize";
import { jiraKeys } from "../../../../../../services/jira";

type UseSaveAllTeamData = (config?: {
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  save: UseMutateFunction<
    void,
    Error,
    AllTeamData,
    { previousUserData: TeamDataCache | undefined }
  >;
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

      const previousUserData = queryClient.getQueryData<TeamDataCache>(
        updateTeamConfigurationKeys.allTeamData
      );

      queryClient.setQueryData<TeamDataCache>(updateTeamConfigurationKeys.allTeamData, {
        ...(previousUserData ?? { issueHeirarchy: [] }),
        userData: updates,
      });

      return { previousUserData };
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
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  save: (updates: Configuration) => void;
  isSaving: boolean;
};

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

      const allUpdates = createUpdatedTeamData(allTeamData.userData, {
        teamName,
        hierarchyLevel,
        configuration: updates,
      });

      const sanitized = entriesFlatMap(allUpdates, ([teamKey, teamConfig]) => {
        if (!teamConfig) return [];

        const configs = entriesFlatMap(teamConfig, ([configKey, config]) => {
          if (!config) return [];

          const sanitizedConfig = filterNullValues(config);
          return notEmpty(sanitizedConfig, [configKey, sanitizedConfig]);
        });

        return notEmpty(configs, [teamKey, configs]);
      });

      save(sanitized as any);
    },
  };
};

function entriesFlatMap<T, R extends readonly [string, any]>(
  obj: Record<string, T>,
  fn: (entry: [string, T]) => R[]
): T {
  return Object.fromEntries(Object.entries(obj).flatMap(fn)) as T;
}

function filterNullValues<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value != null)
  ) as Partial<T>;
}

function notEmpty<T extends object | undefined>(value: T, result: [string, T]) {
  if (!value) {
    return [];
  }

  return Object.keys(value).length > 0 ? [result] : [];
}
