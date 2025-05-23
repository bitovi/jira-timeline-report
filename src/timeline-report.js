import { StacheElement, type, queues, Reflect } from './can.js';

import routeData from './canjs/routing/route-data';

import './canjs/controls/status-filter.js';
import './canjs/controls/compare-slider.js';
import './canjs/reports/gantt-grid.js';
import './canjs/reports/table-grid.js';
import './canjs/reports/scatter-timeline.js';
import './canjs/reports/status-report.js';

import './canjs/controls/select-report-type/select-report-type.js';

import { rollupAndRollback } from './jira/rolledup-and-rolledback/rollup-and-rollback';
import { calculateReportStatuses } from './jira/rolledup/work-status/work-status';
import { groupIssuesByHierarchyLevelOrType } from './jira/rollup/rollup';
import { pushStateObservable } from './canjs/routing/state-storage.js';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

import SelectIssueType from './react/SelectIssueType';
import SavedReports from './react/SaveReports';
import SettingsSidebar from './react/SettingsSidebar';
import Filters from './react/Filters';
import ViewSettings from './react/ViewSettings';
import SampleDataNotice from './react/SampleDataNotice';
import ViewReports from './react/ViewReports';
import StatusKeys from './react/StatusKey';

import { getTheme, applyThemeToCssVars } from './jira/theme';

