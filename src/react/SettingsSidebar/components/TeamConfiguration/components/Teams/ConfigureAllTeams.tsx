import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";
import type { IssueFields } from "./services/team-configuration";

import React from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import { Accordion, AccordionContent, AccordionTitle } from "../../../../../components/Accordion";
import { useSaveTeamData, useTeamData } from "./services/team-configuration";

import AllTeamsDefaultForm from "./AllTeamsDefaultsForm";
import ConfigureTeams from "./ConfigureTeams";

export interface ConfigureAllTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jiraFields: IssueFields;
}

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, onUpdate, ...props }) => {
  const { savedUserTeamData, inheritedTeamData } = useTeamData("__GLOBAL__", jiraFields);

  const { save, isSaving } = useSaveTeamData({
    teamName: "__GLOBAL__",
    hierarchyLevel: "defaults",
    onUpdate,
  });

  return (
    <>
      <Accordion startsOpen>
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
            savedUserData={savedUserTeamData.defaults}
            inheritedData={inheritedTeamData.defaults}
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
