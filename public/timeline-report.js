import { StacheElement, type } from "./can.js";

import "./canjs/controls/status-filter.js";
import "./canjs/controls/compare-slider.js";
import "./canjs/reports/gantt-grid.js";
import "./canjs/reports/table-grid.js";
import "./canjs/reports/scatter-timeline.js";
import "./canjs/reports/status-report.js";
import "./canjs/reports/group-grid/group-grid.js";
import "./canjs/controls/timeline-configuration/timeline-configuration.js";

import "./canjs/controls/select-issue-type/select-issue-type.js";
import "./canjs/controls/select-report-type/select-report-type.js";
import "./canjs/controls/select-view-settings/select-view-settings.js";

import { rollupAndRollback } from "./jira/rolledup-and-rolledback/rollup-and-rollback";
import { calculateReportStatuses } from "./jira/rolledup/work-status/work-status";
import { groupIssuesByHierarchyLevelOrType } from "./jira/rollup/rollup";
import { pushStateObservable } from "./canjs/routing/state-storage.js";

import { createRoot } from "react-dom/client";
import { createElement } from "react";

import SavedReports from "./react/SaveReports";

import { get, set } from "react-hook-form";

export class TimelineReport extends StacheElement {
  static view = `<div class="flex">
        <timeline-configuration
          class="border-gray-100 border-r border-nuetral-301 relative block bg-white shrink-0" 
          style="overflow-y: auto"
          isLoggedIn:from="this.loginComponent.isLoggedIn"
          jiraHelpers:from="this.jiraHelpers"
          showSidebarBranding:from="this.showSidebarBranding"

          jql:to="this.jql"
          derivedIssuesRequestData:to="this.derivedIssuesRequestData"
          issueTimingCalculations:to="this.issueTimingCalculations"
          configuration:to="this.configuration"
          statuses:to="this.statuses"
          statusesToExclude:to="this.statusesToExclude"
          goBack:to="this.goBack"
          storage:from="this.storage"
          
          ></timeline-configuration>

      <div class=" fullish-vh pt-4 pl-4 pr-4 relative grow flex flex-col" on:click="this.goBack()">

        {{# not(this.loginComponent.isLoggedIn) }}

          <div class="p-4 mb-4 drop-shadow-md hide-on-fullscreen bg-yellow-300">
            <p>The following is a sample report. Learn more about it in the 
              "<a class="text-blue-400" href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira/reporting.html">Agile Program Management with Jira</a>" 
              training. Click "Connect to Jira" to load your own data.</p>
            <p class="mt-2">Checkout the following sample reports:</p>
            <ul class="list-disc list-inside ml-2">
              <li><a class="text-blue-400" href="?primaryIssueType=Release&hideUnknownInitiatives=true&primaryReportType=due&secondaryReportType=status">Release end dates with initiative status</a></li>
              <li><a class="text-blue-400" href="?primaryIssueType=Release&hideUnknownInitiatives=true&secondaryReportType=breakdown">Release timeline with initiative work breakdown</a></li>
              <li><a class="text-blue-400" href="?primaryIssueType=Initiative&hideUnknownInitiatives=true&primaryReportType=start-due&primaryReportBreakdown=true">Ready and in-development initiative work breakdown</a></li>
            </ul>

          </div>
      {{/ not }}
          <div id="saved-reports" class='pb-5'></div>
          <div class="flex gap-1">
            <select-issue-type 
              primaryIssueType:to="this.primaryIssueType"
              secondaryIssueType:to="this.secondaryIssueType"
              derivedIssues:from="this.derivedIssues"
              jiraHelpers:from="this.jiraHelpers"></select-issue-type>

            <select-report-type 
              primaryReportType:to="this.primaryReportType"
              jiraHelpers:from="this.jiraHelpers"></select-report-type>
        
            <compare-slider class='flex-grow'
              compareToTime:to="compareToTime"></compare-slider>

            <select-view-settings
              jiraHelpers:from="this.jiraHelpers"
              
              statusesToRemove:to="this.statusesToRemove"
              statusesToShow:to="this.statusesToShow"
              showOnlySemverReleases:to="this.showOnlySemverReleases"
              secondaryReportType:to="this.secondaryReportType"
              hideUnknownInitiatives:to="this.hideUnknownInitiatives"
              sortByDueDate:to="this.sortByDueDate"
              showPercentComplete:to="this.showPercentComplete"
              planningStatuses:to="this.planningStatuses"
              groupBy:to="this.groupBy"
              releasesToShow:to="this.releasesToShow"
              primaryReportBreakdown:to="this.primaryReportBreakdown"
              primaryReportType:from="this.primaryReportType"
              primaryIssueType:from="this.primaryIssueType"
              secondaryIssueType:from="this.secondaryIssueType"
              statuses:from="this.statuses"
              derivedIssues:from="this.derivedIssues"
              isLoggedIn:from="this.loginComponent.isLoggedIn"
              ></select-view-settings>
          </div>

          


          {{# and( not(this.jql), this.loginComponent.isLoggedIn  }}
            <div class="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">Configure a JQL in the sidebar on the left to get started.</div>
          {{ /and }}

          {{# and(this.derivedIssuesRequestData.issuesPromise.isResolved, this.primaryIssuesOrReleases.length) }}
            <div class="my-2   border-box block overflow-y-auto color-bg-white">
            
              {{# eq(this.primaryReportType, "start-due")  }}
                <gantt-grid 
                    primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
                    breakdown:from="this.primaryReportBreakdown"
                    showPercentComplete:from="this.showPercentComplete"
                    groupBy:from="this.groupBy"
                    primaryIssueType:from="this.primaryIssueType"
                    allDerivedIssues:from="this.derivedIssues"
                    ></gantt-grid>
              {{/ eq }}
              {{# eq(this.primaryReportType, "due") }}
                <scatter-timeline 
                  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                  allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></scatter-timeline>
              {{/ eq }}
              {{# eq(this.primaryReportType, "table") }}
                <table-grid
                   primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></table-grid>
              {{/ eq }}
              {{# eq(this.primaryReportType, "group-grid") }}
                <group-grid
                   primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></group-grid>
              {{/ eq }}

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
                <span class='color-text-and-bg-warning p-2 inline-block'>Warning</span>
                <span class='color-text-and-bg-blocked p-2 inline-block'>Blocked</span>
                <span class='color-text-and-bg-complete p-2 inline-block'>Complete</span>
              </div>
            </div>
          {{/ and }}
          {{# and(this.derivedIssuesRequestData.issuesPromise.isResolved, not(this.primaryIssuesOrReleases.length) ) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-text-and-bg-warning">
              <p>{{this.primaryIssuesOrReleases.length}} issues of type {{this.primaryIssueType}}.</p>
              <p>Please check your JQL and the View Settings.</p>
            </div>
          {{/}}
          {{# and(this.jql, this.derivedIssuesRequestData.issuesPromise.isPending) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-bg-white">
              <p>Loading ...<p>
              {{# if(this.derivedIssuesRequestData.progressData.issuesRequested)}}
                <p>Loaded {{this.derivedIssuesRequestData.progressData.issuesReceived}} of {{this.derivedIssuesRequestData.progressData.issuesRequested}} issues.</p>
              {{/ }}
            </div>
          {{/ and }}
          {{# if(this.derivedIssuesRequestData.issuesPromise.isRejected) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-text-and-bg-blocked">
              <p>There was an error loading from Jira!</p>
              <p>Error message: {{this.derivedIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>
              <p>Please check your JQL is correct!</p>
            </div>
          {{/ if }}
        </div>
      </div>
  `;
  static props = {
    // passed values
    timingCalculationMethods: type.Any,
    storage: null,

    showingDebugPanel: { type: Boolean, default: false },

    // default params
    defaultSearch: type.Any,

    showingConfiguration: false,

    get issuesPromise() {
      return this.derivedIssuesRequestData?.issuesPromise;
    },
    derivedIssues: {
      // this can't use async b/c we need the value to turn to undefined
      value({ listenTo, resolve }) {
        const resolveValueFromPromise = () => {
          resolve(undefined);
          if (this.derivedIssuesRequestData?.issuesPromise) {
            this.derivedIssuesRequestData.issuesPromise.then(resolve);
          }
        };
        listenTo("derivedIssuesRequestData", resolveValueFromPromise);
        resolveValueFromPromise();
      } /*,
      async(resolve) {
        this.derivedIssuesRequestData?.issuesPromise.then(resolve);
      },*/,
    },
    get filteredDerivedIssues() {
      if (this.derivedIssues) {
        if (this.statusesToExclude?.length) {
          return this.derivedIssues.filter(
            ({ status }) => !this.statusesToExclude.includes(status)
          );
        } else {
          return this.derivedIssues;
        }
      }
    },
  };

