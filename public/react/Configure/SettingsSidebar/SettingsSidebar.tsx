import React, { useEffect, useMemo, useRef } from "react";
import {
  StacheElement,
  type,
  ObservableObject,
  ObservableArray,
  value as untypedValue,
  queues,
  Observation,
} from "../../../can.js";

type Value = {
    from: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>
    bind: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>
}
const value: Value = untypedValue as unknown as Value;

import untypedRouteData, { RouteData as RouteDataClass } from "../../../canjs/routing/route-data.js";

import type { JiraIssue, NormalizedIssue } from "../../../jira/shared/types.js";
import type { OidcJiraIssue } from "../../../jira-oidc-helpers/types.js";

import { getSimplifiedIssueHierarchy } from "../../../stateful-data/jira-data-requests.js";

import TeamConfigure from "../../../react/Configure";
import ViewReports from "../../../react/ViewReports";

import {
  getAllTeamData,
  createFullyInheritedConfig,
} from "../../../react/Configure/components/Teams/services/team-configuration";
import { createNormalizeConfiguration } from "../../../react/Configure/components/Teams/shared/normalize";
//import { getTeamData } from "../stateful-data/jira-data-requests.js";

type RouteDataProps = typeof RouteDataClass.props;
type RouteData = {
    [k in keyof RouteDataProps]: any;
} & typeof ObservableObject;
const routeData: RouteData = untypedRouteData as RouteData;

import { allStatusesSorted, allReleasesSorted } from "../../../jira/normalized/normalize.js";

import { TimingCalculation } from "../TimingCalculation";
import { CanObservable, useCanObservable } from "../../hooks/useCanObservable/useCanObservable.js";
import { StatusFilter } from "../../../canjs/controls/status-filter.js";

type CanPromise<T> = Promise<T> & {
    isResolved: boolean;
    isRejected: boolean;
    isPending: boolean;
    reason: {
        errorMessages: string[];
    };
    value: T;
};

const selectStyle =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";


interface GoBackButtonProps {
    hideSettings: () => void;
}

const GoBackButton: React.FC<GoBackButtonProps> = ({ hideSettings }) => (
  <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
    onClick={hideSettings}>
    <img src="/images/go-back.svg" className="inline"/> Go back</button>
);

interface BrandingProps {
    showSidebarBranding: boolean;
}

const Branding: React.FC<BrandingProps> = ({ showSidebarBranding }) => (
  showSidebarBranding ? (
    <div className="flex gap-2 pt-4">
      <div className="flex-none pt-1">
        <img src="./images/eggbert-light-minimum.svg"/>
      </div>
      <div className="flex-auto grow items-baseline leading-4">
        <div className="color-gray-900 underline-on-hover bitovi-font-poppins font-bold">
          <a href="https://github.com/bitovi/jira-timeline-report" target="_blank">
            Status Reports
          </a>
        </div>
        <div className="bitovi-poppins text-neutral-100 text-sm">
          <a href="https://www.bitovi.com/services/agile-project-management-consulting" target="_blank">
            by Bitovi
          </a>
        </div>
      </div>
    </div>
  ) : null
);

export interface SettingsSidebarProps {
    isLoggedIn: boolean;
    showSidebarBranding: boolean;
}

