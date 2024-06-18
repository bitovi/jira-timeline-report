import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import { calculationKeysToNames } from "./prepare-issues/date-data.js";
import { percentComplete } from "./percent-complete/percent-complete.js"
import {
  getConfidence,
  getDaysPerSprint,
  getDueDate,
  getEstimate,
  getIssueKey,
  getParentKey,
  getStartDate,
  getTeamKeyDefault,
  getType,
  getVelocity
 } from "./shared/issue-data/issue-data.js"




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
const booleanParsing = {
  parse: x => {
    return ({"": true, "true": true, "false": false})[x];
  },
  stringify: x => ""+x
};

import bitoviTrainingData from "./examples/bitovi-training.js";

import { estimateExtraPoints } from "./confidence.js";
import {saveJSONToUrl,updateUrlParam} from "./shared/state-storage.js";

//import "./steerco-timeline.js";
import "./status-filter.js";
import "./status-filter-only.js";
import "./gantt-grid.js";
import "./gantt-timeline.js";
import "./status-report.js";


const ISSUE_KEY = "Issue key";
const PRODUCT_TARGET_RELEASE_KEY = "Product Target Release";
const ISSUE_TYPE_KEY = "Issue Type";
const PARENT_LINK_KEY = "Parent Link";
const START_DATE_KEY = "Start date";
const DUE_DATE_KEY = "Due date";
const LABELS_KEY = "Labels";
const STATUS_KEY = "Status";
const FIX_VERSIONS_KEY = "Fix versions";

const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"

