import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";
import SettingsIcon from "@atlaskit/icon/glyph/settings";
import ArrowRightCircleIcon from "@atlaskit/icon/glyph/arrow-right-circle";
import PeopleGroupIcon from "@atlaskit/icon/glyph/people-group";
import { Label } from "@atlaskit/form";

import SidebarButton from "../../../components/SidebarButton";
import { CanObservable, useCanObservable } from "../../../hooks/useCanObservable";
import Hr from "../../../components/Hr";

export interface TeamSelectorProps {
  selectedTeam: "global" | (string & {});
  setSelectedTeam: (team: string) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
}

const TeamSelector: FC<TeamSelectorProps> = ({ selectedTeam, setSelectedTeam, derivedIssuesObservable }) => {
  const derivedIssues = useCanObservable(derivedIssuesObservable);
  const teams = getDerivedTeams(derivedIssues);

  console.log({ derivedIssues, teams });

  return (
    <>
      <div className="my-4">
        <Heading size="small">Team Configuration</Heading>
      </div>
      <Label htmlFor="default-settings">DEFAULT</Label>
      <SidebarButton className="mt-2" isActive={selectedTeam === "global"} onClick={() => setSelectedTeam("global")}>
        <SettingsIcon label="default settings" />
        <p className="flex-1">Default Settings</p>
        {selectedTeam === "global" && <ArrowRightCircleIcon label="default settings selected" />}
      </SidebarButton>
      <Hr />
      <Label htmlFor="">TEAMS</Label>
      {teams.map((team) => {
        return (
          <SidebarButton
            key={team}
            className="mt-2"
            isActive={selectedTeam === team}
            onClick={() => setSelectedTeam(team)}
          >
            <PeopleGroupIcon label={`${team} settings`} />
            <p className="flex-1">Team {team}</p>
            {selectedTeam === team && <ArrowRightCircleIcon label={`${team} settings selected`} />}
          </SidebarButton>
        );
      })}
    </>
  );
};

export default TeamSelector;

const getDerivedTeams = (derivedIssue: TeamSelectorProps["derivedIssuesObservable"]["value"]): string[] => {
  if (!derivedIssue) {
    return [];
  }

  return [...new Set(derivedIssue.map(({ team }) => team.name))].sort();
};
