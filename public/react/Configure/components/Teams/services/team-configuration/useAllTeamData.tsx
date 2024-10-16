import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import ErrorIcon from "@atlaskit/icon/glyph/error";

import { useStorage } from "../../../../services/storage";
import { updateTeamConfigurationKeys } from "./key-factory";
import {
  AllTeamData,
  applyGlobalDefaultData,
  applyInheritance,
  Configuration,
  createEmptyTeamConfiguration,
  createUpdatedTeamData,
  getAllTeamData,
  IssueFields,
  TeamConfiguration,
  updateAllTeamData,
} from "./data";
import { useFlags } from "@atlaskit/flag";
import { createNormalizeConfiguration } from "../../shared/normalize";

import React from "react";
import { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";

export type UseAllTeamData = (jiraFields: IssueFields) => {
  userAllTeamData: AllTeamData;
  augmentedAllTeamData: AllTeamData;
};

export const useAllTeamData: UseAllTeamData = (jiraFields: IssueFields) => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: updateTeamConfigurationKeys.allTeamData,
    queryFn: async () => {
      return getAllTeamData(storage).then((newFromStor) => {
        return newFromStor;
      });
    },
  });

  return {
    userAllTeamData: data,
    augmentedAllTeamData: applyInheritance("__GLOBAL__", applyGlobalDefaultData(data, jiraFields)),
  };
};

const logData = (augmentedTeamData: TeamConfiguration, userTeamData: TeamConfiguration) => {
  console.log("augmented");
  console.table(augmentedTeamData);

  console.log("userData");
  console.table(userTeamData);
};

export const useTeamData = (teamName: string, jiraFields: IssueFields) => {
  const { userAllTeamData, augmentedAllTeamData } = useAllTeamData(jiraFields);

  const userData = userAllTeamData[teamName] || createEmptyTeamConfiguration();
  const augmented = augmentedAllTeamData[teamName] || applyInheritance(teamName, userAllTeamData)[teamName]!;

  return {
    userTeamData: userData,
    augmentedTeamData: augmented,
    allTeamData: userAllTeamData,
  };
};

const useSaveAllTeamData = () => {
  const queryClient = useQueryClient();
  const storage = useStorage();

  const { showFlag } = useFlags();

  const { mutate } = useMutation<void, Error, AllTeamData, { previousUserData: AllTeamData | undefined }>({
    mutationFn: (values) => {
      return updateAllTeamData(storage, values);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: updateTeamConfigurationKeys.allTeamData });

      const previousUserData = queryClient.getQueryData<AllTeamData>(updateTeamConfigurationKeys.allTeamData);

      queryClient.setQueryData(updateTeamConfigurationKeys.allTeamData, updates);

      console.log("optimistic", queryClient.getQueryData<AllTeamData>(updateTeamConfigurationKeys.allTeamData));
      return { previousUserData };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: updateTeamConfigurationKeys.allTeamData });
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

  return mutate;
};

export const useSaveTeamData = (config: {
  teamName: string;
  issueType: keyof TeamConfiguration;
  onUpdate?: (config: Partial<NormalizeIssueConfig>) => void;
}) => {
  const { teamName, issueType, onUpdate } = config;
  const queryClient = useQueryClient();
  const saveAllTeamData = useSaveAllTeamData();

  // const allTeamData = queryClient.getQueryData<ReturnType<UseAllTeamData>["userAllTeamData"]>(
  //   updateTeamConfigurationKeys.allTeamData
  // );

  return (allTeamData: AllTeamData, updates: Configuration) => {
    // console.log({
    //   previous: allTeamData,
    //   current: createUpdatedTeamData(allTeamData, {
    //     teamName,
    //     issueType,
    //     configuration: updates,
    //   }),
    //   __updates: updates,
    // });

    saveAllTeamData(
      createUpdatedTeamData(allTeamData, {
        teamName,
        issueType,
        configuration: updates,
      })
    );
  };
};