export class TimelineReport extends StacheElement {
  static view = `
    {{#if(showingConfiguration)}}
        <div id="timeline-configuration" 
          class="border-gray-100 border-r border-neutral-301 relative block bg-white shrink-0" 
        ></div>
    {{/if}}
    <div class="fullish-vh pl-4 pr-4 flex flex-1 flex-col overflow-y-auto relative">
    <div id="view-reports"></div>  
    <div id='sample-data-notice' class='pt-4'></div>
      <div id="saved-reports" class='py-4'></div>
      <div class="flex gap-1">
        <div id='select-issue-type' class='pt-1'></div>
        
        <select-report-type 
          jiraHelpers:from="this.jiraHelpers"
          features:from="this.features"></select-report-type>
          
        <compare-slider class='flex-grow px-2'
          compareToTime:to="compareToTime"></compare-slider>
        <div id="filters" class="self-end pb-1"></div>
        <div id="view-settings" class="self-end pb-1"></div>
      </div>

      {{# and( not(this.routeData.jql), this.loginComponent.isLoggedIn  }}
        <div class="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">Configure a JQL in the sidebar on the left to get started.</div>
      {{ /and }}

      {{# and(this.routeData.derivedIssuesRequestData.issuesPromise.isResolved, this.primaryIssuesOrReleases.length) }}
        <div class="my-2 border-box color-bg-white flex-1">
                
          {{# eq(this.routeData.primaryReportType, "start-due")  }}
            <gantt-grid 
                primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
                allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"
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

          {{# or( eq(this.routeData.secondaryReportType, "status"), eq(this.routeData.secondaryReportType, "breakdown") ) }}
            <status-report 
              breakdown:from="eq(this.routeData.secondaryReportType, 'breakdown')"
              planningIssues:from="this.planningIssues"
              primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
              allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></status-report>
          {{/ }}

          <div class='p-2 sticky bottom-0 bg-white z-[50]'>
            <div id='status-keys' on:inserted='this.attachStatusKeys()'></div>
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
          {{# eq(this.routeData.derivedIssuesRequestData.issuesPromise.reason.type, 'no-licensing')}}
            <h2>No license</h2>
            <p>You must have a license to use this application</p>
          {{else}}
            <p>There was an error loading from Jira!</p>
            <p>Error message: {{this.routeData.derivedIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>
            <p>Please check your JQL is correct!</p>
          {{/}}
          
        </div>
      {{/ if }}
    </div>
  `;
  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },

    // passed values
    licensing: null,
    timingCalculationMethods: type.Any,
    storage: null,
    linkBuilder: null,
    featuresPromise: null,

    showingDebugPanel: { type: Boolean, default: false },

    // default params
    defaultSearch: type.Any,

    get showingConfiguration() {
      return this.loginComponent.isLoggedIn;
    },

    get issuesPromise() {
      return this.routeData.derivedIssuesRequestData?.issuesPromise;
    },

    features: {
      async() {
        return this.featuresPromise;
      },
    },

    get filteredDerivedIssues() {
      if (this.routeData.derivedIssues) {
        if (this.routeData.statusesToExclude?.length) {
          return this.routeData.derivedIssues.filter(
            ({ status }) => !this.routeData.statusesToExclude.includes(status),
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

  attachStatusKeys() {
    createRoot(document.getElementById('status-keys')).render(createElement(StatusKeys, {}));
  }

  async connected() {
    window.addEventListener('load', updateFullishHeightSection);
    window.addEventListener('resize', updateFullishHeightSection);

    createRoot(document.getElementById('select-issue-type')).render(createElement(SelectIssueType, {}));

    createRoot(document.getElementById('view-reports')).render(
      createElement(ViewReports, {
        onBackButtonClicked: () => {
          this.routeData.showSettings = '';
        },
      }),
    );

    createRoot(document.getElementById('sample-data-notice')).render(
      createElement(SampleDataNotice, {
        shouldHideNoticeObservable: this.routeData.isLoggedInObservable,
        onLoginClicked: () => {
          this.loginComponent.login();
        },
      }),
    );

    createRoot(document.getElementById('saved-reports')).render(
      createElement(SavedReports, {
        queryParamObservable: pushStateObservable,
        storage: this.storage,
        linkBuilder: this.linkBuilder,
        shouldShowReportsObservable: this.routeData.isLoggedInObservable,
        onViewReportsButtonClicked: (event) => {
          this.showReports(event);
        },
      }),
    );

    createRoot(document.getElementById('filters')).render(createElement(Filters));
    createRoot(document.getElementById('view-settings')).render(createElement(ViewSettings));

    getTheme(this.routeData.storage)
      .then(applyThemeToCssVars)
      .catch((error) => console.error('Something went wrong getting the theme', error));

    const timelineConfiguration = document.getElementById('timeline-configuration');
    if (timelineConfiguration) {
      createRoot(timelineConfiguration).render(
        createElement(SettingsSidebar, {
          isLoggedIn: this.loginComponent.isLoggedIn,
          showSidebarBranding: this.showSidebarBranding,
          jiraHelpers: this.jiraHelpers,
          linkBuilder: this.linkBuilder,
          onUpdateTeamsConfiguration: ({ fields, ...configuration }) => {
            queues.batch.start();

            routeData.fieldsToRequest = fields;
            routeData.normalizeOptions = configuration;

            queues.batch.stop();
          },
        }),
      );
    }
  }

  showReports(event) {
    event?.stopPropagation?.();
    routeData.showSettings = 'REPORTS';
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

    if (this.routeData.primaryIssueType === 'Release') {
      if (this.routeData.secondaryIssueType) {
        const secondary = getIssueHierarchyUnderType(
          this.routeData.issueTimingCalculations,
          this.routeData.secondaryIssueType,
        );
        return [{ type: 'Release', hierarchyLevel: Infinity, calculation: 'childrenOnly' }, ...secondary];
      }
    } else {
      return getIssueHierarchyUnderType(this.routeData.issueTimingCalculations, this.routeData.primaryIssueType);
    }
  }

  // this all the data pre-compiled
  get rolledupAndRolledBackIssuesAndReleases() {
    if (!this.filteredDerivedIssues || !this.rollupTimingLevelsAndCalculations || !this.routeData.normalizeOptions) {
      return [];
    }

    const rolledUp = rollupAndRollback(
      this.filteredDerivedIssues,
      this.routeData.normalizeOptions,
      this.rollupTimingLevelsAndCalculations,
      new Date(new Date().getTime() - this.compareToTime.timePrior),
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
      this.rollupTimingLevelsAndCalculations,
    );
    return groupedHierarchy.reverse();
  }
  get planningIssues() {
    if (!this.groupedParentDownHierarchy.length || !this?.routeData?.planningStatuses?.length) {
      return [];
    }
    const planningSourceIssues =
      this.routeData.primaryIssueType === 'Release'
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
        this.routeData.primaryIssueType !== 'Release' &&
        this.routeData.planningStatuses.includes(issueOrRelease.status)
      ) {
        return false;
      }

      if (this?.routeData.releasesToShow?.length) {
        if (!this.routeData.releasesToShow.includes(issueOrRelease.name)) {
          return false;
        }
      }

      if (
        this.routeData.showOnlySemverReleases &&
        this.routeData.primaryIssueType === 'Release' &&
        !issueOrRelease.names.semver
      ) {
        return false;
      }

      if (hideUnknownInitiatives && !startBeforeDue(issueOrRelease)) {
        return false;
      }
      if (this.routeData.primaryIssueType === 'Release') {
        // releases don't have statuses, so we look at their children
        if (statusesToRemove && statusesToRemove.length) {
          if (issueOrRelease.childStatuses.children.every(({ status }) => statusesToRemove.includes(status))) {
            return false;
          }
        }

        if (statusesToShow && statusesToShow.length) {
          // Keep if any valeue has a status to show
          if (!issueOrRelease.childStatuses.children.some(({ status }) => statusesToShow.includes(status))) {
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
      return filtered.toSorted((i1, i2) => i1.rollupStatuses.rollup.due - i2.rollupStatuses.rollup.due);
    } else {
      return filtered;
    }
  }

  showDebug(open) {
    this.showingDebugPanel = open;
  }
}

customElements.define('timeline-report', TimelineReport);

function sortReadyFirst(initiatives) {
  return initiatives.sort((a, b) => {
    if (a.Status === 'Ready') {
      return -1;
    }
    return 1;
  });
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
  const position = getElementPosition(document.querySelector('.fullish-vh'));
  document.documentElement.style.setProperty('--fullish-document-top', `${position.y}px`);
}
