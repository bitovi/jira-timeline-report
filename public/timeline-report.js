import { StacheElement, type } from "./can.js";

import routeData from "./canjs/routing/route-data.js";

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
    {{#if(showingConfiguration)}}
        <timeline-configuration
          class="border-gray-100 border-r border-nuetral-301 relative block bg-white shrink-0" 
          style="overflow-y: auto"
          isLoggedIn:from="this.loginComponent.isLoggedIn"
          jiraHelpers:from="this.jiraHelpers"
          showSidebarBranding:from="this.showSidebarBranding"
          issueTimingCalculations:to="this.issueTimingCalculations"
          statuses:to="this.statuses"
          goBack:to="this.goBack"
          storage:from="this.storage"
          
          ></timeline-configuration>
    {{/if}}
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
              derivedIssues:from="this.routeData.derivedIssues"
              jiraHelpers:from="this.jiraHelpers"></select-issue-type>

            <select-report-type 
              jiraHelpers:from="this.jiraHelpers"></select-report-type>
        
            <compare-slider class='flex-grow'
              compareToTime:to="compareToTime"></compare-slider>

            <select-view-settings
              jiraHelpers:from="this.jiraHelpers"
              
              groupBy:to="this.groupBy"
              releasesToShow:to="this.releasesToShow"
              statuses:from="this.statuses"
              derivedIssues:from="this.routeData.derivedIssues"
              ></select-view-settings>
          </div>

          


          {{# and( not(this.routeData.jql), this.loginComponent.isLoggedIn  }}
            <div class="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">Configure a JQL in the sidebar on the left to get started.</div>
          {{ /and }}

          {{# and(this.routeData.derivedIssuesRequestData.issuesPromise.isResolved, this.primaryIssuesOrReleases.length) }}
            <div class="my-2   border-box block overflow-y-auto color-bg-white">
            
              {{# eq(this.routeData.primaryReportType, "start-due")  }}
                <gantt-grid 
                    primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
                    breakdown:from="this.routeData.primaryReportBreakdown"
                    showPercentComplete:from="this.routeData.showPercentComplete"
                    groupBy:from="this.routeData.groupBy"
                    primaryIssueType:from="this.routeData.primaryIssueType"
                    allDerivedIssues:from="this.routeData.derivedIssues"
                    ></gantt-grid>
              {{/ eq }}
              {{# eq(this.routeData.primaryReportType, "due") }}
                <scatter-timeline 
                  primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                  allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></scatter-timeline>
              {{/ eq }}
              {{# eq(this.routeData.primaryReportType, "table") }}
                <table-grid
                   primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></table-grid>
              {{/ eq }}
              {{# eq(this.routeData.primaryReportType, "group-grid") }}
                <group-grid
                   primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                    allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></group-grid>
              {{/ eq }}

              {{# or( eq(this.routeData.secondaryReportType, "status"), eq(this.routeData.secondaryReportType, "breakdown") ) }}
                <status-report 
                  breakdown:from="eq(this.routeData.secondaryReportType, 'breakdown')"
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
          {{# and(this.routeData.derivedIssuesRequestData.issuesPromise.isResolved, not(this.primaryIssuesOrReleases.length) ) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-text-and-bg-warning">
              <p>{{this.primaryIssuesOrReleases.length}} issues of type {{this.routeData.primaryIssueType}}.</p>
              <p>Please check your JQL and the View Settings.</p>
            </div>
          {{/}}
          {{# and(this.routeData.jql, this.routeData.derivedIssuesRequestData.issuesPromise.isPending) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-bg-white">
              <p>Loading ...<p>
              {{# if(this.routeData.derivedIssuesRequestData.progressData.issuesRequested)}}
                <p>Loaded {{this.routeData.derivedIssuesRequestData.progressData.issuesReceived}} of {{this.routeData.derivedIssuesRequestData.progressData.issuesRequested}} issues.</p>
              {{/ }}
            </div>
          {{/ and }}
          {{# if(this.routeData.derivedIssuesRequestData.issuesPromise.isRejected) }}
            <div class="my-2 p-2 h-780  border-box block overflow-hidden color-text-and-bg-blocked">
              <p>There was an error loading from Jira!</p>
              <p>Error message: {{this.routeData.derivedIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>
              <p>Please check your JQL is correct!</p>
            </div>
          {{/ if }}
        </div>
      </div>
  `;
  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },

    // passed values
    timingCalculationMethods: type.Any,
    storage: null,

    showingDebugPanel: { type: Boolean, default: false },

    // default params
    defaultSearch: type.Any,

    get showingConfiguration() {
      return this.loginComponent.isLoggedIn;
    },

    get issuesPromise() {
      return this.routeData.derivedIssuesRequestData?.issuesPromise;
    },

    get filteredDerivedIssues() {
      if (this.routeData.derivedIssues) {
        if (this.routeData.statusesToExclude?.length) {
          return this.routeData.derivedIssues.filter(
            ({ status }) => !this.routeData.statusesToExclude.includes(status)
          );
        } else {
          return this.routeData.derivedIssues;
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
        shouldShowReportsObservable: this.routeData.isLoggedInObservable,
        onViewReportsButtonClicked: (event) => {
          this.showReports(event);
        },
      })
    );
  }

  showReports(event) {
    event?.stopPropagation?.();
    routeData.showSettings = "REPORTS";
  }

  get rollupTimingLevelsAndCalculations() {
    /*console.log("rolledupAndRollrollupTimingLevelsAndCalculationsedBackIssuesAndReleases",{
        primaryIssueType: this.primaryIssueType, 
        secondaryIssueType: this.secondaryIssueType,
        issueTimingCalculations: this.issueTimingCalculations
      } )*/

    function getIssueHierarchyUnderType(timingCalculations = [], type) {
      const index = timingCalculations.findIndex((calc) => calc.type === type);
      return timingCalculations.slice(index);
    }

    if (this.routeData.primaryIssueType === "Release") {
      if (this.routeData.secondaryIssueType) {
        const secondary = getIssueHierarchyUnderType(
          this.issueTimingCalculations,
          this.routeData.secondaryIssueType
        );
        return [
          { type: "Release", hierarchyLevel: Infinity, calculation: "childrenOnly" },
          ...secondary,
        ];
      }
    } else {
      return getIssueHierarchyUnderType(this.issueTimingCalculations, this.routeData.primaryIssueType);
    }
  }

  // this all the data pre-compiled
  get rolledupAndRolledBackIssuesAndReleases() {
    if (
      !this.filteredDerivedIssues ||
      !this.rollupTimingLevelsAndCalculations ||
      !this.routeData.normalizeOptions
    ) {
      return [];
    }

    const rolledUp = rollupAndRollback(
      this.filteredDerivedIssues,
      this.routeData.normalizeOptions,
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
    if (!this.groupedParentDownHierarchy.length || !this?.routeData?.planningStatuses?.length) {
      return [];
    }
    const planningSourceIssues =
      this.routeData.primaryIssueType === "Release"
        ? this.groupedParentDownHierarchy[1]
        : this.groupedParentDownHierarchy[0];
    return planningSourceIssues.filter((normalizedIssue) => {
      return this.routeData.planningStatuses.includes(normalizedIssue.status);
    });
  }
  get primaryIssuesOrReleases() {
    //console.log("primaryIssuesOrReleases", this.groupedParentDownHierarchy.length)
    if (!this.groupedParentDownHierarchy.length) {
      return [];
    }
    const unfilteredPrimaryIssuesOrReleases = this.groupedParentDownHierarchy[0];

    const hideUnknownInitiatives = this.routeData.hideUnknownInitiatives;
    let statusesToRemove = this.routeData.statusesToRemove;
    let statusesToShow = this.routeData.statusesToShow;

    function startBeforeDue(initiative) {
      return initiative.rollupStatuses.rollup.start < initiative.rollupStatuses.rollup.due;
    }

    // lets remove stuff!
    const filtered = unfilteredPrimaryIssuesOrReleases.filter((issueOrRelease) => {
      // check if it's a planning issues
      if (
        this?.routeData?.planningStatuses?.length &&
        this.routeData.primaryIssueType !== "Release" &&
        this.routeData.planningStatuses.includes(issueOrRelease.status)
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
        this.routeData.showOnlySemverReleases &&
        this.routeData.primaryIssueType === "Release" &&
        !issueOrRelease.names.semver
      ) {
        return false;
      }

      if (hideUnknownInitiatives && !startBeforeDue(issueOrRelease)) {
        return false;
      }
      if (this.routeData.primaryIssueType === "Release") {
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

    if (this.routeData.sortByDueDate) {
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
