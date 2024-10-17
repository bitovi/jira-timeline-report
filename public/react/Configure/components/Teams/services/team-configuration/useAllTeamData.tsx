import type { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, IssueFields, TeamConfiguration } from "./team-configuration";

import React from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../../../../services/storage";
import { updateTeamConfigurationKeys } from "./key-factory";
import {
  applyGlobalDefaultData,
  applyInheritance,
  createEmptyTeamConfiguration,
  createUpdatedTeamData,
  getAllTeamData,
  getInheritedData,
  updateAllTeamData,
} from "./team-configuration";
import { createNormalizeConfiguration } from "../../shared/normalize";

export type UseAllTeamData = (jiraFields: IssueFields) => {
  userAllTeamData: AllTeamData;
  augmentedAllTeamData: AllTeamData;
};

export const useAllTeamData: UseAllTeamData = (jiraFields: IssueFields) => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: updateTeamConfigurationKeys.allTeamData,
    queryFn: async () => {
      return getAllTeamData(storage);
    },
  });

  return {
    userAllTeamData: data,
    augmentedAllTeamData: applyInheritance("__GLOBAL__", applyGlobalDefaultData(data, jiraFields)),
  };
};

export const useTeamData = (teamName: string, jiraFields: IssueFields) => {
  const { userAllTeamData, augmentedAllTeamData } = useAllTeamData(jiraFields);

  const userData = userAllTeamData[teamName] || createEmptyTeamConfiguration();
  const augmented = applyInheritance(teamName, augmentedAllTeamData)[teamName]!;

  return {
    userTeamData: userData,
    augmentedTeamData: augmented,
    getInheritance: (issueType: keyof TeamConfiguration) => {
      let empty = createEmptyTeamConfiguration();

      if (issueType !== "defaults") {
        empty = { ...empty, defaults: { ...augmented.defaults } };
      }

      return getInheritedData(empty, augmentedAllTeamData);
    },
  };
};

const useSaveAllTeamData = (config?: { onUpdate?: (config: Partial<NormalizeIssueConfig>) => void }) => {
  const queryClient = useQueryClient();
  const storage = useStorage();

  const { showFlag } = useFlags();

  const { mutate, isPending } = useMutation<void, Error, AllTeamData, { previousUserData: AllTeamData | undefined }>({
    mutationFn: (values) => {
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
      config?.onUpdate?.(createNormalizeConfiguration(allTeamData));
    },
    onError: (error, newUserData, context) => {
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

export const useSaveTeamData = (config: {
  teamName: string;
  issueType: keyof TeamConfiguration;
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  const { teamName, issueType, onUpdate } = config;
  const queryClient = useQueryClient();
  const { save, isSaving } = useSaveAllTeamData({ onUpdate: config.onUpdate });

  return {
    isSaving,
    save: (updates: Configuration) => {
      console.log({ updates });
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
