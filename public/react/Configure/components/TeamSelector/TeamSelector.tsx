import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";
import SettingsIcon from "@atlaskit/icon/glyph/settings";
import ArrowRightCircleIcon from "@atlaskit/icon/glyph/arrow-right-circle";
import { Label } from "@atlaskit/form";

import SidebarButton from "../../../components/SidebarButton";
import { CanObservable, useCanObservable } from "../../../hooks/useCanObservable";
import Hr from "../../../components/Hr";
import TeamListItem from "./components/TeamListItem";

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

  const teams = mergeTeams(derivedTeams, teamsFromStorage)
    .filter(({ name }) => name !== "__GLOBAL__")
    .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

  const groups = Object.groupBy(teams, ({ status }) => status);

  return (
    <>
      <div className="my-4">
        <Heading size="small">Team Configuration</Heading>
      </div>
      <Label htmlFor="default-settings">DEFAULT</Label>
      <SidebarButton
        className="mt-2"
        isActive={selectedTeam === "global"}
        onClick={() => setSelectedTeam("global")}
      >
        <SettingsIcon label="default settings" />
        <p className="flex-1">Default Settings</p>
        {selectedTeam === "global" && <ArrowRightCircleIcon label="default settings selected" />}
      </SidebarButton>
      <Hr />
      {derivedTeams.length === 0 && (
        <>
          <Label htmlFor="">TEAMS</Label>
          <div>Derived Teams Not Found please add an issue source to show teams</div>
        </>
      )}
      {(groups.storageAndReport?.length || groups.reportOnly?.length) && (
        <>
          <Label htmlFor="">TEAMS IN REPORT</Label>
          {groups.storageAndReport?.map((team) => {
            return (
              <TeamListItem
                key={team.name}
                team={team}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            );
          })}
          {groups.reportOnly?.map((team) => {
            return (
              <TeamListItem
                key={team.name}
                team={team}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            );
          })}
        </>
      )}
      {groups.storageOnly?.length && (
        <div className="mt-2">
          <Label htmlFor="">TEAMS OUTSIDE REPORT</Label>
          {groups.storageOnly?.map((team) => {
            return (
              <TeamListItem
                key={team.name}
                team={team}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            );
          })}
        </div>
      )}
    </>
  );
};

export default TeamSelector;

const getDerivedTeams = (
  derivedIssue: TeamSelectorProps["derivedIssuesObservable"]["value"]
): string[] => {
  if (!derivedIssue) {
    return [];
  }

  return [...new Set(derivedIssue.map(({ team }) => team.name))];
};

const mergeTeams = (
  derivedTeams: string[],
  teamsFromStorage: string[]
): Array<{ name: string; status: "reportOnly" | "storageOnly" | "storageAndReport" }> => {
  const allNames = [...new Set([...derivedTeams, ...teamsFromStorage])];

  return allNames.map((name) => {
    const inDerived = derivedTeams.includes(name);
    const inStorage = teamsFromStorage.includes(name);

    if (inDerived && inStorage) {
      return { name, status: "storageAndReport" };
    }

    if (inDerived) {
      return { name, status: "reportOnly" };
    }

    return { name, status: "storageOnly" };
  });
};
