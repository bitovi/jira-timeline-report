/**
 * Hooks to fetch and manage team data with Jira issue hierarchy
 */
import type { AllTeamData, IssueFields, TeamConfiguration } from "../team-configuration";
import type { Jira } from "../../../../../../../../../jira-oidc-helpers";
import type { AppStorage } from "../../../../../../../../../jira/storage/common";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../../../../../../../services/storage";
import { updateTeamConfigurationKeys } from "../key-factory";
import {
  applyGlobalDefaultData,
  applyInheritance,
  createEmptyTeamConfiguration,
  fixAnyNonExistingFields,
  getAllTeamData,
  getInheritedData,
} from "../../team-configuration";
import { getSimplifiedIssueHierarchy } from "../../../../../../../../../stateful-data/jira-data-requests";
import { useJira } from "../../../../../../../../services/jira";

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const getTeamDataWithIssueHierarchys = async (
  jiraHelpers: Jira,
  storage: AppStorage
): Promise<{ savedUserData: AllTeamData; issueHeirarchy: IssueHierarchy[] }> => {
  const [issueHeirarchy, jiraIssues] = await Promise.all([
    getSimplifiedIssueHierarchy({
      jiraHelpers,
      isLoggedIn: true,
    }) as Promise<IssueHierarchy[]>,
    jiraHelpers.fetchJiraFields() as unknown as Promise<IssueFields>,
  ]);

  const savedUserData = await getAllTeamData(
    storage,
    issueHeirarchy.map((type) => type.hierarchyLevel.toString())
  );

  const normalizedTeamData = fixAnyNonExistingFields(storage, savedUserData, jiraIssues);

  return {
    issueHeirarchy,
    savedUserData: normalizedTeamData,
  };
};

export type TeamDataCache = Awaited<ReturnType<typeof getTeamDataWithIssueHierarchys>>;

export type UseAllTeamData = (jiraFields: IssueFields) => {
  issueHeirarchy: Array<{
    name: string;
    hierarchyLevel: number;
  }>;
  savedUserAllTeamData: AllTeamData;
  inheritedAllTeamData: AllTeamData;
};

/**
 * Retrieves and processes all team-related data, including user-specific team configurations and the issue hierarchy.
 * Once the data is fetched, it applies global default data and inheritance logic to the user data,
 * enriching it based on the Jira fields and issue hierarchy.
 */
export const useAllTeamData: UseAllTeamData = (jiraFields) => {
  const storage = useStorage();
  const jira = useJira();

  const { data } = useSuspenseQuery({
    queryKey: updateTeamConfigurationKeys.allTeamData,
    queryFn: async () => getTeamDataWithIssueHierarchys(jira, storage),
  });

  return {
    issueHeirarchy: data.issueHeirarchy,
    savedUserAllTeamData: data.savedUserData,
    inheritedAllTeamData: applyInheritance(
      "__GLOBAL__",
      applyGlobalDefaultData(data.savedUserData, jiraFields),
      data.issueHeirarchy.map((level) => level.hierarchyLevel.toString())
    ),
  };
};

export type UseTeamData = (
  teamName: string,
  jiraFields: IssueFields
) => {
  savedUserTeamData: TeamConfiguration;
  inheritedTeamData: TeamConfiguration;
  getHierarchyLevelName: (level: number | string) => string;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
};

/**
 * retrieves and processes team-specific data for a given team name, providing both the user-specific
 * configuration and the inherited configuration, along with helper functions for hierarchy and inheritance.
 */
export const useTeamData: UseTeamData = (teamName, jiraFields) => {
  const { savedUserAllTeamData, inheritedAllTeamData, issueHeirarchy } = useAllTeamData(jiraFields);

  const savedUserData =
    savedUserAllTeamData[teamName] ||
    createEmptyTeamConfiguration(issueHeirarchy.map((type) => type.hierarchyLevel.toString()));
  const inherited = applyInheritance(
    teamName,
    inheritedAllTeamData,
    issueHeirarchy.map((level) => level.hierarchyLevel.toString())
  )[teamName]!;

  return {
    savedUserTeamData: savedUserData,
    inheritedTeamData: inherited,
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
        empty = { ...empty, defaults: { ...inherited.defaults } };
      }

      return getInheritedData(
        empty,
        inheritedAllTeamData,
        issueHeirarchy.map((level) => level.hierarchyLevel.toString())
      );
    },
  };
};
