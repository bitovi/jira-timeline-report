import { StacheElement, type, ObservableObject } from "//unpkg.com/can@6/core.mjs";
import { calculationKeysToNames } from "./prepare-issues/date-data.js";



import { howMuchHasDueDateMovedForwardChangedSince,
    DAY_IN_MS, parseDateISOString, epicTimingData } from "./date-helpers.js";



import {
    addStatusToInitiative,
    addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses,
    inIdeaStatus,
    inIdeaStatuses
} from "./status-helpers.js";

import {releasesAndInitiativesWithPriorTiming, 
  rawIssuesToBaseIssueFormat, filterOutInitiativeStatuses, filterQAWork, filterPartnerReviewWork} from "../prepare-issues/prepare-issues.js";

import semverReleases from "./semver-releases.js";
import sortedByLastEpicReleases from "./sorted-by-last-epic-releases.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: "short" });
const booleanParsing = {
  parse: x => {
    return ({"": true, "true": true, "false": false})[x];
  },
  stringify: x => ""+x
};

import { estimateExtraPoints } from "./confidence.js";
import {saveJSONToUrl,updateUrlParam} from "./shared/state-storage.js";

import "./steerco-timeline.js";

const ISSUE_KEY = "Issue key";
const PRODUCT_TARGET_RELEASE_KEY = "Product Target Release";
const ISSUE_TYPE_KEY = "Issue Type";
const PARENT_LINK_KEY = "Parent Link";
const START_DATE_KEY = "Start date";
const DUE_DATE_KEY = "Due date";
const LABELS_KEY = "Labels";
const STATUS_KEY = "Status";
const FIX_VERSIONS_KEY = "Fix versions";


const configurationView = `
<div class="border-gray-100 p-4 {{# not(this.showingConfiguration) }}hidden{{/}}" style="border-top-width: 32px">
  <p>
    Questions on the options? 
    <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started">Read the guide</a>, or 
    <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions">connect with us</a>.
  </p>  
  <h3 class="h3">Issue Source</h3>
  <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
  <p><input class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'/></p>
  {{# if(this.rawIssuesPromise.isPending) }}
    {{# if(this.progressData.issuesRequested)}}
      <p class="text-sm text-right">Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues</p>
    {{ else }}
      <p class="text-sm text-right">Loading issues ...</p>
    {{/ if}}
  {{/ if }}
  {{# if(this.rawIssuesPromise.isRejected) }}
    <div class="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
      <p>There was an error loading from Jira!</p>
      <p>Error message: {{this.rawIssuesPromise.reason.errorMessages[0]}}</p>
      <p>Please check your JQL is correct!</p>
    </div>
  {{/ if }}
  {{# if(this.rawIssuesPromise.isResolved) }}
    <p class="text-sm text-right">Loaded {{this.rawIssues.length}} issues</p>
  {{/ if }}
  

  <h3 class="h3 mt-4">Reporting</h3>
  <p class="mt-2">What Jira Artifacts do you want to report on?</p>
  <div class="flex gap-3 mt-2 ml-2">
    <div>
      Primary Timeline:
    </div>
    {{# for(issueType of this.primaryReportingIssueHierarchy) }}
      <label><input 
        type="radio" 
        name="primary" 
        checked:from="eq(this.primaryIssueType, issueType.type)"
        on:change="this.primaryIssueType = issueType.type"/> {{issueType.plural}} </label>
    {{/ }}
  </div>

  <div class="flex gap-3 mt-2 ml-2">
    <div>
      Secondary Status Report:
    </div>
    <label><input 
        type="radio" 
        name="secondary" 
        checked:from="eq(this.secondaryIssueType, 'none')"
        on:change="this.secondaryIssueType = 'none'"
        /> None </label>
    {{# for(issueType of this.secondaryReportingIssueHierarchy) }}
      <label><input 
        type="radio" 
        name="secondary" 
        checked:from="eq(this.secondaryIssueType, issueType.type)"
        on:change="this.secondaryIssueType = issueType.type"
        /> {{issueType.plural}} </label>
    {{/ }}
  </div>
  


  <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">

    <label class='font-bold'>Sort by Due Date</label>
    <input type='checkbox' 
      class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>
    <p class="m-0">Instead of ordering initiatives based on the order defined in the JQL, 
    sort initiatives by their last epic's due date.
    </p>

    <label class='font-bold'>Report Epics</label>
    <input type='checkbox' 
      class='self-start mt-1.5' checked:bind='this.reportEpics'/>
    <p class="m-0">Report epics instead of Initiatives
    </p>

    

    <label class='font-bold'>Hide Unknown Initiatives</label>
    <input type='checkbox' 
      class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>
    <p class="m-0">Hide initiatives whose timing can't be determined.
    </p>

    <label class='font-bold'>Show Releases</label>
    <input type='checkbox' 
      class='self-start mt-1.5' checked:bind='this.showReleasesInTimeline'/>
    <p class="m-0 ">Instead of showing the timing for initiatives, show the timing for releases. Initiatives
    must have their <code>release</code> (also called <code>Fix version</code>) field set.
    </p>

    {{# if(this.showReleasesInTimeline) }}
    <label class='font-bold'>Show Only Semver Releases</label>
    <input type='checkbox' 
      class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>
    <p class="m-0">This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:
    <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
    </p>
    {{/ }}

    <label class='font-bold'>Break out Dev, QA and UAT</label>
    <input type='checkbox' 
      class='self-start mt-1.5'  checked:bind='this.breakOutTimings'/>
    <p class="m-0">If initiatives have epics labelled with "QA" and/or "UAT", the report will show individual timelines and
      statuses for Development, QA, and UAT.
    </p>

    <label class='font-bold'>Ignore Initiatives in UAT</label>
    <input type='checkbox' 
      class='self-start mt-1.5'  checked:bind='this.hideInitiativesInUAT'/>
    <p class="m-0">Initiatives that are in UAT will not be shown. Check this if you do not want to
    report on work that is in its final stages.
    </p>

    <label class='font-bold'>Ignore Initiatives in Idea</label>
    <input type='checkbox' 
      class='self-start mt-1.5'  checked:bind='this.hideInitiativesInIdea'/>
    <p class="m-0">Initiatives that have an Open, To Do, or Idea status will not be shown.
    </p>


  </div>
</div>`;