  // hooks
  rendered() {
    updateFullishHeightSection();
  }

  async connected() {
    createRoot(document.getElementById("saved-reports")).render(
      createElement(SavedReports, {
        queryParamObservable: pushStateObservable,
        storage: this.storage,
        onViewReportsButtonClicked: (event) => {
          this.showReports(event);
        },
      })
    );
  }

  showReports(event) {
    event?.stopPropagation?.();
    document.querySelector("timeline-configuration").showSettings = "REPORTS";
  }

  get rollupTimingLevelsAndCalculations() {
    /*console.log("rolledupAndRollrollupTimingLevelsAndCalculationsedBackIssuesAndReleases",{
        primaryIssueType: this.primaryIssueType, 
        secondaryIssueType: this.secondaryIssueType,
        issueTimingCalculations: this.issueTimingCalculations
      } )*/

    function getIssueHierarchyUnderType(timingCalculations, type) {
      const index = timingCalculations.findIndex((calc) => calc.type === type);
      return timingCalculations.slice(index);
    }

    if (this.primaryIssueType === "Release") {
      if (this.secondaryIssueType) {
        const secondary = getIssueHierarchyUnderType(
          this.issueTimingCalculations,
          this.secondaryIssueType
        );
        return [
          { type: "Release", hierarchyLevel: Infinity, calculation: "childrenOnly" },
          ...secondary,
        ];
      }
    } else {
      return getIssueHierarchyUnderType(this.issueTimingCalculations, this.primaryIssueType);
    }
  }

