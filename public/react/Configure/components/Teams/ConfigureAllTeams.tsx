import type { FC } from "react";
import type { ConfigureTeamsFormProps } from "./ConfigureTeamsForm";

import React from "react";
import Heading from "@atlaskit/heading";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";
import { StorageNeedsConfigured } from "../../services/storage";
import { useAllTeamData, useGlobalTeamConfiguration, useTeamData } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";
import { useJiraIssueFields } from "../../services/jira";
import { createEmptyTeamConfiguration, IssueFields, TeamConfiguration } from "./services/team-configuration/data";
import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import AllTeamsDefaultForm from "./AllTeamsDefaultsForm";

export interface ConfigureAllTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jiraFields: IssueFields;
}

const issueNameMapping: Record<keyof TeamConfiguration, string> = {
  defaults: "Team default",
  outcome: "Outcomes",
  milestones: "Milestones",
  initiatives: "Initiatives",
  epics: "Epics",
  stories: "Stores",
};

const logData = (augmentedTeamData: TeamConfiguration, userTeamData: TeamConfiguration) => {
  console.log("augmented");
  console.table(augmentedTeamData);

  console.log("userData");
  console.table(userTeamData);
};

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, ...props }) => {
  const { userTeamData, augmentedTeamData } = useTeamData("__GLOBAL__", jiraFields);

  logData(augmentedTeamData, userTeamData);

  return (
    <>
      <Accordion startsOpen>
        <AccordionTitle>
          <Heading size="small">Global defaults</Heading>
        </AccordionTitle>
        <AccordionContent>
          <AllTeamsDefaultForm userData={userTeamData.defaults} augmented={augmentedTeamData.defaults} {...props} />
        </AccordionContent>
      </Accordion>
      {Object.keys(augmentedTeamData)
        .filter((issueType) => issueType !== "defaults")
        .map((key) => (
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

export default ConfigureAllTeams;