export const SettingsSidebar = ({
    isLoggedIn,
    showSidebarBranding,
}: SettingsSidebarProps) => {
    const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));
    const issuesPromise = useCanObservable<CanPromise<JiraIssue[] | OidcJiraIssue[]>>(value.from(routeData, "rawIssuesRequestData.issuesPromise"));
    const issuesReceived = useCanObservable<number>(value.from(routeData, "rawIssuesRequestData.progressData.issuesReceived"));
    const issuesRequested = useCanObservable<number>(value.from(routeData, "rawIssuesRequestData.progressData.issuesRequested"));
    const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string; } }[]> = value.from(routeData, "derivedIssues");
    const loadChildren = useCanObservable<boolean>(value.from(routeData, "loadChildren"));
    const jql = useCanObservable<string>(value.from(routeData, "jql"));
    const childJQL = useCanObservable<string>(value.from(routeData, "childJQL"));

    const processStatuses = () => {
        // @ts-expect-error
        if (derivedIssuesObservable.get()) {
            // @ts-expect-error
            return allStatusesSorted(derivedIssuesObservable.get());
        } else {
            return [];
        }
    };
    const statuses = useCanObservable(new Observation(processStatuses) as unknown as CanObservable<JiraIssue[] | OidcJiraIssue[]>);
    const numberOfStatuses = useCanObservable(new Observation(() => processStatuses()?.length) as unknown as CanObservable<number>);
    const isShowingTeamsObserve = new Observation(() => routeData.showSettings === "TEAMS");

    const hideSettings = () => { routeData.showSettings = '' };

    const statusFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(statusFilterRef.current) {
            // @ts-expect-error
            const statusFilterEl = new StatusFilter().initialize({
                inputPlaceholder: "Search for statuses",
                param: "statusesToExclude",
                style: "max-width: 400px;",
            }).bindings({
                statuses: value.from(processStatuses),
                selectedStatuses: value.bind(routeData, "statusesToExclude")
            })
            statusFilterRef.current?.appendChild(statusFilterEl);
        }
    }, [numberOfStatuses]);

  return (
    <>
    <div className="px-3 py-2 h-full min-w-40">

        {showSettings ? null : (
            <>
                <Branding showSidebarBranding={showSidebarBranding} />
              
                <h3 className="font-bold uppercase text-slate-300 text-xs pt-6 pb-1">Report Settings</h3>
            
                <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50 w-full text-left"
                    onClick={() => routeData.showSettings = 'SOURCES'}
                >
                    <img src="/images/magnifying-glass.svg" className="inline  align-bottom"/> 
                    <span className="pl-3">Sources</span>
                </button>
                <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                    onClick={() => routeData.showSettings = 'TIMING'}
                >
                    <img src="/images/calendar.svg" className="inline  align-bottom"/>
                    <span className="pl-3">Timing</span>
                </button>

                <h3 className="font-bold uppercase text-slate-300 text-xs pt-4 pb-1">Global Settings</h3>

                <button className="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                    onClick={() => routeData.showSettings = 'TEAMS'}
                >
                    <img src="/images/team.svg" className="inline align-bottom"/> 
                    <span className="pl-3">Teams</span>
                </button>

                <div className="fixed bottom-4 grid justify-items-center gap-2 p-1">
                    <img className='pb-2' width="24px" src="./images/_QuestionCircleIcon_.svg"/>
                    <a className='link text-slate-300 text-sm' target="_blank" 
                        href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started"
                    >
                        Read the guide
                    </a>
                    <a className='link text-slate-300 text-sm' target="_blank" 
                        href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira.html"
                    >
                        APM Training
                    </a>
                    <a className='link text-slate-300 text-sm' target="_blank" 
                        href="https://www.bitovi.com/services/agile-project-management-consulting"
                    >
                        Connect with Bitovi
                    </a>
                </div>
            </>
        )}
        
        <div className={`w-96 ${showSettings === "SOURCES" ? "" : "hidden"}`}>
            <Branding showSidebarBranding={showSidebarBranding} />

            <GoBackButton  hideSettings={hideSettings}/>
            <h3 className="h3">Issue Source</h3>
            <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
            <p>
                {isLoggedIn ? (
                    <textarea className="w-full-border-box mt-2 form-border p-1" value={jql} onChange={(ev) => routeData.jql = ev.target.value}></textarea>
                ) : (
                    <input className="w-full-border-box mt-2 form-border p-1 text-yellow-300" value="Sample data. Connect to Jira to specify." disabled/>
                )}
            </p>
            
            {issuesPromise?.isRejected && (
                <div className="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
                    <p>There was an error loading from Jira!</p>
                    <p>Error message: {issuesPromise.reason.errorMessages[0]}</p>
                    <p>Please check your JQL is correct!</p>
                </div>
            )}
            <div className="flex justify-between mt-1">

                <p className="text-xs">
                    <input type='checkbox'
                        name="loadChildren"
                        className='self-start align-middle h-6 mr-0.5'
                        checked={routeData.loadChildren}
                        onChange={ev => routeData.loadChildren = ev.target.checked}
                    />
                    {" "}
                    <label htmlFor="loadChildren" className="align-middle h-6" style={{ lineHeight: "26px" }}>
                        Load children.
                        {" "}
                    </label>
                    <span className="align-middle h-6">
                        {loadChildren && (
                            <>
                                Optional children JQL filters:
                                {" "}
                                <input 
                                    type='text'
                                    className="form-border p-1 h-5"
                                    value={childJQL}
                                    onChange={(ev) => routeData.childJQL = ev.target.value}
                                />
                            </>
                        )}
                    </span>

                </p>
                <p className="text-xs" style={{ lineHeight: "26px" }}>
                    {issuesPromise?.isPending &&
                        (
                            issuesRequested ? (
                                <>
                                    Loaded {issuesReceived} of {issuesRequested} issues
                                </>
                            ) : (
                                <>Loading issues ...</>
                            )
                        )
                    }
                    {issuesPromise?.isResolved && (
                        <>
                        Loaded {issuesPromise.value.length} issues
                        </>
                    )}
                </p>
                
            </div>

            {!!numberOfStatuses && (
                <>
                    <h4 className='py-2 text-sm text-slate-300 font-bold'>
                        Statuses to exclude from all issue types
                    </h4>
                    <div className="status-filter-container" ref={statusFilterRef} />
                </>
            )}

        </div>
         
        <div className={ showSettings === "TIMING" ? "" : "hidden"}>
            <Branding showSidebarBranding={showSidebarBranding} />
            <GoBackButton hideSettings={hideSettings} />
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
                />
            </div>
        </div>

    </div>
    </>
  );
  // HOOKS
}
