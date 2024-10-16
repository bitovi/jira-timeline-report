import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../../../jira/normalized/normalize";
import type { IssueFields, TeamConfiguration } from "./services/team-configuration";

import React from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";
import { useSaveTeamData, useTeamData } from "./services/team-configuration";

import ConfigureTeamsForm from "./ConfigureTeamsForm";
import AllTeamsDefaultForm from "./AllTeamsDefaultsForm";

export interface ConfigureAllTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jiraFields: IssueFields;
}

const issueNameMapping: Record<keyof TeamConfiguration, string> = {
  defaults: "Global default",
  outcome: "Outcomes",
  milestones: "Milestones",
  initiatives: "Initiatives",
  epics: "Epics",
  stories: "Stores",
};

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, ...props }) => {
  const { userTeamData, augmentedTeamData } = useTeamData("__GLOBAL__", jiraFields);

  const { save, isSaving } = useSaveTeamData({ teamName: "__GLOBAL__", issueType: "defaults" });

  return (
    <>
      <Accordion startsOpen>
        <AccordionTitle>
          <Heading size="small">Global defaults </Heading>
          {isSaving && (
            <div>
              <Spinner size="small" label="saving" />
            </div>
          )}
        </AccordionTitle>
        <AccordionContent>
          <AllTeamsDefaultForm
            save={save}
            userData={userTeamData.defaults}
            augmented={augmentedTeamData.defaults}
            jiraFields={jiraFields}
            {...props}
          />
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
