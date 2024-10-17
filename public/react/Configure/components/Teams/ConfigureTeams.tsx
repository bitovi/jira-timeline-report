import type { FC } from "react";
import type { IssueFields, TeamConfiguration } from "./services/team-configuration";

import React from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";

import { useSaveTeamData, useTeamData } from "./services/team-configuration";
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

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ teamName, jiraFields, onUpdate, ...props }) => {
  const { userTeamData, augmentedTeamData, getInheritance } = useTeamData(teamName, jiraFields);

  console.log({ userTeamData, augmentedTeamData });

  return (
    <>
      {Object.keys(augmentedTeamData).map((rawKey) => {
        const key = rawKey as keyof TeamConfiguration;
        const { save, isSaving } = useSaveTeamData({ teamName, issueType: key, onUpdate });

        return (
          <Accordion key={key}>
            <AccordionTitle>
              <Heading size="small">{issueNameMapping[key]}</Heading>
              {isSaving && (
                <div>
                  <Spinner size="small" label="saving" />
                </div>
              )}
            </AccordionTitle>
            <AccordionContent>
              <ConfigureTeamsForm
                getInheritance={() => getInheritance(key)[key]}
                jiraFields={jiraFields}
                userData={userTeamData[key]}
                augmented={augmentedTeamData[key]}
                save={save}
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
