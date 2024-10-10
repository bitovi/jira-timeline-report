import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";
import SettingsIcon from "@atlaskit/icon/glyph/settings";
import ArrowRightCircleIcon from "@atlaskit/icon/glyph/arrow-right-circle";
import { Label } from "@atlaskit/form";

import SidebarButton from "../../../components/SidebarButton";

export interface TeamSelectorProps {
  selectedTeam: "global" | (string & {});
  setSelectedTeam: (team: string) => void;
}

const TeamSelector: FC<TeamSelectorProps> = ({ selectedTeam, setSelectedTeam }) => {
  return (
    <>
      <div className="my-4">
        <Heading size="small">Team Configuration</Heading>
      </div>
      <Label htmlFor="default-settings">DEFAULT</Label>
      <SidebarButton isActive={selectedTeam === "global"} onClick={() => setSelectedTeam("global")}>
        <SettingsIcon label="default settings" />
        <p className="flex-1">Default Settings</p>
        {selectedTeam === "global" && <ArrowRightCircleIcon label="default settings selected" />}
      </SidebarButton>
    </>
  );
};

export default TeamSelector;