export class TimelineReport extends StacheElement {
    static view = `
      <div 
          class="drop-shadow-lg
          fixed left-0 z-50 overflow-auto
          top-fullish-vh height-fullish-vh 
          bg-white flex max-w-4xl" id="configuration">
        
        ${configurationView}

        <div on:click="this.toggleConfiguration()"
          class="w-8 hover:bg-gray-200 cursor-pointer bg-gray-100 ">
        
          {{#not(this.showingConfiguration)}}
            <p class="-rotate-90 w-40 absolute" style="top: 40%; left: -65px">Configure</p>

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-slot="icon" class="w-8 h-8 mt-px">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>

          {{ else }}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-slot="icon" class="w-8 h-8 mt-px">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
        
          {{/}}

        </div>

      </div>
        <div class="w-1280 fullish-vh pt-4 left-config-width {{#this.showingConfiguration}}relative {{else}}place-center{{/}}">



          <div class='p-4 rounded-lg-gray-100-on-white mb-4 drop-shadow-md color-bg-white'>
            <p><label class="inline font-bold">Compare to {{this.compareToTime.text}}</label>
            - Specify what timepoint to use to determine if an initiative or release has fallen behind.</p>
            <input class="w-full-border-box" type='range' valueAsNumber:bind:on:input='this.timeSliderValue' min="0" max="100"/>
          </div>

          


          {{# if( not(this.jql) ) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">Enter a JQL above.</div>
          {{ /if }}

					{{# and(this.rawIssuesPromise.value, this.releases) }}
						<steerco-timeline
							class='my-2  border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md'
							releases:from="this.releases"
							initiatives:from="this.initiativesWithAStartAndEndDate"
							breakOutTimings:from="this.breakOutTimings"
							showReleasesInTimeline:from="this.showReleasesInTimeline"
							/>
          {{/ and }}
          {{# if(this.rawIssuesPromise.isPending) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">
              <p>Loading ...<p>
              {{# if(this.progressData.issuesRequested)}}
                <p>Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues.</p>
              {{/ }}
            </div>
          {{/ if }}
          {{# if(this.rawIssuesPromise.isRejected) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked drop-shadow-md">
              <p>There was an error loading from Jira!</p>
              <p>Error message: {{this.rawIssuesPromise.reason.errorMessages[0]}}</p>
              <p>Please check your JQL is correct!</p>
            </div>
          {{/ if }}



          <details class='rounded-lg-gray-100-on-white my-2 drop-shadow-md' on:toggle="this.showDebug(scope.element.open)">
            <summary>Debug Data</summary>
            <div class='p-4'>
            {{# if(this.showingDebugPanel)}}
              {{# for(release of this.releases) }}
              <h2>{{release.release}}</h2>
              <table class='basic-table'>
                <thead>
                <tr><th>Sequence</th>
                    <th>Start</th>
                    <th>Due</th>
                    <th>Due last period</th>
                    <th>Working days</th>
                    <th>Story Points</th>
                </tr>
                </thead>
                <tbody  class='release_box'>
                <tr>
                  <td class='status-{{release.status}}'>E2E</td>
                  <td>{{this.prettyDate(release.team.start)}}</td>
                  <td>{{this.prettyDate(release.team.due)}}</td>
                  <td>{{this.prettyDate(release.team.dueLastPeriod)}}</td>
                  <td>{{release.team.workingBusinessDays}}</td>
                  <td>{{release.team.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>Dev</td>
                  <td>{{this.prettyDate(release.dev.start)}}</td>
                  <td>{{this.prettyDate(release.dev.due)}}</td>
                  <td>{{this.prettyDate(release.dev.dueLastPeriod)}}</td>
                  <td>{{release.dev.workingBusinessDays}}</td>
                  <td>{{release.dev.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>QA</td>
                  <td>{{this.prettyDate(release.qa.start)}}</td>
                  <td>{{this.prettyDate(release.qa.due)}}</td>
                  <td>{{this.prettyDate(release.qa.dueLastPeriod)}}</td>
                  <td>{{release.qa.workingBusinessDays}}</td>
                  <td>{{release.qa.weightedEstimate}}</td>
                </tr>
                <tr>
                  <td>UAT</td>
                  <td>{{this.prettyDate(release.uat.start)}}</td>
                  <td>{{this.prettyDate(release.uat.due)}}</td>
                  <td>{{this.prettyDate(release.uat.dueLastPeriod)}}</td>
                  <td>{{release.uat.workingBusinessDays}}</td>
                  <td>{{release.uat.weightedEstimate}}</td>
                </tr>
                </tbody>
              </table>
              <table class='basic-table'>
                <thead>
                <tr><th>Initiative</th>
                    <th>Teams</th>
                    <th>Dev Dates</th>
                    <th>Dev Epics</th>

                    <th>QA Dates</th>
                    <th>QA Epics</th>

                    <th>UAT Dates</th>
                    <th>UAT Epics</th>
                </tr>
                </thead>
                <tbody>
                {{# for(initiative of release.initiatives) }}
                    <tr  class='release_box'>
                      <td><a class="status-{{initiative.status}}" href="{{initiative.url}}">{{initiative.Summary}}</a></td>

                      <td>
                        {{# for(team of this.initiativeTeams(initiative) ) }}
                          {{team}}
                        {{/ for }}
                      </td>

                      <td>
                        Start: {{this.prettyDate(initiative.dev.start)}} <br/>
                        Due: {{this.prettyDate(initiative.dev.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.dev.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul>
                        {{# for( epic of initiative.dev.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a> [{{epic.weightedEstimate}}] ({{epic.workingBusinessDays}})</li>
                        {{/ }}
                        </ul>
                      </td>


                      <td>
                        Start: {{this.prettyDate(initiative.qa.start)}} <br/>
                        Due: {{this.prettyDate(initiative.qa.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.qa.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul class='release_box'>
                        {{# for( epic of initiative.qa.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a></li>
                        {{/ }}
                        </ul>
                      </td>

                      <td>
                        Start: {{this.prettyDate(initiative.uat.start)}} <br/>
                        Due: {{this.prettyDate(initiative.uat.due)}} <br/>
                        Last Due: {{this.prettyDate(initiative.uat.dueLastPeriod)}}

                      </td>
                      <td>
                        <ul class='release_box'>
                        {{# for( epic of initiative.uat.issues ) }}
                          <li><a class="status-{{epic.status}}" href="{{epic.url}}">
                            {{epic.Summary}}
                          </a></li>
                        {{/ }}
                        </ul>
                      </td>
                    </tr>
                  {{/ for}}
                </tbody>
              </table>



              <ul>
              </ul>
            {{/ for }}
            {{/ if }}
            </div>
          </details>
        </div>
  `;
    static props = {
        showingDebugPanel: {type: Boolean, default: false},
        uploadUrl: {
            get default() {
                return localStorage.getItem("csv-url") || "";
            },
            set(newVal) {
                localStorage.setItem("csv-url", newVal);
                return newVal;
            }
        },
        timeSliderValue: {
          type: type.convert(Number),
          default: 25
        },
        progressData: type.Any,
        get compareToTime(){
          const SECOND = 1000;
          const MIN = 60 * SECOND;
          const HOUR = 60 * MIN;
          const DAY = 24 * HOUR;
          if(this.timeSliderValue === 0) {
            return {timePrior: 0, text: "now"}
          }
          if(this.timeSliderValue === 1) {
            return {timePrior: 30*SECOND, text: "30 seconds ago"}
          }
          if(this.timeSliderValue === 2) {
            return {timePrior: MIN, text: "1 minute ago"}
          }
          if(this.timeSliderValue === 3) {
            return {timePrior: 5*MIN, text: "5 minutes ago"}
          }
          if(this.timeSliderValue === 4) {
            return {timePrior: 10*MIN, text: "10 minutes ago"}
          }
          if(this.timeSliderValue === 5) {
            return {timePrior: 30*MIN, text: "30 minutes ago"}
          }
          if(this.timeSliderValue === 6) {
            return {timePrior: HOUR, text: "1 hour ago"}
          }
          if(this.timeSliderValue === 7) {
            return {timePrior: 3*HOUR, text: "3 hours ago"}
          }
          if(this.timeSliderValue === 8) {
            return {timePrior: 6*HOUR, text: "6 hours ago"}
          }
          if(this.timeSliderValue === 9) {
            return {timePrior: 12*HOUR, text: "12 hours ago"}
          }
          if(this.timeSliderValue === 10) {
            return {timePrior: DAY, text: "1 day ago"}
          } else {
            const days = this.timeSliderValue - 10;
            return {timePrior: DAY*days, text: days+" days ago"}
          }
          const days = this.timeSliderValue;
          return {timePrior: (MIN / 2) *this.timeSliderValue, text: this.timeSliderValue+" days ago"}
        },
        reportEpics: saveJSONToUrl("reportEpics", false, Boolean, booleanParsing),
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        hideInitiativesInUAT: saveJSONToUrl("hideInitiativesInUAT", false, Boolean, booleanParsing),
        hideInitiativesInIdea: saveJSONToUrl("hideInitiativesInIdea", false, Boolean, booleanParsing),
        showReleasesInTimeline: saveJSONToUrl("showReleasesInTimeline", false, Boolean, booleanParsing),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        jql: saveJSONToUrl("jql", "issueType in (Initiative, Epic) order by Rank", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryIssueType: saveJSONToUrl("jql", "Epic", String, {parse: x => ""+x, stringify: x => ""+x}),
        secondaryIssueType: {
          value({resolve, lastSet, listenTo}){
            let currentValue;
            updateValue(new URL(window.location).searchParams.get("secondaryIssueType") || "none");

            listenTo(lastSet, (value)=>{
              updateValue(value);
            });

            listenTo("secondaryReportingIssueHierarchy", ({value})=>{
              if(currentValue === "none") {
                return;
              } else {
                const currentValueSupported = value.map( issueType => issueType.type).some( type => type === currentValue);
                if(!currentValueSupported) {
                  updateValue("none")
                }
              }
            });
            function updateValue(value) {
              updateUrlParam("secondaryIssueType", value, "none");
              currentValue = value;
              resolve(value);
            }

          }
        },
        mode: {
            type: String,
        },
        getReleaseValue: {
            type: Function,
            default: function (issue) {
                return issue?.[FIX_VERSIONS_KEY]?.[0]?.name;
            }
        },
        rawIssues: {
          async(resolve) {
            if(!this.rawIssuesPromise) {
              resolve(null)
            } else {
              this.rawIssuesPromise.then(resolve);
            }
          }
        },
        get issueHierarchy(){
          return denormalizedIssueHierarchy();
        },
        get primaryReportingIssueHierarchy(){
          // we need to remove stories
          return this.issueHierarchy.slice(0, -1);

        },
        get secondaryReportingIssueHierarchy(){
          const issueTypeMap = this.issueHierarchy.typeToIssueType;
          const primaryType = issueTypeMap[this.primaryIssueType];
          if(!primaryType) {
            console.warn("no primary issuetype?!?!");
            return [];
          }
          return [ ...primaryType.denormalizedChildren];
        },

        showingConfiguration: true
    };
    // hooks
    async connected() {
      updateFullishHeightSection();
    }
    get serverInfoPromise(){
      return this.jiraHelpers.getServerInfo();
    }
    get rawIssuesPromise(){
      if (this.jql) {
        const serverInfoPromise = this.serverInfoPromise;

        const issuesPromise = this.jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields({
            jql: this.jql,
            fields: ["summary",
                "Rank",
                "Start date",
                "Due date",
                "Issue Type",
                "Fix versions",
                "Story Points",
                "Confidence",
                "Product Target Release", PARENT_LINK_KEY, LABELS_KEY, STATUS_KEY, "Sprint", "Epic Link", "Created"],
            expand: ["changelog"]
        }, (progressData)=> {
          this.progressData = {...progressData};
        });

        return Promise.all([
            issuesPromise, serverInfoPromise
        ]).then(([issues, serverInfo]) => {
            return rawIssuesToBaseIssueFormat(issues, serverInfo);

        })
     }
    }
    get teams() {
        if (!this.rawIssues) {
            return new Set();
        }
        return new Set(this.rawIssues.map(issue => issue["Project key"]));
    }
    get teamKeyToCharacters() {
        if (!this.teams) {
            return [];
        }
        const names = this.teams;
        return characterNamer(names);
    }
    get issuesMappedByParentKey() {
        if (!this.rawIssues) {
            return {};
        }
        const map = {};
        for (const issue of this.rawIssues) {
            const parentKeyValue = issue[PARENT_LINK_KEY] || issue["Epic Link"];
            if ( parentKeyValue ) {
              if (!map[parentKeyValue]) {
                  map[parentKeyValue] = []
              }
              map[parentKeyValue].push(issue);
            }
        }
        return map;
    }
    get releasesAndInitiativesWithPriorTiming(){
      if(!this.rawIssues) {
        return {releases: [], initiatives: []}
      }

      // Remove initiatives with certain statuses
      let initiativeStatusesToRemove = ["Done", "Cancelled", "Duplicate"];
      if(this.hideInitiativesInUAT) {
        initiativeStatusesToRemove = [...initiativeStatusesToRemove, ...inPartnerReviewStatuses];
      }
      if(this.hideInitiativesInIdea) {
        initiativeStatusesToRemove = [...initiativeStatusesToRemove, ...inIdeaStatuses];
      }

      const baseOptions = {
        baseIssues: this.rawIssues,
        priorTime: new Date( new Date().getTime() - this.compareToTime.timePrior),
        reportedStatuses: function(status){
          return !initiativeStatusesToRemove.includes(status);
        },
        getChildWorkBreakdown,
      }
      const optionsForType = this.reportEpics ? {
        ...baseOptions,
        reportedIssueType: "Epic",
        timingMethods: ["widestRange"]
      } : {
        ...baseOptions,
        reportedIssueType: "Initiative",
        timingMethods: ["childrenOnly","parentFirstThenChildren"]
      }
      
      const {releases, initiatives} = releasesAndInitiativesWithPriorTiming(optionsForType);

      function startBeforeDue(initiative) {
        return initiative.dateData.rollup.start < initiative.dateData.rollup.due;
      }

      if(this.hideUnknownInitiatives) {
        return {
          initiatives: initiatives.filter( startBeforeDue),
          releases: releases.map( release => {
            return {
              ...release,
              initiatives: release.dateData.rollup.issues.filter(startBeforeDue)
            }
          })
        };
      } else {
        return {releases, initiatives};
      }
    }
    get initiativesWithAStartAndEndDate(){
      var initiatives =  this.releasesAndInitiativesWithPriorTiming.initiatives;

      if(this.sortByDueDate) {
        initiatives = initiatives.sort( (i1, i2) => i1.dateData.rollup.due - i2.dateData.rollup.due);
      }

      if(this.hideInitiativesInIdea) {
        initiatives = initiatives.filter( (initiative) => {
          return !inIdeaStatus[initiative.Status]
        });
      }

      return initiatives;
    }
    get sortedIncompleteReleasesInitiativesAndEpics() {
        const unsortedReleases = this.releasesAndInitiativesWithPriorTiming.releases;
        if(this.showOnlySemverReleases) {
          return semverReleases(unsortedReleases);
        } else {
          return sortedByLastEpicReleases(unsortedReleases);
        }
    }
    get releases() {
        if (!this.rawIssues) {
            return undefined;
        }
        const data = this.sortedIncompleteReleasesInitiativesAndEpics;
        return data;
    }
    get releasesAndNext() {
        if (this.releases) {
            let releasesAndNext = [
                ...this.releases/*,
        {
          release: "Next",
          initiatives: sortReadyFirst(filterPlanningAndReady(
            filterOutReleases(
              filterInitiatives(this.rawIssues),
              this.getReleaseValue
            )))
        }*/];
            return releasesAndNext;
        }
    }

    prettyDate(date) {
        return date ? dateFormatter.format(date) : "";
    }

    initiativeTeams(initiative) {
        return [...new Set(initiative.team.issues.map(issue => issue["Project key"]))];
    }
    showDebug(open) {
      this.showingDebugPanel = open;
    }

    /*teamWork(work) {
        const teamToWork = {};
        issues.forEach( issue => {
            let teamKey = issue["Project key"]
            if(!teamToWork[teamKey]) {
                teamToWork[teamKey] = 0
            }
            //teamToWork[teamKey] +=
        }) )
        const teams = [...new Set( work.issues.map( issue => issue["Project key"]) ) ];

    }*/
    toggleConfiguration() {
      this.showingConfiguration = ! this.showingConfiguration;
      const width = document.getElementById("configuration").clientWidth;
      document.querySelector(".left-config-width").style.left = (width+16)+"px";
    }
}



customElements.define("timeline-report", TimelineReport);



function filterByIssueType(issues, issueType) {
    return issues.filter(issue => issue[ISSUE_TYPE_KEY] === issueType)
}



function goodStuffFromIssue(issue) {
    return {
        Summary: issue.Summary,
        [ISSUE_KEY]: issue[ISSUE_KEY],
    }
}

function filterReleases(issues, getReleaseValue) {
    return issues.filter(issue => getReleaseValue(issue))
}

function filterOutReleases(issues, getReleaseValue) {
    return issues.filter(issue => !getReleaseValue(issue));
}
function filterPlanningAndReady(issues) {
    return issues.filter(issue => ["Ready", "Planning"].includes(issue.Status))
}


function mapReleasesToIssues(issues, getReleaseValue) {
    const map = {};
    issues.forEach((issue) => {
        const release = getReleaseValue(issue)
        if (!map[release]) {
            map[release] = [];
        }
        map[release].push(issue);
    })
    return map;
}




function makeIssueMap(issues) {
    if (typeof issues === "object" && !Array.isArray(issues)) {
        return issues;
    }
    const map = {};
    issues.forEach(i => {
        map[i[ISSUE_KEY]] = i;
    })
    return map;
}

function getChildrenOf(issue, issuesOrIssueMap) {
    const children = [];
    const issueMap = makeIssueMap(issuesOrIssueMap);

    for (let issueKey in issueMap) {
        let possibleChild = issueMap[issueKey];
        if (possibleChild[PARENT_LINK_KEY] === issue[ISSUE_KEY]) {
            children.push(possibleChild);
        }
    }
    return children;
}


function getChildWorkBreakdown(children = []) {
    const qaWork = new Set(filterQAWork(children));
    const uatWork = new Set(filterPartnerReviewWork(children));
    const devWork = children.filter(epic => !qaWork.has(epic) && !uatWork.has(epic));
    return {qaWork, uatWork, devWork}
}


function sortReadyFirst(initiatives) {
    return initiatives.sort((a, b) => {
        if (a.Status === "Ready") {
            return -1;
        }
        return 1;
    })
}



function newDateFromYYYYMMDD(dateString) {
    const [year, month, day] = dateString.split("-");
    return new Date(year, month - 1, day);
}





function addTeamBreakdown(release) {

    return {
        ...release
    }
}



// ontrack
// behind
// complete


function getElementPosition(el) {
  var rect = el.getBoundingClientRect();
  var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return { x: rect.left + scrollLeft, y: rect.top + scrollTop };
}

function updateFullishHeightSection() {
  const position = getElementPosition( document.querySelector('.fullish-vh') )
  document.documentElement.style.setProperty('--fullish-document-top', `${position.y}px`);
}

window.addEventListener('load', updateFullishHeightSection);
window.addEventListener('resize', updateFullishHeightSection);




function denormalizedIssueHierarchy(){
  const base = [
    { type: "Release",    plural: "Releases", children: ["Initiative","Epic","Story"],  },
    { type: "Initiative", plural: "Initiatives", children: ["Epic","Story"] },
    { type: "Epic", plural: "Epics", children: ["Story"]},
    { type: "Story", plural: "Stories", children: [] }
  ];
  const typeToIssueType = {};
  for(const issueType of base) {
    typeToIssueType[issueType.type] = issueType;
  }


  for(const issueType of base) {
    issueType.denormalizedChildren = issueType.children.map( typeName => typeToIssueType[typeName]);
  }
  base.typeToIssueType = typeToIssueType
  return base;
}