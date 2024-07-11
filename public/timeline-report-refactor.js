import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import { calculationKeysToNames, denormalizedIssueHierarchy, getImpliedTimingCalculations } from "./prepare-issues/date-data.js";
import { percentComplete } from "./percent-complete/percent-complete.js"
import { issues as rollbackIssues } from "./rollback/rollback-jira-issues.js";
import { normalizeAndDeriveIssues } from "./shared/issue-data/issue-data.js";



import { howMuchHasDueDateMovedForwardChangedSince,
    DAY_IN_MS, parseDateISOString, epicTimingData } from "./date-helpers.js";



import {
    addStatusToInitiative,
    addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses,
    inIdeaStatus,
    inIdeaStatuses
} from "./status-helpers.js";

import {releasesAndInitiativesWithPriorTiming, 
  rawIssuesToBaseIssueFormat, filterOutInitiativeStatuses, filterQAWork, filterPartnerReviewWork} from "./prepare-issues/prepare-issues.js";

import semverReleases from "./semver-releases.js";
import sortedByLastEpicReleases from "./sorted-by-last-epic-releases.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: "short" });


import bitoviTrainingData from "./examples/bitovi-training.js";

import { estimateExtraPoints } from "./confidence.js";
import {saveJSONToUrl,updateUrlParam} from "./shared/state-storage.js";

//import "./steerco-timeline.js";
import "./status-filter.js";
import "./status-filter-only.js";
import "./gantt-grid.js";
import "./gantt-timeline.js";
import "./status-report.js";
import "./timeline-configuration/timeline-configuration.js"


const ISSUE_KEY = "Issue key";
const PRODUCT_TARGET_RELEASE_KEY = "Product Target Release";
const ISSUE_TYPE_KEY = "Issue Type";
const PARENT_LINK_KEY = "Parent Link";
const START_DATE_KEY = "Start date";
const DUE_DATE_KEY = "Due date";
const LABELS_KEY = "Labels";
const STATUS_KEY = "Status";
const FIX_VERSIONS_KEY = "Fix versions";



const UNCERTAINTY_WEIGHT_DEFAULT = 80;
const PARENT_ISSUE_DURATION_DAYS_DEFAULT = 6 * 7;

export class TimelineReport extends StacheElement {
    static view = `
      <div 
          class="drop-shadow-lg
          fixed left-0 z-50 overflow-auto
          top-fullish-vh height-fullish-vh 
          bg-white flex max-w-4xl" id="configuration">
        
        <timeline-configuration
          class="border-gray-100 p-4 relative {{# not(this.showingConfiguration) }}hidden{{/}} block" 
          style="border-top-width: 32px;overflow-y: auto"
          loginComponent:from="this.loginComponent"
          cvsIssuesPromise:from="this.cvsIssuesPromise"
          progressData:to="this.progressData"
          loadChildren:to="this.loadChildren"
          showOnlySemverReleases:to="this.showOnlySemverReleases"
          statusesToRemove:to="this.statusesToRemove"
          statusesToShow:to="this.statusesToShow"

          secondaryReportType:to="this.secondaryReportType"
          jql:to="this.jql"
          timingCalculationMethods:to="this.timingCalculationMethods"
          primaryReportType:to="this.primaryReportType"
          secondaryReportType:to="this.secondaryReportType"
          ></timeline-configuration>

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

        {{# not(this.loginComponent.isLoggedIn) }}

          <div class="p-4 mb-4 drop-shadow-md hide-on-fullscreen bg-yellow-300">
            <p>The following is a sample report. Learn more about it in the 
              "<a class="text-blue-400" href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira/reporting.html">Agile Program Management with Jira</a>" 
              training. Click "Connect to Jira" to load your own data.</p>
            <p class="mt-2">Checkout the following sample reports:</p>
            <ul class="list-disc list-inside ml-2">
              <li><a class="text-blue-400" href="?primaryIssueType=Release&hideUnknownInitiatives=true&primaryReportType=due&secondaryReportType=status">Release end dates with initiative status</a></li>
              <li><a class="text-blue-400" href="?primaryIssueType=Release&hideUnknownInitiatives=true&secondaryReportType=breakdown">Release timeline with iniative work breakdown</a></li>
              <li><a class="text-blue-400" href="?primaryIssueType=Initiative&hideUnknownInitiatives=true&statusesToShow=Development%2CReady&primaryReportType=breakdown">Ready and in-development initiative work breakdown</a></li>
            </ul>

          </div>
      {{/ not }}

          <div class='p-4 rounded-lg-gray-100-on-white mb-4 drop-shadow-md color-bg-white'>
            <p><label class="inline font-bold">Compare to {{this.compareToTime.text}}</label>
            - Specify what timepoint to use to determine if an initiative or release has fallen behind.</p>
            <input class="w-full-border-box" type='range' valueAsNumber:bind:on:input='this.timeSliderValue' min="0" max="100"/>
          </div>

          


          {{# and( not(this.jql), this.loginComponent.isLoggedIn  }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">Configure a JQL in the sidebar on the left to get started.</div>
          {{ /and }}

					{{# and(this.cvsIssuesPromise.value, this.releases) }}
            <div class="my-2  border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">
            
              {{# or( eq(this.primaryReportType, "start-due"), eq(this.primaryReportType, "breakdown") ) }}
                <gantt-grid issues:from="this.primaryIssues" breakdown:from="eq(this.primaryReportType, 'breakdown')"></gantt-grid>
              {{ else }}
                <gantt-timeline issues:from="this.primaryIssues"></gantt-timeline>
              {{/ or }}

              {{# or( eq(this.secondaryReportType, "status"), eq(this.secondaryReportType, "breakdown") ) }}
                <status-report primaryIssues:from="this.primaryIssues"
                  breakdown:from="eq(this.secondaryReportType, 'breakdown')"
                  planningIssues:from="this.planningIssues"></status-report>
              {{/ }}

              <div class='p-2'>
                <span class='color-text-and-bg-unknown p-2 inline-block'>Unknown</span>
                <span class='color-text-and-bg-new p-2 inline-block'>New</span>
                <span class='color-text-and-bg-notstarted p-2 inline-block'>Not Started</span>
                <span class='color-text-and-bg-ontrack p-2 inline-block'>On Track</span>
                <span class='color-text-and-bg-ahead p-2 inline-block'>Ahead</span>
                <span class='color-text-and-bg-behind p-2 inline-block'>Behind</span>
                <span class='color-text-and-bg-blocked p-2 inline-block'>Blocked</span>
                <span class='color-text-and-bg-complete p-2 inline-block'>Complete</span>
              </div>
            </div>
          {{/ and }}
          {{# if(this.cvsIssuesPromise.isPending) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">
              <p>Loading ...<p>
              {{# if(this.progressData.issuesRequested)}}
                <p>Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues.</p>
              {{/ }}
            </div>
          {{/ if }}
          {{# if(this.cvsIssuesPromise.isRejected) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked drop-shadow-md">
              <p>There was an error loading from Jira!</p>
              <p>Error message: {{this.cvsIssuesPromise.reason.errorMessages[0]}}</p>
              <p>Please check your JQL is correct!</p>
            </div>
          {{/ if }}
        </div>
  `;
    static props = {
        showingDebugPanel: {type: Boolean, default: false},
        timeSliderValue: {
          type: type.convert(Number),
          default: 25
        },
        // default params
        defaultSearch: type.Any,
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
        
        // REMOVE
        // breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        // remove
        // showReleasesInTimeline: saveJSONToUrl("showReleasesInTimeline", false, Boolean, booleanParsing),

        
        
        /*
        getReleaseValue: {
            type: Function,
            default: function (issue) {
                return issue?.[FIX_VERSIONS_KEY]?.[0]?.name;
            }
        },
        */

        showingConfiguration: false,


        // [{type: "Epic", calculation: "calculationName"},{type, calculation}]
        
        

        // [ {type: "Initiative", types: [{type: "Epic", selected}, ...], calculations: [{calculation: "parentOnly", name, selected}]} ]
        
    };

    

