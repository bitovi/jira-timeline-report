import {
  StacheElement,
  type,
  ObservableObject,
  ObservableArray,
  value,
  queues,
} from "../../../can.js";

import {
  saveJSONToUrl,
  updateUrlParam,
  makeArrayOfStringsQueryParamValue,
} from "../../routing/state-storage.js";
import { getSimplifiedIssueHierarchy } from "../../../stateful-data/jira-data-requests.js";

import { createRoot } from "react-dom/client";
import { createElement } from "react";

import TeamConfigure from "../../../react/Configure";
import ViewReports from "../../../react/ViewReports";

import {
  getAllTeamData,
  createFullyInheritedConfig,
} from "../../../react/Configure/components/Teams/services/team-configuration";
import { createNormalizeConfiguration } from "../../../react/Configure/components/Teams/shared/normalize";
//import { getTeamData } from "../stateful-data/jira-data-requests.js";

import {
  rawIssuesRequestData,
  configurationPromise,
  derivedIssuesRequestData,
  serverInfoPromise,
} from "./state-helpers.js";

import { allStatusesSorted, allReleasesSorted } from "../../../jira/normalized/normalize.js";

import "../status-filter.js";
import "./timing-calculation/timing-calculation.js";

const booleanParsing = {
  parse: (x) => {
    return { "": true, true: true, false: false }[x];
  },
  stringify: (x) => "" + x,
};

const selectStyle =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

const GOBACK_BUTTON = `
  <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
    on:click="this.showSettings = ''">
    <img src="/images/go-back.svg" class="inline"/> Go back</button>
`;

