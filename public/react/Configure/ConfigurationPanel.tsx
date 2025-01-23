import type { FC } from "react";
import type { NormalizeIssueConfig } from "../../jira/normalized/normalize";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { useState } from "react";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";

import ConfigureTeams from "./components/Teams";
import TeamSelector from "./components/TeamSelector";
import SidebarButton from "../components/SidebarButton";
import ConfigureAllTeams from "./components/Teams/ConfigureAllTeams";
import { useJiraIssueFields } from "../services/jira";
import { useAllTeamData } from "./components/Teams/services/team-configuration";
import { StorageCheck } from "../services/storage";

export interface ConfigurationPanelProps {
  onBackButtonClicked: () => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
  showSidebarBranding: boolean;
}

type TeamName = "global" | (string & {});

const ConfigurationPanel: FC<ConfigurationPanelProps> = ({
  onBackButtonClicked,
  derivedIssuesObservable,
  showSidebarBranding,
  ...configurationProps
}) => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);

  const [selectedTeam, setSelectedTeam] = useState<TeamName>("global");

  return (
    <div className="w-full h-full flex">
      <div className="w-56 border-r border-neutral-30 pr-4 flex flex-col">
        {showSidebarBranding && <Branding />}
        <SidebarButton onClick={onBackButtonClicked}>
          <ArrowLeftCircleIcon label="go back" />
          Go back
        </SidebarButton>
        <TeamSelector
          teamsFromStorage={Object.keys(savedUserAllTeamData)}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          derivedIssuesObservable={derivedIssuesObservable}
        />
      </div>
      {/* checks that configuration issue exists */}
      <StorageCheck>
        {selectedTeam === "global" && (
          <div className="w-128 overflow-auto">
            <ConfigureAllTeams jiraFields={jiraFields} {...configurationProps} />
          </div>
        )}
        {!!selectedTeam && selectedTeam !== "global" && (
          <div key={selectedTeam} className="w-128 overflow-auto">
            <ConfigureTeams
              teamName={selectedTeam}
              jiraFields={jiraFields}
              {...configurationProps}
            />
          </div>
        )}
      </StorageCheck>
    </div>
  );
};

// TODO: consolidate this with the branding from timeline-configuration
const Branding: FC<{}> = () => {
  return (
    <div className="flex gap-2 pt-4">
      <div className="flex-none pt-1">
        <img alt="Bitovi" src="./images/eggbert-light-minimum.svg" />
      </div>
      <div className="flex-auto grow items-baseline leading-4">
        <div className="color-gray-900 underline-on-hover bitovi-font-poppins font-bold">
          <a href="https://github.com/bitovi/jira-timeline-report" target="_blank">
            Status Reports
          </a>
        </div>
        <div className="bitovi-poppins text-neutral-100 text-sm">
          <a
            href="https://www.bitovi.com/services/agile-project-management-consulting"
            target="_blank"
          >
            by Bitovi
          </a>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationPanel;
