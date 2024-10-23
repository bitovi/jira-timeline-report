import type { FC } from "react";
import type { IssueFields, TeamConfiguration } from "./services/team-configuration";

import React from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";

import { useTeamData } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";

import { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import { useTeamForm } from "./useTeamForm";

const issueNameMapping: Record<keyof TeamConfiguration, string> = {
  defaults: "Team default",
  outcome: "Outcomes",
  milestones: "Milestones",
  initiatives: "Initiatives",
  epics: "Epics",
  stories: "Stories",
};

interface IssueAccordionProps {
  teamName: string;
  issueType: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  getInheritance: (issueType: keyof TeamConfiguration) => TeamConfiguration;
  jiraFields: IssueFields;
  augmentedTeamData: TeamConfiguration;
  userTeamData: TeamConfiguration;
}

const IssueAccordion: FC<IssueAccordionProps> = ({ issueType, jiraFields, ...formData }) => {
  const { isSaving, ...formProps } = useTeamForm({ issueType, ...formData });

  return (
    <Accordion startsOpen={issueType === "defaults"}>
      <AccordionTitle>
        <Heading size="small">{issueNameMapping[issueType]}</Heading>
        {isSaving && (
          <div>
            <Spinner size="small" label="saving" />
          </div>
        )}
      </AccordionTitle>
      <AccordionContent>
        <ConfigureTeamsForm jiraFields={jiraFields} {...formProps} />
      </AccordionContent>
    </Accordion>
  );
};

export interface ConfigureTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
  jiraFields: IssueFields;
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ teamName, jiraFields, onUpdate }) => {
  const { augmentedTeamData, ...teamData } = useTeamData(teamName, jiraFields);

  const teamIssues = Object.keys(augmentedTeamData).filter((issueType): issueType is keyof TeamConfiguration => {
    if (teamName === "__GLOBAL__") {
      // Remove return false and return line 82 once ready to integrate issue types
      return false;
      // return issueType !== "defaults";
    }

    return true;
  });

  return (
    <>
      {teamIssues.map((issueType) => {
        return (
          <IssueAccordion
            key={issueType}
            teamName={teamName}
            issueType={issueType}
            onUpdate={onUpdate}
            jiraFields={jiraFields}
            augmentedTeamData={augmentedTeamData}
            {...teamData}
          />
        );
      })}
    </>
  );
};

export default ConfigureTeams;