export class TimelineConfiguration extends StacheElement {
  static view = `
    <div class="px-3 py-2 h-full min-w-40">

        {{# if(this.showSidebarBranding)}}
          <div class="flex gap-2 pt-4">
            <div class="flex-none pt-1">
              <img src="./images/eggbert-light-minimum.svg"/>
            </div>
            <div class="flex-auto grow items-baseline leading-4">
              <div class="color-gray-900 underline-on-hover bitovi-font-poppins font-bold">
                <a href="https://github.com/bitovi/jira-timeline-report" target="_blank">
                  Status Reports
                </a>
              </div>
              <div class="bitovi-poppins text-neutral-100 text-sm">
                <a href="https://www.bitovi.com/services/agile-project-management-consulting" target="_blank">
                  by Bitovi
                </a>
              </div>
            </div>
          </div>
        {{/ if}}

        {{# not(this.showSettings) }}
            <h3 class="font-bold uppercase text-slate-300 text-xs pt-6 pb-1">Report Settings</h3>
        
            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50 w-full text-left"
                on:click="this.showSettings = 'SOURCES'"
                >
                    <img src="/images/magnifying-glass.svg" class="inline  align-bottom"/> 
                    <span class="pl-3">Sources</span></button>
            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                on:click="this.showSettings = 'TIMING'">
                <img src="/images/calendar.svg" class="inline  align-bottom"/>
                <span class="pl-3">Timing</span></button>

            <h3 class="font-bold uppercase text-slate-300 text-xs pt-4 pb-1">Global Settings</h3>

            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                on:click="this.showSettings = 'TEAMS'">
                    <img src="/images/team.svg" class="inline align-bottom"/> 
                    <span class="pl-3">Teams</span>
            </button>

            <div class="fixed bottom-4 grid justify-items-center gap-2 p-1">
              <img class='pb-2' width="24px" src="./images/_QuestionCircleIcon_.svg"/>
              <a class='link text-slate-300 text-sm' target="_blank" 
                href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started"
              >
                Read the guide
              </a>
              <a class='link text-slate-300 text-sm' target="_blank" 
                href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira.html"
              >
                APM Training
              </a>
              <a class='link text-slate-300 text-sm' target="_blank" 
                href="https://www.bitovi.com/services/agile-project-management-consulting"
              >
                Connect with Bitovi
              </a>
            </div>
        {{/ not }}
        
        <div width="w-96"  class="{{^ eq(this.showSettings, "SOURCES")}}hidden{{/}}">
            ${GOBACK_BUTTON}
            <h3 class="h3">Issue Source</h3>
            <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
            <p>
                {{# if(this.isLoggedIn) }}
                <textarea class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'></textarea>
                {{ else }}
                <input class="w-full-border-box mt-2 form-border p-1 text-yellow-300" value="Sample data. Connect to Jira to specify." disabled/>
                {{/ if}}
            </p>
            
            {{# if(this.rawIssuesRequestData.issuesPromise.isRejected) }}
                <div class="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
                <p>There was an error loading from Jira!</p>
                <p>Error message: {{this.rawIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>
                <p>Please check your JQL is correct!</p>
                </div>
            {{/ if }}
            <div class="flex justify-between mt-1">

                <p class="text-xs flex">
                    <input type='checkbox' 
                        class='self-start align-middle h-6 mr-0.5' checked:bind='this.loadChildren'/>
                        <div class="align-middle h-6" style="line-height: 26px">
                            Load children. 
                            {{# if(this.loadChildren) }}
                                Optional children JQL filters: <input type='text' class="form-border p-1 h-5" value:bind="this.childJQL"/>
                            {{/ if }}
                        </div>
                </p>
                <p class="text-xs" style="line-height: 26px;">
                    {{# if(this.rawIssuesRequestData.issuesPromise.isPending) }}
                        {{# if(this.rawIssuesRequestData.progressData.issuesRequested)}}
                            Loaded {{this.rawIssuesRequestData.progressData.issuesReceived}} of {{this.rawIssuesRequestData.progressData.issuesRequested}} issues
                        {{ else }}
                            Loading issues ...
                        {{/ if}}
                    {{/ if }}
                    {{# if(this.rawIssuesRequestData.issuesPromise.isResolved) }}
                        Loaded {{this.rawIssuesRequestData.issuesPromise.value.length}} issues
                    {{/ if }}
                </p>
                
            </div>

            {{# and(this.statuses, this.statuses.length) }}
                <h4 class='py-2 text-sm text-slate-300 font-bold'>Statuses to exclude from all issue types</h4>
                <status-filter 
                    statuses:from="this.statuses"
                    param:raw="statusesToExclude"
                    selectedStatuses:bind="this.statusesToExclude"
                    inputPlaceholder:raw="Search for statuses"
                    style="max-width: 400px;">
                </status-filter>
            {{/ and }}

        </div>
        


        
        <div class="{{^ eq(this.showSettings, "TIMING")}}hidden{{/}}">
            ${GOBACK_BUTTON}
            <timing-calculation 
                jiraHelpers:from="this.jiraHelpers"
                issueTimingCalculations:to="this.issueTimingCalculations"></timing-calculation>
        </div>
        

  
        <div class="{{^ eq(this.showSettings, "TEAMS")}}hidden{{/}} h-full">
           <div id="team-configuration" class='h-full'></div>
        </div>

        <div class="{{^ eq(this.showSettings, "REPORTS")}}hidden{{/}} h-full">
          <div id="view-reports" style="width:100vw;" class='h-full'></div>
        </div>

    </div>
        `;