const configurationView = `
<div class="border-gray-100 p-4 relative {{# not(this.showingConfiguration) }}hidden{{/}}" style="border-top-width: 32px;overflow-y: auto">
  <p>
    Questions on the options? 
    <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started">Read the guide</a>, or 
    <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions">connect with us</a>.
  </p>  
  <h3 class="h3">Issue Source</h3>
  <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
  <p>
    {{# if(this.loginComponent.isLoggedIn) }}
      <input class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'/>
    {{ else }}
      <input class="w-full-border-box mt-2 form-border p-1 text-yellow-300" value="Sample data. Connect to Jira to specify." disabled/>
    {{/ if}}
  </p>
  {{# if(this.rawIssuesPromise.isPending) }}
    {{# if(this.progressData.issuesRequested)}}
      <p class="text-xs text-right">Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues</p>
    {{ else }}
      <p class="text-xs text-right">Loading issues ...</p>
    {{/ if}}
  {{/ if }}
  {{# if(this.rawIssuesPromise.isRejected) }}
    <div class="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
      <p>There was an error loading from Jira!</p>
      <p>Error message: {{this.rawIssuesPromise.reason.errorMessages[0]}}</p>
      <p>Please check your JQL is correct!</p>
    </div>
  {{/ if }}
  <div class="flex justify-between mt-1">

    <p class="text-xs"><input type='checkbox' 
      class='self-start align-middle' checked:bind='this.loadChildren'/> <span class="align-middle">Load all children of JQL specified issues</span>
    </p>
    
    {{# if(this.rawIssuesPromise.isResolved) }}
      <p class="text-xs">Loaded {{this.rawIssues.length}} issues</p>
    {{/ if }}
  </div>
  

  <h3 class="h3 mt-4">Primary Timeline</h3>
  <div class="flex mt-2 gap-2 flex-wrap">
    <p>What Jira artifact do you want to report on?</p>
    <div class="shrink-0">
    {{# for(issueType of this.primaryReportingIssueHierarchy) }}
      <label class="px-2"><input 
        type="radio" 
        name="primaryIssueType" 
        checked:from="eq(this.primaryIssueType, issueType.type)"
        on:change="this.primaryIssueType = issueType.type"/> {{issueType.plural}} </label>
    {{/ }}
    </div>
  </div>

  <div class="flex mt-2 gap-2 flex-wrap">
    <p>What timing data do you want to report?</p>
    <div class="shrink-0">
      <label class="px-2"><input 
        type="radio" 
        name="primaryReportType"
        checked:from="eq(this.primaryReportType, 'start-due')"
        on:change="this.primaryReportType = 'start-due'"
        /> Start and due dates </label>
      <label class="px-2"><input 
        type="radio" 
        name="primaryReportType"
        checked:from="eq(this.primaryReportType, 'due')"
        on:change="this.primaryReportType = 'due'"
        /> Due dates only</label>
      <label class="px-2"><input 
        type="radio" 
        name="primaryReportType"
        checked:from="eq(this.primaryReportType, 'breakdown')"
        on:change="this.primaryReportType = 'breakdown'"
        /> Work breakdown</label>
    </div>
  </div>


  <h3 class="h3">Timing Calculation</h3>
  <div class="grid gap-2 my-2" style="grid-template-columns: auto auto auto;">
    <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">Parent Type</div>
    <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Child Type</div>
    <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 3 / span 1; grid-row: 1 / span 1;">How is timing calculated between parent and child?</div>
    <div class="border-b-2 border-neutral-40" style="grid-column: 1 / span 3; grid-row: 1 / span 1;"></div>

    {{# for(timingLevel of this.timingLevels) }}

        <label class="pr-2 py-2 {{ this.paddingClass(scope.index) }}">{{timingLevel.type}}</label>
        {{# eq(timingLevel.types.length, 1) }}
          <span class="p-2">{{timingLevel.types[0].type}}</span>
        {{ else }}
          <select class="${selectStyle}" on:change="this.updateCalculationType(scope.index, scope.element.value)">
            {{# for(type of timingLevel.types) }}
              <option {{# if(type.selected) }}selected{{/ if }}>{{type.type}}</option>
            {{/ for }}
          </select>
        {{/ eq}}

        <select class="${selectStyle}" on:change="this.updateCalculation(scope.index, scope.element.value)">
          {{# for(calculation of timingLevel.calculations) }}
            <option {{# if(calculation.selected) }}selected{{/ if }} value="{{calculation.calculation}}">{{calculation.name}}</option>
          {{/ for }}
        </select>

    {{/ for }}
    
  </div>

  <h3 class="h3">Filters</h3>

  <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">

    <label class=''>Hide Unknown {{this.primaryIssueType}}s</label>
    <input type='checkbox' 
      class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>
    <p class="m-0">Hide {{this.primaryIssueType}}s whose timing can't be determined.
    </p>

    <label>{{this.firstIssueTypeWithStatuses}} Statuses to Report</label>
    <status-filter 
      statuses:from="this.statuses"
      param:raw="statusesToShow"
      selectedStatuses:to="this.statusesToShow"
      style="max-width: 400px;"></status-filter>
    <p>Only include these statuses in the report</p>

    <label>{{this.firstIssueTypeWithStatuses}} Statuses to Ignore</label>
    <status-filter 
      statuses:from="this.statuses" 
      param:raw="statusesToRemove"
      selectedStatuses:to="this.statusesToRemove"
      style="max-width: 400px;"></status-filter>
    <p>Search for statuses to remove from the report</p>

    {{# eq(this.primaryIssueType, "Release") }}
      <label class=''>Show Only Semver Releases</label>
      <input type='checkbox' 
        class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>
      <p class="m-0">This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:
      <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
      </p>
    {{/ }}


  </div>

  <h3 class="h3">Sorting</h3>
  <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">
    <label class=''>Sort by Due Date</label>
      <input type='checkbox' 
        class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>
      <p class="m-0">Instead of ordering initiatives based on the order defined in the JQL, 
      sort initiatives by their last epic's due date.
      </p>
  </div>

  <h3 class="h3">Secondary Status Report</h3>
  <div class="flex mt-2 gap-2 flex-wrap">
    <p>Secondary Report Type</p>
    <div class="shrink-0">
      <label class="px-2"><input 
        type="radio" 
        name="secondary" 
        checked:from="eq(this.secondaryReportType, 'none')"
        on:change="this.secondaryReportType = 'none'"
        /> None </label>
        
      <label class="px-2"><input 
        type="radio" 
        name="secondary" 
        checked:from="eq(this.secondaryReportType, 'status')"
        on:change="this.secondaryReportType = 'status'"
        /> {{this.secondaryIssueType}} status </label>
    
      {{# not(eq(this.secondaryIssueType, "Story") ) }}
      <label class="px-2"><input 
        type="radio" 
        name="secondary" 
        checked:from="eq(this.secondaryReportType, 'breakdown')"
        on:change="this.secondaryReportType = 'breakdown'"
        /> {{this.secondaryIssueType}} work breakdown </label>
      {{/ not }}
    </div>
  </div>
  <div class="flex gap-2 mt-1">
    <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>
    <status-filter 
      statuses:from="this.statuses" 
      param:raw="planningStatuses"
      selectedStatuses:to="this.planningStatuses"
      style="max-width: 400px;"></status-filter>
  </div>

  
</div>`;

