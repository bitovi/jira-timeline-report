import React from "react";
import { GoBackButton, Branding, TimingCalculation, IssueSource, ReportSettings } from "./components";
import {
    ObservableObject,
    value,
    queues,
    Observation,
} from "../../../can";

import untypedRouteData, { RouteData as RouteDataClass } from "../../../canjs/routing/route-data.js";

import TeamConfigure from "../../../react/Configure";
import ViewReports from "../../../react/ViewReports";
import type { LinkBuilderFactory } from "../../../routing/common";

import { CanObservable, useCanObservable } from "../../hooks/useCanObservable/useCanObservable.js";
import { Jira } from "../../../jira-oidc-helpers/index.js";

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
}

export const SettingsSidebar = ({
    isLoggedIn,
    showSidebarBranding,
    jiraHelpers,
    linkBuilder
}: SettingsSidebarProps) => {
    const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));
    const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string; } }[]> = value.from(routeData, "derivedIssues");
    const isShowingTeamsObserve = new Observation(() => routeData.showSettings === "TEAMS");

    const changeSettings = (settings: string = '') => { routeData.showSettings = settings };

    return (
        <div className="px-3 py-2 h-full min-w-40">
            {showSettings ? null : (
                <>
                    <Branding showSidebarBranding={showSidebarBranding} />
                    <ReportSettings changeSettings={changeSettings} />
                </>
            )}
            <div className={`w-96 ${showSettings === "SOURCES" ? "" : "hidden"}`}>
                <Branding showSidebarBranding={showSidebarBranding} />
                <GoBackButton hideSettings={() => changeSettings()} />
                <IssueSource isLoggedIn={isLoggedIn} jiraHelpers={jiraHelpers} />
            </div>
            <div className={showSettings === "TIMING" ? "" : "hidden"}>
                <Branding showSidebarBranding={showSidebarBranding} />
                <GoBackButton hideSettings={() => changeSettings()} />
                <TimingCalculation />
            </div>
            <div className={`${showSettings === "TEAMS" ? "" : "hidden"} h-full`}>
                <div className='h-full'>
                    <TeamConfigure
                        storage={routeData.storage}
                        jira={routeData.jiraHelpers}
                        derivedIssuesObservable={derivedIssuesObservable}
                        showingTeamsObservable={isShowingTeamsObserve as unknown as CanObservable<boolean>}
                        showSidebarBranding={showSidebarBranding}
                        {...{}/* @ts-expect-error */}
                        onUpdate={({ fields, ...configuration }) => {
                            queues.batch.start();

                            routeData.fieldsToRequest = fields;
                            routeData.normalizeOptions = configuration;
                            queues.batch.stop();
                        }}
                        onBackButtonClicked={() => {
                            routeData.showSettings = "";
                        }}
                    />
                </div>
            </div>
            <div className={`${showSettings === "REPORTS" ? "" : "hidden"} h-full`}>
                <div id="view-reports" style={{ width: "100vw" }} className='h-full'>
                    <ViewReports
                        storage={routeData.storage}
                        showingReportsObservable={new Observation(() => routeData.showSettings === "REPORTS") as unknown as CanObservable<boolean>}
                        onBackButtonClicked={() => {
                            routeData.showSettings = "";
                        }}
                        linkBuilder={linkBuilder}
                    />
                </div>
            </div>

        </div>
    );
}