    // hooks
    async connected() {
      updateFullishHeightSection();
    }

    get cvsIssuesPromise(){
      if(this.loginComponent.isLoggedIn === false) {
        return bitoviTrainingData(new Date());
      }
      
      if (this.jql) {
        
        const serverInfoPromise = this.serverInfoPromise;
        const issuesPromise = this.rawIssuesPromise;

        return Promise.all([
            issuesPromise, serverInfoPromise
        ]).then(([issues, serverInfo]) => {
            
          
            

          const formatted = rawIssuesToBaseIssueFormat(issues, serverInfo);
          return formatted;
        })
     }
    }
    get releasesAndInitiativesWithPriorTiming(){
      if(!this.rawIssues) {
        return {releases: [], initiatives: []}
      }

      // Remove initiatives with certain statuses
      let initiativeStatusesToRemove = this.statusesToRemove;
      let initiativeStatusesToShow =  this.statusesToShow;

      const reportedIssueType = this.primaryIssueType === "Release" ? this.secondaryIssueType : this.primaryIssueType;
      const timingMethods = this.timingCalculationMethods;


      if(this.primaryIssueType === "Release") {
        timingMethods.shift();
      }

      const optionsForType = {
        baseIssues: this.rawIssues,
        priorTime: new Date( new Date().getTime() - this.compareToTime.timePrior),
        reportedStatuses: function(status){
          if(initiativeStatusesToShow && initiativeStatusesToShow.length) {
            if(!initiativeStatusesToShow.includes(status)) {
              return false;
            }
          }
          return !initiativeStatusesToRemove.includes(status);
        },
        getChildWorkBreakdown,
        reportedIssueType,
        timingMethods
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
        initiatives = initiatives.toSorted( (i1, i2) => i1.dateData.rollup.due - i2.dateData.rollup.due);
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
    get primaryIssues(){
      if(this.primaryIssueType === "Release") {
        return this.releases;
      } else {
        return this.initiativesWithAStartAndEndDate;
      }
    }
    get planningIssues(){
      if(!this.rawIssues) {
        return []
      }
      const reportedIssueType = this.primaryIssueType === "Release" ? this.secondaryIssueType : this.primaryIssueType;
      return getIssuesOfTypeAndStatus(this.rawIssues, reportedIssueType, this.planningStatuses || []);
    }

    showDebug(open) {
      this.showingDebugPanel = open;
    }

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

function getIssuesOfTypeAndStatus(issues, type, statuses){
  return issues.filter( (issue)=>{
    return issue["Issue Type"] === type && statuses.includes(issue.Status)
  })
}

/*
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
}*/




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