const UNCERTAINTY_WEIGHT_DEFAULT = 80;


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

					{{# and(this.rawIssuesPromise.value, this.releases) }}
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
        timeSliderValue: {
          type: type.convert(Number),
          default: 25
        },
        progressData: type.Any,
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
        reportEpics: saveJSONToUrl("reportEpics", false, Boolean, booleanParsing),
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        // REMOVE
        breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        // remove
        showReleasesInTimeline: saveJSONToUrl("showReleasesInTimeline", false, Boolean, booleanParsing),

        loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryIssueType: saveJSONToUrl("primaryIssueType", "Epic", String, {parse: x => ""+x, stringify: x => ""+x}),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, {parse: x => ""+x, stringify: x => ""+x}),
        statusesToRemove: {
          get default(){
            return [];
          }
        },
        statusesToShow: {
          get default(){
            return [];
          }
        },
        planningStatuses: {
          get default(){
            return [];
          }
        },
        get secondaryIssueType(){
          return getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations)[0].type
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

        showingConfiguration: false,


        // [{type: "Epic", calculation: "calculationName"},{type, calculation}]
        timingCalculations: {
          value({resolve, lastSet, listenTo}) {
            let currentValue;
            updateValue(new URL(window.location).searchParams.get("timingCalculations"));

            listenTo(lastSet, (value)=>{
                updateValue(value);
            });
            listenTo("primaryIssueType",()=>{
              updateValue([]);
            });

            function updateValue(value) {
              if(typeof value === "string"){
                try {
                  value = parse(value);
                } catch(e) {
                  value = [];
                }
              } else if(!value){
                value = [];
              }
                
              updateUrlParam("timingCalculations", stringify(value), stringify([]));

              currentValue = value;
              resolve(currentValue);
            }

            function parse(value){
              return value.split(",").map( piece => {
                const parts = piece.split(":");
                return {type: parts[0], calculation: parts[1]};
              }).flat()
            }
            function stringify(array){
              return array.map( (obj) => obj.type+":"+obj.calculation).join(",")
            }

          }
        },
        get firstIssueTypeWithStatuses(){
          if(this.primaryIssueType !== "Release") {
            return this.primaryIssueType;
          }
          const calculations= getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations);
          if(calculations[0].type !== "Release") {
            return calculations[0].type;
          } else {
            return calculations[1].type;
          }
        },

        // [ {type: "Initiative", types: [{type: "Epic", selected}, ...], calculations: [{calculation: "parentOnly", name, selected}]} ]
        get timingLevels(){
          const issueTypeMap = this.issueHierarchy.typeToIssueType;
          const primaryType = issueTypeMap[this.primaryIssueType];
          let currentType = this.primaryIssueType;
          
          let childrenCalculations = primaryType.timingCalculations;
          const timingLevels = [];
          const setCalculations = [...this.timingCalculations];
          
          
          while(childrenCalculations.length) {
            // this is the calculation that should be selected for that level
            let setLevelCalculation = setCalculations.shift() || 
              {
                type: childrenCalculations[0].child, 
                calculation: childrenCalculations[0].calculations[0].calculation
              };
            let selected = childrenCalculations.find( calculation => setLevelCalculation.type === calculation.child);

            let timingLevel = {
              type: currentType,
              types: childrenCalculations.map( calculationsForType => {
                return {
                  type: calculationsForType.child,
                  selected: setLevelCalculation?.type === calculationsForType.child
                }
              } ),
              calculations: selected.calculations.map( (calculation)=> {
                return {
                  ...calculation,
                  selected: calculation.calculation === setLevelCalculation.calculation
                }
              })
            }
            timingLevels.push(timingLevel);
            currentType = setLevelCalculation.type;
            childrenCalculations = issueTypeMap[setLevelCalculation.type].timingCalculations;
          }
          return timingLevels;
        }
    };

    updateCalculationType(index, value){
    
      const copyCalculations = [
        ...getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations) 
      ].slice(0,index+1);

      copyCalculations[index].type = value;
      this.timingCalculations = copyCalculations;
    }

    updateCalculation(index, value){
    
      const copyCalculations = [
        ...getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations) 
      ].slice(0,index+1);

      copyCalculations[index].calculation = value;
      this.timingCalculations = copyCalculations;
    }

    // hooks
    async connected() {
      updateFullishHeightSection();
    }
    get serverInfoPromise(){
      return this.jiraHelpers.getServerInfo();
    }
    get rawIssuesPromise(){
      if(this.loginComponent.isLoggedIn === false) {
        return bitoviTrainingData(new Date());
      }
      
      if (this.jql) {
        this.progressData = null;

        const serverInfoPromise = this.serverInfoPromise;

        const loadIssues = this.loadChildren ? 
          this.jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers) :
          this.jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers);
        
        const issuesPromise = loadIssues({
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
            const formatted = rawIssuesToBaseIssueFormat(issues, serverInfo);
            percentComplete(issues, {
              getType,
              getTeamKey: getTeamKeyDefault,
              getDaysPerSprint,
              getIssueKey,
              getParentKey,
              getVelocity,
              getEstimate,
              getConfidence,
              getStartDate,
              getDueDate,
              //getParallelWorkLimit: (TEAM_KEY) => 1
              includeTypes: ["Epic"],
              uncertaintyWeight: UNCERTAINTY_WEIGHT_DEFAULT,
            });
            return formatted;
        })
     }
    }
    get teams() {
        if (!this.rawIssues) {
            return new Set();
        }
        return new Set(this.rawIssues.map(issue => issue["Project key"]));
    }
    get statuses(){
      if(!this.rawIssues) {
        return []
      }
      const statuses = new Set();
      for( let issue of this.rawIssues) {
        statuses.add(issue.Status);
      }
      return [...statuses].sort( (s1, s2)=> {
        return s1 > s2 ? 1 : -1;
      });
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
      let initiativeStatusesToRemove = this.statusesToRemove;
      let initiativeStatusesToShow =  this.statusesToShow;

      const reportedIssueType = this.primaryIssueType === "Release" ? this.secondaryIssueType : this.primaryIssueType;
      const timingMethods = getImpliedTimingCalculations(
        this.primaryIssueType, 
        this.issueHierarchy.typeToIssueType, 
        this.timingCalculations).map( (calc) => calc.calculation)
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
    prettyDate(date) {
        return date ? dateFormatter.format(date) : "";
    }
    paddingClass(depth) {
      return "pl-"+(depth * 2);
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

function getIssuesOfTypeAndStatus(issues, type, statuses){
  return issues.filter( (issue)=>{
    return issue["Issue Type"] === type && statuses.includes(issue.Status)
  })
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
    { type: "Release",    plural: "Releases", children: ["Initiative","Epic","Story"], availableTimingCalculations: ["childrenOnly"]},
    { type: "Initiative", plural: "Initiatives", children: ["Epic"], availableTimingCalculations: "*" },
    { type: "Epic", plural: "Epics", children: ["Story"], availableTimingCalculations: "*" },
    { type: "Story", plural: "Stories", children: [], availableTimingCalculations: ["parentOnly"] }
  ];
  const typeToIssueType = {};
  for(const issueType of base) {
    typeToIssueType[issueType.type] = issueType;
  }

  const allCalculations = Object.keys( calculationKeysToNames );
  for(const issueType of base) {
    issueType.denormalizedChildren = issueType.children.map( typeName => typeToIssueType[typeName]);
    const calcNames = issueType.availableTimingCalculations === "*" ? allCalculations : issueType.availableTimingCalculations;
    
    const childToTimingMap = {};
    issueType.timingCalculations = [];
    for(let issueTypeName of issueType.children){
      childToTimingMap[issueTypeName] = calcNames.map((calculationName)=> {
        return {
            child: issueTypeName, parent: issueType.type, 
            calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName]) }
      });
      issueType.timingCalculations.push({child: issueTypeName,calculations: childToTimingMap[issueTypeName]});
    }
    issueType.timingCalculationsMap = childToTimingMap;
  }
  base.typeToIssueType = typeToIssueType;
  console.log(typeToIssueType);
  return base;
}


function getImpliedTimingCalculations(primaryIssueType, issueTypeMap, currentTimingCalculations){
    const primaryType = issueTypeMap[primaryIssueType];
    let currentType = primaryIssueType;
    
    let childrenCalculations = primaryType.timingCalculations;
    const timingLevels = [];
    const setCalculations = [...currentTimingCalculations];
    
    const impliedTimingCalculations = [];
    while(childrenCalculations.length) {
      // this is the calculation that should be selected for that level
      let setLevelCalculation = setCalculations.shift() || 
        {
          type: childrenCalculations[0].child, 
          calculation: childrenCalculations[0].calculations[0].calculation
        };
      impliedTimingCalculations.push(setLevelCalculation);
      currentType = setLevelCalculation.type;
      childrenCalculations = issueTypeMap[currentType].timingCalculations;
    }
    return impliedTimingCalculations;
}