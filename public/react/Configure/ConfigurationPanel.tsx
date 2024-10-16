import type { FC } from "react";
// TODO move to shared
import type { TeamConfigurationWrapperProps } from "./components/Teams";

import React, { useState } from "react";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";

import ConfigureTeams from "./components/Teams";
import TeamSelector, { TeamSelectorProps } from "./components/TeamSelector";

import SidebarButton from "../components/SidebarButton";
import { useJiraIssueFields } from "./services/jira";
import { useAllTeamData } from "./components/Teams/services/team-configuration";
import ConfigureAllTeams from "./components/Teams/ConfigureAllTeams";

export interface ConfigurationPanelProps
  extends Pick<TeamConfigurationWrapperProps, "onUpdate" | "storage">,
    TeamSelectorProps {
  onBackButtonClicked: () => void;
}

type TeamName = "global" | (string & {});

const ConfigurationPanel: FC<ConfigurationPanelProps> = ({
  onBackButtonClicked,
  derivedIssuesObservable,
  ...props
}) => {
  const jiraFields = useJiraIssueFields();
  const { userAllTeamData, augmentedAllTeamData } = useAllTeamData(jiraFields);

  const [selectedTeam, setSelectedTeam] = useState<TeamName>("global");

  return (
    <div className="w-full h-full flex">
      <div className="w-56 border-r border-neutral-30 pr-4">
        <SidebarButton onClick={onBackButtonClicked}>
          <ArrowLeftCircleIcon label="go back" />
          Go back
        </SidebarButton>
        <TeamSelector
          teamsFromStorage={Object.keys(userAllTeamData)}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          derivedIssuesObservable={derivedIssuesObservable}
        />
      </div>
      {selectedTeam === "global" && (
        <div className="w-96">
          <ConfigureAllTeams jiraFields={jiraFields} {...props} />
        </div>
      )}
      {!!selectedTeam && selectedTeam !== "global" && (
        <div className="w-96">
          <ConfigureTeams teamName={selectedTeam} jiraFields={jiraFields} {...props} />
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;
