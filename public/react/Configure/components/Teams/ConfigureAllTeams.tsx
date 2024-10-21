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
import ConfigureTeams from "./ConfigureTeams";

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

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, onUpdate, ...props }) => {
  const { userTeamData, augmentedTeamData } = useTeamData("__GLOBAL__", jiraFields);

  const { save, isSaving } = useSaveTeamData({ teamName: "__GLOBAL__", issueType: "defaults", onUpdate });

  return (
    <>
      <Accordion>
        <AccordionTitle>
          <Heading size="small">Global defaults</Heading>
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
      <ConfigureTeams jiraFields={jiraFields} teamName="__GLOBAL__" onUpdate={onUpdate} />
    </>
  );
};

export default ConfigureAllTeams;
