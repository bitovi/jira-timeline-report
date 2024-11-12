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
import { useJira } from "../../../../../services/jira";
import { getSimplifiedIssueHierarchy } from "../../../../../../../stateful-data/jira-data-requests";
import { Jira } from "../../../../../../../jira-oidc-helpers";
import { AppStorage } from "../../../../../../../jira/storage/common";

type IssueType = {
  name: string;
  hierarchLevel: number;
};

const getTeamDataWithIssueTypes = async (
  jiraHelpers: Jira,
  storage: AppStorage
): Promise<{ userData: AllTeamData; issueTypes: IssueType[] }> => {
  const issueTypes = (await getSimplifiedIssueHierarchy({ jiraHelpers, isLoggedIn: true })) as IssueType[];

  console.log({ issueTypes });

  return {
    issueTypes,
    userData: await getAllTeamData(
      storage,
      issueTypes.map((type) => type.name)
    ),
  };
};

export type TeamDataCache = Awaited<ReturnType<typeof getTeamDataWithIssueTypes>>;

export type UseAllTeamData = (jiraFields: IssueFields) => {
  issueTypes: Array<{
    name: string;
    hierarchLevel: number;
  }>;
  userAllTeamData: AllTeamData;
  augmentedAllTeamData: AllTeamData;
};

export const useAllTeamData: UseAllTeamData = (jiraFields) => {
  const storage = useStorage();
  const jira = useJira();

  const { data } = useSuspenseQuery({
    queryKey: updateTeamConfigurationKeys.allTeamData,
    queryFn: async () => getTeamDataWithIssueTypes(jira, storage),
  });

  return {
    issueTypes: data.issueTypes,
    userAllTeamData: data.userData,
    augmentedAllTeamData: applyInheritance("__GLOBAL__", applyGlobalDefaultData(data.userData, jiraFields)),
  };
};

export type UseTeamData = (
  teamName: string,
  jiraFields: IssueFields
) => {
  userTeamData: TeamConfiguration;
  augmentedTeamData: TeamConfiguration;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

export const useTeamData: UseTeamData = (teamName, jiraFields) => {
  const { userAllTeamData, augmentedAllTeamData, issueTypes } = useAllTeamData(jiraFields);

  const userData = userAllTeamData[teamName] || createEmptyTeamConfiguration(issueTypes.map((type) => type.name));
  const augmented = applyInheritance(teamName, augmentedAllTeamData)[teamName]!;

  console.table(userData);
  console.table(augmented);

  return {
    userTeamData: userData,
    augmentedTeamData: augmented,
    getInheritance: (issueType) => {
      let empty = createEmptyTeamConfiguration(issueTypes.map((type) => type.name));

      if (issueType !== "defaults") {
        empty = { ...empty, defaults: { ...augmented.defaults } };
      }

      return getInheritedData(empty, augmentedAllTeamData);
    },
  };
};
