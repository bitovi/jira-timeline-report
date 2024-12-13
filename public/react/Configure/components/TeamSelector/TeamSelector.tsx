import type { FC } from "react";

import React from "react";
import Heading from "@atlaskit/heading";
import SettingsIcon from "@atlaskit/icon/glyph/settings";
import ArrowRightCircleIcon from "@atlaskit/icon/glyph/arrow-right-circle";
import PeopleGroupIcon from "@atlaskit/icon/glyph/people-group";
import { Label } from "@atlaskit/form";
import EditorUnlinkIcon from "@atlaskit/icon/glyph/editor/unlink";
import Badge from "@atlaskit/badge";

import SidebarButton from "../../../components/SidebarButton";
import { CanObservable, useCanObservable } from "../../../hooks/useCanObservable";
import Hr from "../../../components/Hr";
import Tooltip from "@atlaskit/tooltip";

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

  console.log({ teams, groups, derivedTeams, teamsFromStorage });

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
      {(groups["in-both"]?.length || groups["only-derived"]?.length) && (
        <>
          <Label htmlFor="">TEAMS IN REPORT</Label>
          {groups["in-both"]?.map((team) => {
            return (
              <TeamListItem
                key={team.name}
                team={team}
                selectedTeam={selectedTeam}
                setSelectedTeam={setSelectedTeam}
              />
            );
          })}
          {groups["only-derived"]?.map((team) => {
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
      {groups["only-storage"]?.length && (
        <>
          <Label htmlFor="">TEAMS OUTSIDE REPORT</Label>
          {groups["only-storage"]?.map((team) => {
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
    </>
  );
};

export default TeamSelector;

export interface TeamListItemProps {
  team: ReturnType<typeof mergeTeams>[number];
  selectedTeam: "global" | (string & {});
  setSelectedTeam: (team: string) => void;
}

const TeamListItem: FC<TeamListItemProps> = ({ team, selectedTeam, setSelectedTeam }) => {
  return (
    <SidebarButton
      key={team.name}
      className="mt-2 items-center justify-center"
      isActive={selectedTeam === team.name}
      onClick={() => setSelectedTeam(team.name)}
    >
      <div className="[&>span]:!block">
        <PeopleGroupIcon label={`${team} settings`} />
      </div>
      <div className="flex-1 flex flex-col justify-between items-start">
        {team.name}
        {team.status === "only-derived" && <Badge>not configured</Badge>}
        {/* {team.status !== "in-both" && (
          <Tooltip position="top" content={getStatusText(team.status)}>
            <EditorUnlinkIcon label="unlinked team data" />
          </Tooltip>
        )} */}
      </div>
      {selectedTeam === team.name && <ArrowRightCircleIcon label={`${team} settings selected`} />}
    </SidebarButton>
  );
};

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

const getStatusText = (status: "only-derived" | "only-storage") => {
  if (status === "only-derived") {
    return "Team does not exist in storage";
  }

  return "Team does not exist in derrived issues";
};
