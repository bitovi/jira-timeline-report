import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../services/storage";
import { updateTeamConfigurationKeys } from "./key-factory";
import {
  AllTeamData,
  applyGlobalDefaultData,
  applyInheritance,
  createEmptyTeamConfiguration,
  getAllTeamData,
  IssueFields,
} from "./data";

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
  const augmented = augmentedAllTeamData[teamName] || applyInheritance(teamName, userAllTeamData)[teamName]!;

  return {
    userTeamData: userData,
    augmentedTeamData: augmented,
  };
};
