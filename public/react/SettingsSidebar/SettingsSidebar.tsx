import React, { FC, useState } from "react";

import { value } from "../../can";

import routeData from "../../canjs/routing/route-data";

import TeamConfiguration from "./components/TeamConfiguration";
import ViewReports from "./components/ViewReports";

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
const SETTINGS_WIDTH: Record<string, string> = {
  SOURCES: "w-96",
  THEME: "w-80",
  TIMING: "w-80",
  TEAMS: "w-[600px]",
};
const SettingsSidebar: FC<SettingsSidebarProps> = ({
  showSidebarBranding,
  onUpdateTeamsConfiguration,
}) => {
  const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));
  const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string } }[]> =
    value.from(routeData, "derivedIssues");

  const [settingVisible, setSettingVisible] = useState(false);
  const settingsWidth = showSettings ? SETTINGS_WIDTH[showSettings] : "w-0";

  const changeSettings = (settings = "") => {
    routeData.showSettings = settings;
  };
  const returnToSettings = () => changeSettings("");
  return (
    <div className="px-6 py-2 h-full min-w-40">
      {showSidebarBranding && <Branding />}
      {!showSettings && <ReportSettings changeSettings={changeSettings} />}
      {!!showSettings && showSettings !== "TEAMS" && (
        <GoBackButton hideSettings={returnToSettings} />
      )}
      <div
        className={`overflow-hidden h-full transition-[width] duration-500 ease-in-out ${settingsWidth}`}
        onTransitionEnd={() => {
          setSettingVisible(!!showSettings);
        }}
      >
        {settingVisible && (
          <>
            {showSettings === "SOURCES" && <IssueSource />}
            {showSettings === "TIMING" && <TimingCalculation />}
            {showSettings === "TEAMS" && (
              <TeamConfiguration
                derivedIssuesObservable={derivedIssuesObservable}
                showSidebarBranding={showSidebarBranding}
                onUpdate={onUpdateTeamsConfiguration}
                onBackButtonClicked={() => returnToSettings()}
              />
            )}
            {showSettings === "THEME" && <Theme onBackButtonClicked={changeSettings} />}
            {showSettings === "REPORTS" && <ViewReports onBackButtonClicked={changeSettings} />}
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsSidebar;
