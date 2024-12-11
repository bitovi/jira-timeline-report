import type { AllTeamData, IssueFields, TeamConfiguration } from "../team-configuration";
import type { Jira } from "../../../../../../../jira-oidc-helpers";
import type { AppStorage } from "../../../../../../../jira/storage/common";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import {
  applyGlobalDefaultData,
  applyInheritance,
  createEmptyTeamConfiguration,
  fixAnyNonExistingFields,
  getAllTeamData,
  getInheritedData,
} from "../../team-configuration";
import { getSimplifiedIssueHierarchy } from "../../../../../../../stateful-data/jira-data-requests";
import { useJira } from "../../../../../../services/jira";

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const getTeamDataWithIssueHierarchys = async (
  jiraHelpers: Jira,
  storage: AppStorage
): Promise<{ userData: AllTeamData; issueHeirarchy: IssueHierarchy[] }> => {
  const [issueHeirarchy, jiraIssues] = await Promise.all([
    getSimplifiedIssueHierarchy({
      jiraHelpers,
      isLoggedIn: true,
    }) as Promise<IssueHierarchy[]>,
    jiraHelpers.fetchJiraFields() as unknown as Promise<IssueFields>,
  ]);

  const userData = await getAllTeamData(
    storage,
    issueHeirarchy.map((type) => type.hierarchyLevel.toString())
  );

  const normalizedTeamData = fixAnyNonExistingFields(storage, userData, jiraIssues);

  return {
    issueHeirarchy,
    userData: normalizedTeamData,
  };
};

export type TeamDataCache = Awaited<ReturnType<typeof getTeamDataWithIssueHierarchys>>;

export type UseAllTeamData = (jiraFields: IssueFields) => {
  issueHeirarchy: Array<{
    name: string;
    hierarchyLevel: number;
  }>;
  userAllTeamData: AllTeamData;
  augmentedAllTeamData: AllTeamData;
};

export const useAllTeamData: UseAllTeamData = (jiraFields) => {
  const storage = useStorage();
  const jira = useJira();

  const { data } = useSuspenseQuery({
    queryKey: updateTeamConfigurationKeys.allTeamData,
    queryFn: async () => getTeamDataWithIssueHierarchys(jira, storage),
  });

  return {
    issueHeirarchy: data.issueHeirarchy,
    userAllTeamData: data.userData,
    augmentedAllTeamData: applyInheritance(
      "__GLOBAL__",
      applyGlobalDefaultData(data.userData, jiraFields),
      data.issueHeirarchy.map((level) => level.hierarchyLevel.toString())
    ),
  };
};

export type UseTeamData = (
  teamName: string,
  jiraFields: IssueFields
) => {
  userTeamData: TeamConfiguration;
  augmentedTeamData: TeamConfiguration;
  getHierarchyLevelName: (level: number | string) => string;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

export const useTeamData: UseTeamData = (teamName, jiraFields) => {
  const { userAllTeamData, augmentedAllTeamData, issueHeirarchy } = useAllTeamData(jiraFields);

  const userData =
    userAllTeamData[teamName] ||
    createEmptyTeamConfiguration(issueHeirarchy.map((type) => type.hierarchyLevel.toString()));
  const augmented = applyInheritance(
    teamName,
    augmentedAllTeamData,
    issueHeirarchy.map((level) => level.hierarchyLevel.toString())
  )[teamName]!;

  return {
    userTeamData: userData,
    augmentedTeamData: augmented,
    getHierarchyLevelName: (unformattedLevel: number | string) => {
      const level =
        typeof unformattedLevel === "number" ? unformattedLevel : parseInt(unformattedLevel, 10);
      const issueHeirarchyLevel = issueHeirarchy.find((issue) => issue.hierarchyLevel === level);

      if (!issueHeirarchyLevel) {
        console.warn(
          [
            "Could not determine the issue hierarchy name",
            `getHeirarchyLevelName was given "${level}" when the only available are [${issueHeirarchy
              .map(({ hierarchyLevel }) => hierarchyLevel)
              .join(", ")}]`,
            "Returning a default - Story",
          ].join("\n")
        );

        return "Story";
      }

      return issueHeirarchyLevel.name;
    },
    getInheritance: (issueType) => {
      let empty = createEmptyTeamConfiguration(
        issueHeirarchy.map((type) => type.hierarchyLevel.toString())
      );

      if (issueType !== "defaults") {
        empty = { ...empty, defaults: { ...augmented.defaults } };
      }

      return getInheritedData(
        empty,
        augmentedAllTeamData,
        issueHeirarchy.map((level) => level.hierarchyLevel.toString())
      );
    },
  };
};
