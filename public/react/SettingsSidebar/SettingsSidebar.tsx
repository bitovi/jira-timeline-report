import React, { FC } from "react";

import { value } from "../../can";

import routeData from "../../canjs/routing/route-data";

import TeamConfiguration from "./components/TeamConfiguration";

import { CanObservable, useCanObservable } from "../hooks/useCanObservable";
import Branding from "./components/Branding";
import ReportSettings from "./components/ReportSettings";
import IssueSource from "./components/IssueSource";
import TimingCalculation from "./components/TimingCalculation";
import { NormalizeIssueConfig } from "../../jira/normalized/normalize";
import Theme from "./components/Theme";
import SidebarLayout from "./components/SidebarLayout";

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
    <div className="h-full min-w-40">
      {showSidebarBranding && <Branding />}
      {!showSettings && <ReportSettings changeSettings={changeSettings} />}
      {showSettings === "SOURCES" && (
        <SidebarLayout onGoBack={returnToSettings} className="w-96">
          <IssueSource />
        </SidebarLayout>
      )}
      {showSettings === "TIMING" && (
        <SidebarLayout onGoBack={returnToSettings}>
          <TimingCalculation />
        </SidebarLayout>
      )}
      {showSettings === "TEAMS" && (
        // Special case
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
        <SidebarLayout onGoBack={returnToSettings} className="w-80">
          <Theme onBackButtonClicked={changeSettings} />
        </SidebarLayout>
      )}
    </div>
  );
};

export default SettingsSidebar;
