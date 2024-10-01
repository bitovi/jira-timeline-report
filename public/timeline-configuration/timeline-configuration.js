import { StacheElement, type, ObservableObject, ObservableArray, value } from "../can.js";

import { saveJSONToUrl, updateUrlParam } from "../shared/state-storage.js";
import {
  calculationKeysToNames,
  allTimingCalculationOptions,
  getImpliedTimingCalculations,
} from "../prepare-issues/date-data.js";

import { createRoot } from "react-dom/client";
import { createElement } from "react";

import TeamConfigure from "../react/Configure/Teams/index";

import {
  rawIssuesRequestData,
  configurationPromise,
  derivedIssuesRequestData,
  serverInfoPromise,
} from "./state-helpers.js";

import { allStatusesSorted, allReleasesSorted } from "../jira/normalized/normalize.js";

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
    <div class="">

        {{# not(this.showSettings) }}
            <h3 class="font-bold uppercase text-slate-300 text-xs">Report Settings</h3>
        
            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50 w-full text-left"
                on:click="this.showSettings = 'SOURCES'"
                >Sources</button>
            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                on:click="this.showSettings = 'TIMING'">Timing</button>

            <h3 class="font-bold uppercase text-slate-300 text-xs pt-2">Global Settings</h3>

            <button class="block p-2 text-sm text-slate-300 hover:bg-blue-50  w-full text-left"
                on:click="this.showSettings = 'TEAMS'">Teams</button>
        {{/ not }}

        
        <div width="w-96"  class="{{^ eq(this.showSettings, "SOURCES")}}hidden{{/}}">
            ${GOBACK_BUTTON}
            <h3 class="h3">Issue Source</h3>
            <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
            <p>
                {{# if(this.isLoggedIn) }}
                <input class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'/>
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
                    selectedStatuses:to="this.statusesToExclude"
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
        

  
        <div class="{{^ eq(this.showSettings, "TEAMS")}}hidden{{/}}">
            <div>${GOBACK_BUTTON}</div>
            <div> <div id="team-configuration"></div></div>
        </div>


        <p class="pt-6">
            <h3 class="font-bold uppercase text-slate-300 text-xs">Questions? </h3>
            <a class="link block" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started">Guide</a>
            <a class="link block" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions">Connect</a>
        </p>  
    </div>
        `;

  static props = {
    // passed
    showSettings: saveJSONToUrl("settings", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),
    jql: saveJSONToUrl("jql", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),
    loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
    childJQL: saveJSONToUrl("childJQL", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),

    // from children
    issueTimingCalculations: null,

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
          },
          { listenTo, resolve }
        );
      },
    },
    get serverInfoPromise() {
      return serverInfoPromise({ jiraHelpers: this.jiraHelpers, isLoggedIn: value.from(this, "isLoggedIn") });
    },
    get configurationPromise() {
      return configurationPromise({
        teamConfigurationPromise: this.teamConfigurationPromise,
        serverInfoPromise: this.serverInfoPromise,
        normalizeOptionsObservable: value.from(this.normalizeOptions),
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

    /*
        allTimingCalculationOptions: {
            async(resolve) {
                if(this.derivedIssuesRequestData.issuesPromise) {
                    return this.derivedIssuesRequestData.issuesPromise.then( issues => {
                        return allTimingCalculationOptions(issues);
                    })
                }
            }
        },

        // PROPERTIES only needing primaryIssue type and what it depends on

        // looks like [{type: "initiative", calculation: "children-only"}, ...]
        // in the URL like ?timingCalculations=initiative:children-only,epic:self
        
        get impliedTimingCalculations(){
            if(this.primaryIssueType) {
                return getImpliedTimingCalculations(this.primaryIssueType, 
                    this.allTimingCalculationOptions.map, 
                    this.timingCalculations);
            }
        },

        // PROPERTIES from having a primaryIssueType and timingCalculations
        
        // used to get the name of the secondary issue type


        get timingCalculationMethods() {
            if(this.primaryIssueType) {
                return this.impliedTimingCalculations
                    .map( (calc) => calc.calculation)
            }
        },

        get timingLevels(){
            if(this.primaryIssueType) {
                return getTimingLevels(this.allTimingCalculationOptions.map, this.primaryIssueType, this.timingCalculations);
            }            
        },
        get rollupTimingLevelsAndCalculations(){
            if(this.impliedTimingCalculations) {
                const impliedCalculations = this.impliedTimingCalculations;
                const primaryIssueType = this.primaryIssueType;
                const primaryIssueHierarchy = this.allTimingCalculationOptions.map[this.primaryIssueType].hierarchyLevel;
                const rollupCalculations = [];
                for( let i = 0; i < impliedCalculations.length + 1; i++) {
                    rollupCalculations.push({
                        type: i === 0 ? primaryIssueType : impliedCalculations[i-1].type,
                        hierarchyLevel: i === 0 ? primaryIssueHierarchy : impliedCalculations[i-1].hierarchyLevel,
                        calculation: i >= impliedCalculations.length  ? "parentOnly" : impliedCalculations[i].calculation
                    })
                }
                return rollupCalculations;
            }
        },
        */
    // dependent on primary issue type
  };
  // HOOKS
  connectedCallback() {
    createRoot(document.getElementById("team-configuration")).render(
      createElement(TeamConfigure, {
        appKey: this.jiraHelpers.appKey,
        onUpdate: (partial) => {
          this.normalizeOptions = partial;
        },
        onInitialDefaultsLoad: (partial) => {
          this.normalizeOptions = partial;
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
