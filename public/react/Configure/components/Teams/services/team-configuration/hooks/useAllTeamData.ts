import type { AllTeamData, IssueFields, TeamConfiguration } from "../team-configuration";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import {
  applyGlobalDefaultData,
  applyInheritance,
  createEmptyTeamConfiguration,
  getAllTeamData,
  getInheritedData,
} from "../../team-configuration";

export type UseAllTeamData = (jiraFields: IssueFields) => {
  userAllTeamData: AllTeamData;
  augmentedAllTeamData: AllTeamData;
};

export const useAllTeamData: UseAllTeamData = (jiraFields) => {
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
