import type { FC } from "react";
import type { IssueFields, TeamConfiguration } from "./services/team-configuration";
import type { NormalizeIssueConfig } from "../../../../../../jira/normalized/normalize";

import React, { Fragment } from "react";
import Heading from "@atlaskit/heading";
import Spinner from "@atlaskit/spinner";

import { Accordion, AccordionContent, AccordionTitle } from "../../../../../components/Accordion";

import { useTeamData } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";
import { useTeamForm } from "./useTeamForm";
import Hr from "../../../../../components/Hr";

interface IssueAccordionProps {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  getInheritance: (hierarchyLevel: keyof TeamConfiguration) => TeamConfiguration;
  getHierarchyLevelName: (level: number | string) => string;
  jiraFields: IssueFields;
  inheritedTeamData: TeamConfiguration;
  savedUserTeamData: TeamConfiguration;
}

const IssueAccordion: FC<IssueAccordionProps> = ({
  hierarchyLevel,
  jiraFields,
  getHierarchyLevelName,
  ...formData
}) => {
  const { isSaving, ...formProps } = useTeamForm({
    hierarchyLevel,
    ...formData,
  });

  return (
    <Accordion startsOpen={hierarchyLevel === "defaults"}>
      <AccordionTitle>
        <Heading size="small">
          {hierarchyLevel === "defaults"
            ? `Team defaults (${formData.teamName})`
            : getHierarchyLevelName(hierarchyLevel)}
        </Heading>
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
  const { inheritedTeamData, ...teamData } = useTeamData(teamName, jiraFields);

  const hierarchyLevels = Object.keys(inheritedTeamData)
    // hierarchyLevels should be defaults first then highest level to lowest
    .sort((lhs, rhs) => {
      if (lhs === "defaults") return -1;
      if (rhs === "defaults") return 1;

      return parseInt(rhs) - parseInt(lhs);
    })
    .filter((issueType): issueType is keyof TeamConfiguration => {
      if (teamName === "__GLOBAL__") {
        // Remove return false and return line 82 once ready to integrate issue types
        return false;
        // return issueType !== "defaults";
      }

      return true;
    });

  return (
    <>
      {hierarchyLevels.map((hierarchyLevel, index) => {
        const isLast = index === hierarchyLevels.length - 1;

        return (
          <Fragment key={hierarchyLevel}>
            <IssueAccordion
              teamName={teamName}
              hierarchyLevel={hierarchyLevel}
              onUpdate={onUpdate}
              jiraFields={jiraFields}
              inheritedTeamData={inheritedTeamData}
              {...teamData}
            />
            {!isLast && <Hr className="my-2 h-[2px]" />}
          </Fragment>
        );
      })}
    </>
  );
};

export default ConfigureTeams;
