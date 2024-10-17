import type { FC } from "react";
import type { IssueFields, TeamConfiguration } from "./services/team-configuration";

import React from "react";
import Heading from "@atlaskit/heading";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";

import { useTeamData } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";

import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";

export interface ConfigureTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
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

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ teamName, jiraFields, ...props }) => {
  const { userTeamData, augmentedTeamData } = useTeamData(teamName, jiraFields);

  return (
    <>
      {Object.keys(augmentedTeamData).map((rawKey) => {
        const key = rawKey as keyof TeamConfiguration;

        return (
          <Accordion key={key} startsOpen>
            <AccordionTitle>
              <Heading size="small">{issueNameMapping[key]}</Heading>
            </AccordionTitle>
            <AccordionContent>
              <ConfigureTeamsForm
                jiraFields={jiraFields}
                userData={userTeamData[key]}
                augmented={augmentedTeamData[key]}
                {...props}
              />
            </AccordionContent>
          </Accordion>
        );
      })}
    </>
  );
};

export default ConfigureTeams;
