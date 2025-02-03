import React, { FC } from "react";

import { ObservableObject, value, Observation } from "../../../can";

import untypedRouteData, {
  RouteData as RouteDataClass,
} from "../../../canjs/routing/route-data.js";

import TeamConfigure from "../../../react/Configure";
import ViewReports from "../../../react/ViewReports";
import type { LinkBuilderFactory } from "../../../routing/common";

import { CanObservable, useCanObservable } from "../../hooks/useCanObservable/useCanObservable.js";
import { Jira } from "../../../jira-oidc-helpers/index.js";
import Branding from "./components/Branding";
import ReportSettings from "./components/ReportSettings";
import GoBackButton from "./components/GoBackButton";
import IssueSource from "./components/IssueSource";
import TimingCalculation from "./components/TimingCalculation";
import { NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import Theme from "../../Theme";

type RouteDataProps = typeof RouteDataClass.props;
type RouteData = {
  [k in keyof RouteDataProps]: any;
} & {
  assign: (obj: Partial<RouteData>) => RouteData;
} & typeof ObservableObject;
const routeData: RouteData = untypedRouteData as RouteData;

export interface SettingsSidebarProps {
  isLoggedIn: boolean;
  showSidebarBranding: boolean;
  jiraHelpers: Jira;
  linkBuilder: ReturnType<LinkBuilderFactory>;
  onUpdateTeamsConfiguration: (
    overrides: Partial<NormalizeIssueConfig & { fields: string[] }>
  ) => void;
}

export const SettingsSidebar: FC<SettingsSidebarProps> = ({
  isLoggedIn,
  showSidebarBranding,
  jiraHelpers,
  linkBuilder,
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
    <div className="px-3 py-2 h-full min-w-40">
      {showSidebarBranding && <Branding />}
      {!showSettings && <ReportSettings changeSettings={changeSettings} />}
      {!!showSettings && showSettings !== "TEAMS" && (
        <GoBackButton hideSettings={returnToSettings} />
      )}
      {showSettings === "SOURCES" && (
        <div className="w-96">
          <IssueSource isLoggedIn={isLoggedIn} jiraHelpers={jiraHelpers} />
        </div>
      )}
      {showSettings === "TIMING" && <TimingCalculation />}
      {showSettings === "TEAMS" && (
        <div className="h-full">
          <TeamConfigure
            storage={routeData.storage}
            jira={routeData.jiraHelpers}
            derivedIssuesObservable={derivedIssuesObservable}
            showSidebarBranding={showSidebarBranding}
            onUpdate={onUpdateTeamsConfiguration}
            onBackButtonClicked={() => returnToSettings()}
          />
        </div>
      )}
      {showSettings === "THEME" && (
        <div className="w-80 h-full">
          <Theme storage={routeData.storage} onBackButtonClicked={changeSettings} />
        </div>
      )}
      {showSettings === "REPORTS" && (
        <div className="h-full">
          <ViewReports
            storage={routeData.storage}
            onBackButtonClicked={changeSettings}
            linkBuilder={linkBuilder}
          />
        </div>
      )}
    </div>
  );
};
