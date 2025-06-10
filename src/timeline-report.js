import { StacheElement, type, queues, value } from './can.js';

import routeData from './canjs/routing/route-data';

import './canjs/controls/status-filter.js';
import './canjs/reports/gantt-grid.js';
import './canjs/reports/table-grid.js';
import './canjs/reports/scatter-timeline.js';
import './canjs/reports/status-report.js';

import { rollupAndRollback } from './jira/rolledup-and-rolledback/rollup-and-rollback';
import { calculateReportStatuses } from './jira/rolledup/work-status/work-status';
import { getTheme, applyThemeToCssVars } from './jira/theme';

import { groupIssuesByHierarchyLevelOrType } from './jira/rollup/rollup';
import { pushStateObservable } from './canjs/routing/state-storage.js';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

import ReportControls from './react/ReportControls';
import SavedReports from './react/SaveReports';
import SampleDataNotice from './react/SampleDataNotice';
import SettingsSidebar from './react/SettingsSidebar';
import ViewReports from './react/ViewReports';
import ReportFooter from './react/ReportFooter/ReportFooter';

import { EstimateAnalysis } from './react/reports/EstimateAnalysis/EstimateAnalysis';
import AutoScheduler from './react/reports/AutoScheduler/AutoScheduler';
import EstimationProgress from './react/reports/EstimationProgress/EstimationProgress';
import { GroupingReport } from './react/reports/GroupingReport/GroupingReport';

const urlParamValuesToReactComponents = {
  'estimate-analysis': EstimateAnalysis,
  'auto-scheduler': AutoScheduler,
  'estimation-progress': EstimationProgress,
  grouper: GroupingReport,
};

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
      <div id="report-controls" class="flex gap-1"></div>

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
          {{# if(this.isReactComponent(this.routeData.primaryReportType) ) }}
            <div id='react-report-container' 
              on:inserted='this.attachReactReport()'
              on:removed='this.detachReactReport()'></div>
          {{/ if}}
          

          {{# or( eq(this.routeData.secondaryReportType, "status"), eq(this.routeData.secondaryReportType, "breakdown") ) }}
            <status-report 
              breakdown:from="eq(this.routeData.secondaryReportType, 'breakdown')"
              planningIssues:from="this.planningIssues"
              primaryIssuesOrReleases:from="this.primaryIssuesOrReleases"
              allIssuesOrReleases:from="this.rolledupAndRolledBackIssuesAndReleases"></status-report>
          {{/ }}

          <div id="report-footer" class="sticky bottom-0 z-40"
            on:inserted='this.attachReportFooter()'
            on:removed='this.detachReportFooter()'></div>
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
  isReactComponent(reportType) {
    return urlParamValuesToReactComponents.hasOwnProperty(reportType);
  }

  attachReactReport() {
    const reportType = this.routeData.primaryReportType;
    if (!urlParamValuesToReactComponents[reportType]) {
      return;
    }

    const element = document.getElementById('react-report-container');
    if (!element) {
      console.warn('No element found for react report container');
      return;
    }
    this.reactReportRoot = createRoot(element);

    this.renderReactReport();
  }
  renderReactReport() {
    const reportType = this.routeData.primaryReportType;
    this.reactReportRoot.render(
      createElement(urlParamValuesToReactComponents[reportType], {
        primaryIssuesOrReleasesObs: value.from(this, 'primaryIssuesOrReleases'),
        allIssuesOrReleasesObs: value.from(this, 'rolledupAndRolledBackIssuesAndReleases'),
        rollupTimingLevelsAndCalculationsObs: value.from(this, 'rollupTimingLevelsAndCalculations'),
        filteredDerivedIssuesObs: value.from(this, 'filteredDerivedIssues'),
      }),
    );
  }
  detachReactReport() {
    if (this.reactReportRoot) {
      this.reactReportRoot.unmount();
      this.reactReportRoot = null;
    }
  }

  attachEstimateAnalysis() {
    const element = document.getElementById('estimate-analysis');
    this.estimateAnalysisRoot = createRoot(element);

    this.estimateAnalysisRoot.render(
      createElement(EstimateAnalysis, {
        primaryIssuesOrReleasesObs: value.from(this, 'primaryIssuesOrReleases'),
        allIssuesOrReleasesObs: value.from(this, 'rolledupAndRolledBackIssuesAndReleases'),
        rollupTimingLevelsAndCalculationsObs: value.from(this, 'rollupTimingLevelsAndCalculations'),
      }),
    );
  }
  detachEstimateAnalysis() {
    if (this.estimateAnalysisRoot) {
      this.estimateAnalysisRoot.unmount();
      this.estimateAnalysisRoot = null;
    }
  }
  attachAutoScheduler() {
    const element = document.getElementById('auto-scheduler');
    this.autoSchedulerRoot = createRoot(element);

    this.autoSchedulerRoot.render(
      createElement(AutoScheduler, {
        primaryIssuesOrReleasesObs: value.from(this, 'primaryIssuesOrReleases'),
        allIssuesOrReleasesObs: value.from(this, 'rolledupAndRolledBackIssuesAndReleases'),
        rollupTimingLevelsAndCalculationsObs: value.from(this, 'rollupTimingLevelsAndCalculations'),
      }),
    );
  }
  detachAutoScheduler() {
    if (this.autoSchedulerRoot) {
      this.autoSchedulerRoot.unmount();
      this.autoSchedulerRoot = null;
    }
  }
  attachEstimationProgress() {
    const container = document.getElementById('estimation-progress');
    if (container) {
      this._estimationProgressRoot = createRoot(container);
      this._estimationProgressRoot.render(
        createElement(EstimationProgress, {
          allIssuesOrReleasesObs: value.from(this, 'filteredDerivedIssues'),
        }),
      );
    }
  }
  detachEstimationProgress() {
    if (this._estimationProgressRoot) {
      this._estimationProgressRoot.unmount();
      this._estimationProgressRoot = null;
    }
  }

  attachReportFooter() {
    const element = document.getElementById('report-footer');
    this.reportFooterRoot = createRoot(element);

    this.reportFooterRoot.render(createElement(ReportFooter));
  }

  detachReportFooter() {
    if (!this.reportFooterRoot) {
      return;
    }

    this.reportFooterRoot.unmount();
    this.reportFooterRoot = null;
  }

  async connected() {
    // handle changes in the React components
    this.listenTo(this.routeData, 'primaryReportType', (ev, newValue) => {
      if (urlParamValuesToReactComponents[newValue]) {
        if (this.reactReportRoot) {
          this.renderReactReport();
        } else {
          this.detachReactReport();
          this.attachReactReport();
        }
      }
    });

    window.addEventListener('load', updateFullishHeightSection);
    window.addEventListener('resize', updateFullishHeightSection);

    createRoot(document.getElementById('view-reports')).render(
      createElement(ViewReports, {
        onBackButtonClicked: () => {
          this.routeData.showSettings = '';
        },
      }),
    );

    createRoot(document.getElementById('report-controls')).render(createElement(ReportControls));

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
      new Date(new Date().getTime() - this.routeData.compareTo * 1000),
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
