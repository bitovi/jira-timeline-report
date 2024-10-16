import type { FC } from "react";
import type { ConfigureTeamsFormProps } from "./ConfigureTeamsForm";

import React from "react";
import Heading from "@atlaskit/heading";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";
import { StorageNeedsConfigured } from "../../services/storage";
import { useAllTeamData, useGlobalTeamConfiguration, useTeamData } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";
import { useJiraIssueFields } from "../../services/jira";
import { IssueFields, TeamConfiguration } from "./services/team-configuration/data";
import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";

export interface ConfigureTeamsProps {
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
  jiraFields: IssueFields;
}

const ConfigureTeams: FC<ConfigureTeamsProps> = (props) => {
  // const userData = useGlobalTeamConfiguration();
  // const jiraFields = useJiraIssueFields();
  // const { userAllTeamData, augmentedAllTeamData } = useAllTeamData(jiraFields);

  // if (!userData) {
  //   return <StorageNeedsConfigured />;
  // }

  return <IssueAccordions {...props} />;
};

export default ConfigureTeams;

const issueNameMapping: Record<keyof TeamConfiguration, string> = {
  defaults: "Team default",
  outcome: "Outcomes",
  milestones: "Milestones",
  initiatives: "Initiatives",
  epics: "Epics",
  stories: "Stores",
};

const IssueAccordions = ({ teamName, jiraFields, ...props }: { teamName: string; jiraFields: IssueFields }) => {
  const { userTeamData, augmentedTeamData } = useTeamData(teamName, jiraFields);

  if (!userTeamData) {
    return null;
  }

  if (!augmentedTeamData) {
    return null;
  }

  return (
    <>
      {Object.keys(augmentedTeamData).map((key) => (
        <Accordion key={key}>
          <AccordionTitle>
            <Heading size="small">{issueNameMapping[key as keyof TeamConfiguration]}</Heading>
          </AccordionTitle>
          <AccordionContent>
            <ConfigureTeamsForm
              jiraFields={jiraFields}
              userData={userTeamData[key as keyof TeamConfiguration]}
              augmented={augmentedTeamData[key as keyof TeamConfiguration]}
              {...props}
            />
          </AccordionContent>
        </Accordion>
      ))}
    </>
  );
};
