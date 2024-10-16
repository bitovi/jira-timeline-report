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
  teamsFromStorage: string[];
  selectedTeam: "global" | (string & {});
  setSelectedTeam: (team: string) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
}

const TeamSelector: FC<TeamSelectorProps> = ({
  selectedTeam,
  setSelectedTeam,
  teamsFromStorage,
  derivedIssuesObservable,
}) => {
  const derivedIssues = useCanObservable(derivedIssuesObservable);
  const derivedTeams = getDerivedTeams(derivedIssues);

  const teams = mergeTeams(derivedTeams, teamsFromStorage);

  console.log({ derivedIssues, teams, teamsFromStorage });

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
            key={team.name}
            className="mt-2"
            isActive={selectedTeam === team.name}
            onClick={() => setSelectedTeam(team.name)}
          >
            <PeopleGroupIcon label={`${team} settings`} />
            <p className="flex-1">
              Team {team.name} ({team.status})
            </p>
            {selectedTeam === team.name && <ArrowRightCircleIcon label={`${team} settings selected`} />}
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

const mergeTeams = (
  derivedTeams: string[],
  teamsFromStorage: string[]
): Array<{ name: string; status: "only-derived" | "only-storage" | "in-both" }> => {
  const allNames = [...new Set([...derivedTeams, ...teamsFromStorage])];

  return allNames.map((name) => {
    const inDerived = derivedTeams.includes(name);
    const inStorage = teamsFromStorage.includes(name);

    if (inDerived && inStorage) {
      return { name, status: "in-both" };
    }

    if (inDerived) {
      return { name, status: "only-derived" };
    }

    return { name, status: "only-storage" };
  });
};