  static props = {
    // passed
    showSettings: saveJSONToUrl("settings", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    jql: saveJSONToUrl("jql", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),
    loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
    childJQL: saveJSONToUrl("childJQL", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    statusesToExclude: makeArrayOfStringsQueryParamValue("statusesToExclude"),

    // from children
    issueTimingCalculations: null,
    storage: null,
    normalizeOptions: null,

    // VALUES DERIVING FROM THE `jql`
    rawIssuesRequestData: {
      value({ listenTo, resolve }) {
        return rawIssuesRequestData(
          {
            jql: value.from(this, "jql"),
            childJQL: value.from(this, "childJQL"),
            loadChildren: value.from(this, "loadChildren"),
            isLoggedIn: value.from(this, "isLoggedIn"),
            jiraHelpers: this.jiraHelpers,
            fields: value.from(this, "fields"),
          },
          { listenTo, resolve }
        );
      },
    },
    get serverInfoPromise() {
      return serverInfoPromise({
        jiraHelpers: this.jiraHelpers,
        isLoggedIn: value.from(this, "isLoggedIn"),
      });
    },
    get configurationPromise() {
      return configurationPromise({
        serverInfoPromise: this.serverInfoPromise,
        normalizeObservable: value.from(this.normalizeOptions),
      });
    },
    configuration: {
      async() {
        return this.configurationPromise;
      },
    },
    derivedIssuesRequestData: {
      value({ listenTo, resolve }) {
        return derivedIssuesRequestData(
          {
            rawIssuesRequestData: value.from(this, "rawIssuesRequestData"),
            configurationPromise: value.from(this, "configurationPromise"),
          },
          { listenTo, resolve }
        );
      },
    },
    get derivedIssuesPromise() {
      return this.derivedIssuesRequestData.issuesPromise;
    },
    derivedIssues: {
      async() {
        return this.derivedIssuesRequestData.issuesPromise;
      },
    },
    // PROPERTIES DERIVING FROM `derivedIssues`
    get statuses() {
      if (this.derivedIssues) {
        return allStatusesSorted(this.derivedIssues);
      } else {
        return [];
      }
    },
    get isShowingTeams() {
      return this.showSettings === "TEAMS";
    },
    get isShowingReports() {
      return this.showSettings === "REPORTS";
    },
    goBack() {
      this.showSettings = "";
    },
  };
  // HOOKS
  connectedCallback() {
    Promise.all([
      this.jiraHelpers.fetchJiraFields(),
      getAllTeamData(this.storage),
      getSimplifiedIssueHierarchy(this.jiraHelpers, { isLoggedIn: this.isLoggedIn }),
    ])
      .then(([jiraFields, teamData, hierarchyLevels]) => {
        const allTeamData = createFullyInheritedConfig(
          teamData,
          jiraFields,
          hierarchyLevels.map((type) => type.hierarchyLevel.toString())
        );
        return allTeamData;
      })
      .then((allTeamData) => {
        const normalizedConfig = createNormalizeConfiguration(allTeamData);
        return normalizedConfig;
      })
      .catch(() => {
        // Could fail because storage hasn't been setup yet
        return {};
      })
      .then(({ fields, ...config }) => {
        queues.batch.start();
        this.fields = fields;
        this.normalizeOptions = config;
        queues.batch.stop();
      });

    createRoot(document.getElementById("team-configuration")).render(
      createElement(TeamConfigure, {
        storage: this.storage,
        jira: this.jiraHelpers,
        derivedIssuesObservable: value.from(this, "derivedIssues"),
        showingTeamsObservable: value.from(this, "isShowingTeams"),
        onUpdate: ({ fields, ...configuration }) => {
          queues.batch.start();
          this.fields = fields;
          this.normalizeOptions = configuration;
          queues.batch.stop();
        },
        onBackButtonClicked: () => {
          this.showSettings = "";
        },
      })
    );

    createRoot(document.getElementById("view-reports")).render(
      createElement(ViewReports, {
        storage: this.storage,
        showingReportsObservable: value.from(this, "isShowingReports"),
        onBackButtonClicked: () => {
          this.showSettings = "";
        },
      })
    );
  }
  connected() {}
  // METHODS
}

// jql =>
//
//    rawIssues =>
//        typeToIssueType

// timingCalculations

// firstIssueTypeWithStatuses(primaryIssueType, typeToIssueType, timingCalculations)

// primaryIssueType

customElements.define("timeline-configuration", TimelineConfiguration);
