import type { FC } from "react";
// TODO move to shared
import type { ConfigureTeamsProps } from "./components/Teams/ConfigureTeams";

import React, { Suspense, useState } from "react";
import Heading from "@atlaskit/heading";
import { Label } from "@atlaskit/form";
import SettingsIcon from "@atlaskit/icon/glyph/settings";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";
import ArrowRightCircleIcon from "@atlaskit/icon/glyph/arrow-right-circle";

import ConfigureTeams from "./components/Teams";
import { ErrorBoundary } from "react-error-boundary";
import { StorageProvider } from "./services/storage";

interface TeamSelectorProps extends Pick<ConfigureTeamsProps, "onInitialDefaultsLoad" | "onUpdate"> {
  onBackButtonClicked: () => void;
  storage: any;
}

type TeamName = "global" | (string & {});

const TeamSelector: FC<TeamSelectorProps> = ({ onBackButtonClicked, storage, ...props }) => {
  const [team, setTeam] = useState<TeamName>("global");

  const getButtonClasses = (name: TeamName) => {
    return [
      "p-2",
      "flex",
      "align-center",
      "gap-2",
      "text-sm",
      "text-slate-300",
      "w-full",
      "text-left",
      name === team ? "bg-blue-50" : "bg-inherit",
      "focus:bg-blue-50",
      "hover:bg-blue-50",
    ].join(" ");
  };

  return (
    <div className="w-full h-full flex">
      <div className="w-56 border-r border-neutral-30 pr-4">
        <button onClick={onBackButtonClicked} className={getButtonClasses("")}>
          <ArrowLeftCircleIcon label="go back" />
          Go back
        </button>
        <div className="my-4">
          <Heading size="small">Team Configuration</Heading>
        </div>
        <Label htmlFor="default-settings">DEFAULT</Label>
        <button className={getButtonClasses("global")} onClick={() => setTeam("global")}>
          <SettingsIcon label="default settings" />
          <p className="flex-1">Default Settings</p>
          {team === "global" && <ArrowRightCircleIcon label="default settings selected" />}
        </button>
      </div>
      {team === "global" && (
        <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
          <Suspense fallback="...loading">
            <StorageProvider storage={storage}>
              <ConfigureTeams {...props} />{" "}
            </StorageProvider>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
};

export default TeamSelector;
