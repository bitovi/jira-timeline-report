import type { FC } from "react";
// TODO move to shared
import type { TeamConfigurationWrapperProps } from "./components/Teams";

import React, { useState } from "react";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";

import ConfigureTeams from "./components/Teams";
import TeamSelector from "./components/TeamSelector";

import SidebarButton from "../components/SidebarButton";

export interface ConfigurationPanelProps
  extends Pick<TeamConfigurationWrapperProps, "onInitialDefaultsLoad" | "onUpdate" | "storage"> {
  onBackButtonClicked: () => void;
}

type TeamName = "global" | (string & {});

const ConfigurationPanel: FC<ConfigurationPanelProps> = ({ onBackButtonClicked, ...props }) => {
  const [selectedTeam, setSelectedTeam] = useState<TeamName>("global");

  return (
    <div className="w-full h-full flex">
      <div className="w-56 border-r border-neutral-30 pr-4">
        <SidebarButton onClick={onBackButtonClicked}>
          <ArrowLeftCircleIcon label="go back" />
          Go back
        </SidebarButton>
        <TeamSelector selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} />
      </div>
      {selectedTeam === "global" && (
        <div className="w-96">
          <ConfigureTeams {...props} />
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;
