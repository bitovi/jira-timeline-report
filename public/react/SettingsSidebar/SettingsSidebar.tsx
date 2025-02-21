import React, { FC } from "react";

import { value } from "../../can";

import routeData from "../../canjs/routing/route-data";

import TeamConfiguration from "./components/TeamConfiguration";

import { CanObservable, useCanObservable } from "../hooks/useCanObservable";
import Branding from "./components/Branding";
import ReportSettings from "./components/ReportSettings";
import GoBackButton from "./components/GoBackButton";
import IssueSource from "./components/IssueSource";
import TimingCalculation from "./components/TimingCalculation";
import { NormalizeIssueConfig } from "../../jira/normalized/normalize";
import Theme from "./components/Theme";

export interface SettingsSidebarProps {
  showSidebarBranding: boolean;
  onUpdateTeamsConfiguration: (
    overrides: Partial<NormalizeIssueConfig & { fields: string[] }>
  ) => void;
}

const SettingsSidebar: FC<SettingsSidebarProps> = ({
  showSidebarBranding,
  onUpdateTeamsConfiguration,
}) => {
  const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));
  const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string } }[]> =
    value.from(routeData, "derivedIssues");

  const changeSettings = (settings = "") => {
    routeData.showSettings = settings;
  };

  const returnToSettings = () => changeSettings("");

  return (
    <div className="px-6 py-2 h-full min-w-40 overflow-y-auto">
      {showSidebarBranding && showSettings !== "TEAMS" && <Branding />}
      {!showSettings && <ReportSettings changeSettings={changeSettings} />}
      {!!showSettings && showSettings !== "TEAMS" && (
        <GoBackButton hideSettings={returnToSettings} />
      )}
      {showSettings === "SOURCES" && (
        <div className="w-96">
          <IssueSource />
        </div>
      )}
      {showSettings === "TIMING" && <TimingCalculation />}
      {showSettings === "TEAMS" && (
        <div className="h-full">
          <TeamConfiguration
            derivedIssuesObservable={derivedIssuesObservable}
            showSidebarBranding={showSidebarBranding}
            onUpdate={onUpdateTeamsConfiguration}
            onBackButtonClicked={() => returnToSettings()}
          />
        </div>
      )}
      {showSettings === "THEME" && (
        <div className="w-80 h-full">
          <Theme onBackButtonClicked={changeSettings} />
        </div>
      )}
    </div>
  );
};

export default SettingsSidebar;