  // this all the data pre-compiled
  get rolledupAndRolledBackIssuesAndReleases() {
    if (
      !this.filteredDerivedIssues ||
      !this.rollupTimingLevelsAndCalculations ||
      !this.configuration
    ) {
      return [];
    }

    const rolledUp = rollupAndRollback(
      this.filteredDerivedIssues,
      this.configuration,
      this.rollupTimingLevelsAndCalculations,
      new Date(new Date().getTime() - this.compareToTime.timePrior)
    );

    const statuses = calculateReportStatuses(rolledUp);
    return statuses;
  }

  get groupedParentDownHierarchy() {
    /*console.log("groupedParentDownHierarchy",{
        rolledupAndRolledBackIssuesAndReleases: this.rolledupAndRolledBackIssuesAndReleases, 
        rollupTimingLevelsAndCalculations: this.rollupTimingLevelsAndCalculations
      } )*/
    if (!this.rolledupAndRolledBackIssuesAndReleases || !this.rollupTimingLevelsAndCalculations) {
      return [];
    }
    const groupedHierarchy = groupIssuesByHierarchyLevelOrType(
      this.rolledupAndRolledBackIssuesAndReleases,
      this.rollupTimingLevelsAndCalculations
    );
    return groupedHierarchy.reverse();
  }
  get planningIssues() {
    if (!this.groupedParentDownHierarchy.length || !this?.planningStatuses?.length) {
      return [];
    }
    const planningSourceIssues =
      this.primaryIssueType === "Release"
        ? this.groupedParentDownHierarchy[1]
        : this.groupedParentDownHierarchy[0];
    return planningSourceIssues.filter((normalizedIssue) => {
      return this.planningStatuses.includes(normalizedIssue.status);
    });
  }
  get primaryIssuesOrReleases() {
    //console.log("primaryIssuesOrReleases", this.groupedParentDownHierarchy.length)
    if (!this.groupedParentDownHierarchy.length) {
      return [];
    }
    const unfilteredPrimaryIssuesOrReleases = this.groupedParentDownHierarchy[0];

    const hideUnknownInitiatives = this.hideUnknownInitiatives;
    let statusesToRemove = this.statusesToRemove;
    let statusesToShow = this.statusesToShow;

    function startBeforeDue(initiative) {
      return initiative.rollupStatuses.rollup.start < initiative.rollupStatuses.rollup.due;
    }

    // lets remove stuff!
    const filtered = unfilteredPrimaryIssuesOrReleases.filter((issueOrRelease) => {
      // check if it's a planning issues
      if (
        this?.planningStatuses?.length &&
        this.primaryIssueType !== "Release" &&
        this.planningStatuses.includes(issueOrRelease.status)
      ) {
        return false;
      }

      if (this?.releasesToShow?.length) {
        // O(n^2)
        const releases = issueOrRelease.releases.map((r) => r.name);
        if (releases.filter((release) => this.releasesToShow.includes(release)).length === 0) {
          return false;
        }
      }

      if (
        this.showOnlySemverReleases &&
        this.primaryIssueType === "Release" &&
        !issueOrRelease.names.semver
      ) {
        return false;
      }

      if (hideUnknownInitiatives && !startBeforeDue(issueOrRelease)) {
        return false;
      }
      if (this.primaryIssueType === "Release") {
        // releases don't have statuses, so we look at their children
        if (statusesToRemove && statusesToRemove.length) {
          if (
            issueOrRelease.childStatuses.children.every(({ status }) =>
              statusesToRemove.includes(status)
            )
          ) {
            return false;
          }
        }

        if (statusesToShow && statusesToShow.length) {
          // Keep if any valeue has a status to show
          if (
            !issueOrRelease.childStatuses.children.some(({ status }) =>
              statusesToShow.includes(status)
            )
          ) {
            return false;
          }
        }
      } else {
        if (statusesToShow && statusesToShow.length) {
          if (!statusesToShow.includes(issueOrRelease.status)) {
            return false;
          }
        }
        if (statusesToRemove && statusesToRemove.length) {
          if (statusesToRemove.includes(issueOrRelease.status)) {
            return false;
          }
        }
      }

      return true;
    });

    if (this.sortByDueDate) {
      return filtered.toSorted(
        (i1, i2) => i1.rollupStatuses.rollup.due - i2.rollupStatuses.rollup.due
      );
    } else {
      return filtered;
    }
  }

  showDebug(open) {
    this.showingDebugPanel = open;
  }
}

customElements.define("timeline-report", TimelineReport);

function sortReadyFirst(initiatives) {
  return initiatives.sort((a, b) => {
    if (a.Status === "Ready") {
      return -1;
    }
    return 1;
  });
}

function newDateFromYYYYMMDD(dateString) {
  const [year, month, day] = dateString.split("-");
  return new Date(year, month - 1, day);
}

function addTeamBreakdown(release) {
  return {
    ...release,
  };
}

// ontrack
// behind
// complete

function getElementPosition(el) {
  var rect = el?.getBoundingClientRect();
  var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return { x: rect.left + scrollLeft, y: rect.top + scrollTop };
}

function updateFullishHeightSection() {
  const position = getElementPosition(document.querySelector(".fullish-vh"));
  document.documentElement.style.setProperty("--fullish-document-top", `${position.y}px`);
}

window.addEventListener("load", updateFullishHeightSection);
window.addEventListener("resize", updateFullishHeightSection);
