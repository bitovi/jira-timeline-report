import { StacheElement, type } from "./can.js";

import { derivedToCSVFormat } from "./jira/derived/work-timing/work-timing.js";

import bitoviTrainingData from "./examples/bitovi-training.js";


//import "./steerco-timeline.js";
import "./status-filter.js";
import "./status-filter-only.js";
import "./gantt-grid.js";
import "./gantt-timeline.js";
import "./status-report.js";
import "./timeline-configuration/timeline-configuration.js"

import { rollupAndRollback } from "./jira/rolledup-and-rolledback/rollup-and-rollback.js";
import { calculateReportStatuses } from "./jira/rolledup/work-status.js/work-status.js";
import { groupIssuesByHierarchyLevelOrType } from "./jira/rollup/rollup.js";

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
          isLoggedIn:from="this.loginComponent.isLoggedIn"
          jiraHelpers:from="this.jiraHelpers"
          teamConfigurationPromise:from="this.velocitiesConfiguration.teamConfigurationPromise"

          jql:to="this.jql"
          derivedIssuesRequestData:to="this.derivedIssuesRequestData"

          showOnlySemverReleases:to="this.showOnlySemverReleases"
          statusesToRemove:to="this.statusesToRemove"
          statusesToShow:to="this.statusesToShow"

          secondaryReportType:to="this.secondaryReportType"
          timingCalculationMethods:to="this.timingCalculationMethods"
          primaryReportType:to="this.primaryReportType"
          secondaryReportType:to="this.secondaryReportType"

          primaryIssueType:to="this.primaryIssueType"
          secondaryIssueType:to="this.secondaryIssueType"
          hideUnknownInitiatives:to="this.hideUnknownInitiatives"
          sortByDueDate:to="this.sortByDueDate"
          showPercentComplete:to="this.showPercentComplete"
          rollupTimingLevelsAndCalculations:to="this.rollupTimingLevelsAndCalculations"
          configuration:to="this.configuration"
          planningStatuses:to="this.planningStatuses"
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

          {{# and(this.derivedIssuesRequestData.issuesPromise.isResolved, this.primaryIssuesOrReleases.length) }}
            <div class="my-2  border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">
            
              {{# or( eq(this.primaryReportType, "start-due"), eq(this.primaryReportType, "breakdown") ) }}
                <gantt-grid 
                    primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
                    breakdown:from="eq(this.primaryReportType, 'breakdown')"
                    showPercentComplete:from="this.showPercentComplete"
                    ></gantt-grid>
              {{ else }}
                <gantt-timeline 
                  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"></gantt-timeline>
              {{/ or }}

              {{# or( eq(this.secondaryReportType, "status"), eq(this.secondaryReportType, "breakdown") ) }}
                <status-report 
                  breakdown:from="eq(this.secondaryReportType, 'breakdown')"
                  planningIssues:from="this.planningIssues"
                  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                  allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></status-report>
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
          {{# and(this.derivedIssuesRequestData.issuesPromise.isResolved, not(this.primaryIssuesOrReleases.length) ) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked drop-shadow-md">
              <p>No issues of type {{this.primaryIssueType}}</p>
              <p>Please check your JQL is correct!</p>
            </div>
          {{/}}
          {{# if(this.cvsIssuesPromise.isPending) }}
            <div class="my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md">
              <p>Loading ...<p>
              {{# if(this.derivedIssuesRequestData.progressData.issuesRequested)}}
                <p>Loaded {{this.derivedIssuesRequestData.progressData.issuesReceived}} of {{this.derivedIssuesRequestData.progressData.issuesRequested}} issues.</p>
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
        // passed values
        timingCalculationMethods: type.Any,

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
        get cvsIssuesPromise(){
            if(this.loginComponent.isLoggedIn === false) {
              return bitoviTrainingData(new Date());
            } else {
              if( this.derivedIssuesRequestData?.issuesPromise ) {
                  return this.derivedIssuesRequestData.issuesPromise.then((issues)=>{
                      return issues.map(derivedToCSVFormat);
                  })
              }
            }
        },
        csvIssues: {
            async() {
                return this.cvsIssuesPromise;
            }
        },
        get issuesPromise(){
          return this.derivedIssuesRequestData?.issuesPromise;
        },
        derivedIssues: {
            async(resolve){
                this.derivedIssuesRequestData?.issuesPromise.then(resolve)
            }
        }
    };

    

    // hooks
    async connected() {
      updateFullishHeightSection();
    }

    // this all the data pre-compiled
    get rolledupAndRolledBackIssuesAndReleases(){
      if(!this.derivedIssues || !this.rollupTimingLevelsAndCalculations || !this.configuration) {
        return [];
      }
      
      const rolledUp = rollupAndRollback(this.derivedIssues, this.configuration, this.rollupTimingLevelsAndCalculations,
        new Date( new Date().getTime() - this.compareToTime.timePrior) );

      

      const statuses = calculateReportStatuses(rolledUp);
      return statuses;
    }
    
    /*
    get releasesAndInitiativesWithPriorTiming(){
      console.log("YES I AM CALLED")
      if(!this.csvIssues || ! this.timingCalculationMethods) {
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
        baseIssues: this.csvIssues,
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
        if (!this.csvIssues) {
            return undefined;
        }
        const data = this.sortedIncompleteReleasesInitiativesAndEpics;
        return data;
    }*/
    get groupedParentDownHierarchy(){
      if(!this.rolledupAndRolledBackIssuesAndReleases || !this.rollupTimingLevelsAndCalculations) {
        return [];
      }
      const groupedHierarchy = groupIssuesByHierarchyLevelOrType(this.rolledupAndRolledBackIssuesAndReleases, this.rollupTimingLevelsAndCalculations)
      return groupedHierarchy.reverse();
    }
    get planningIssues(){
      if(!this.groupedParentDownHierarchy.length || ! this?.planningStatuses?.length) {
        return []
      }
      const planningSourceIssues = this.primaryIssueType === "Release" ? this.groupedParentDownHierarchy[1] : this.groupedParentDownHierarchy[0];
      return planningSourceIssues.filter( (normalizedIssue)=> {
        return this.planningStatuses.includes(normalizedIssue.status);
      })
    }
    get primaryIssuesOrReleases(){
      if(!this.groupedParentDownHierarchy.length) {
        return [];
      }
      const unfilteredPrimaryIssuesOrReleases = this.groupedParentDownHierarchy[0];
      
      const hideUnknownInitiatives = this.hideUnknownInitiatives;
      let statusesToRemove = this.statusesToRemove;
      let statusesToShow =  this.statusesToShow;

      function startBeforeDue(initiative) {
        return initiative.rollupStatuses.rollup.start < initiative.rollupStatuses.rollup.due;
      }

      // lets remove stuff!
      const filtered = unfilteredPrimaryIssuesOrReleases.filter( (issueOrRelease)=> {
        // check if it's a planning issues
        if(this?.planningStatuses?.length && 
            this.primaryIssueType !== "Release" &&
            this.planningStatuses.includes(issueOrRelease.status) ) {
          return false;
        }
        if(this.showOnlySemverReleases && this.primaryIssueType === "Release" && !issueOrRelease.names.semver) {
          return false;
        }

        if(hideUnknownInitiatives && !startBeforeDue(issueOrRelease)) {
          return false;
        }
        if(this.primaryIssueType === "Release") {
          // releases don't have statuses, so we look at their children
          if(statusesToRemove && statusesToRemove.length) {
            if( issueOrRelease.childStatuses.children.every( ({status}) => statusesToRemove.includes(status) ) ) {
              return false;
            }
          }

          if(statusesToShow && statusesToShow.length) {
            // Keep if any valeue has a status to show
            if( !issueOrRelease.childStatuses.children.some( ({status}) => statusesToShow.includes(status) ) ) {
              return false;
            }
          }

        } else {
          if(statusesToShow && statusesToShow.length) {
            if(!statusesToShow.includes(issueOrRelease.status)) {
              return false;
            }
          }
          if(statusesToRemove && statusesToRemove.length) {
            if(statusesToRemove.includes(issueOrRelease.status)) {
              return false;
            }
          }
        }

        
        return true;
      });

      if(this.sortByDueDate) {
        return filtered.toSorted( (i1, i2) => i1.rollupStatuses.rollup.due - i2.rollupStatuses.rollup.due);
      } else {
        return filtered;
      }
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




