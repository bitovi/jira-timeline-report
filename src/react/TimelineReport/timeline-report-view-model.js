import { ObservableObject } from '../../can';

import routeData from '../../canjs/routing/route-data';

import { rollupAndRollback } from '../../jira/rolledup-and-rolledback/rollup-and-rollback';
import { calculateReportStatuses } from '../../jira/rolledup/work-status/work-status';
import { matchesAllFilterRows } from '../../jira/rollup/filter-rows/filter-rows';
import { groupIssuesByHierarchyLevelOrType } from '../../jira/rollup/rollup';
import { defineFeatureFlag } from '../../shared/feature-flag';

// Dev helper: logs the fully transformed (rolled up + rolled back) issue data that every report
// consumes. Off by default; toggle in the browser console via `window.featureFlags` and reload.
const logReportData = defineFeatureFlag(
  'logReportData',
  'Logs the fully transformed (rolled up + rolled back) issue data all reports consume.',
  undefined,
  'ON',
);

const toISO = (date) => (date instanceof Date && !isNaN(date) ? date.toISOString() : (date ?? null));

// Compact, copy-pasteable projection of the transformed data (raw issues carry circular parent
// refs and are too large to paste). Keeps the fields reports position/status off of.
const projectIssueForLog = (issueOrRelease) => ({
  key: issueOrRelease.key,
  summary: issueOrRelease.summary,
  type: issueOrRelease.type,
  hierarchyLevel: issueOrRelease.hierarchyLevel,
  status: issueOrRelease.rollupStatuses?.rollup?.status,
  rollupStatusesDue: toISO(issueOrRelease.rollupStatuses?.rollup?.due),
  rollupStatusesStart: toISO(issueOrRelease.rollupStatuses?.rollup?.start),
  rollupDatesDue: toISO(issueOrRelease.rollupDates?.due),
  rollupDatesStart: toISO(issueOrRelease.rollupDates?.start),
});

/**
 * The derived-data pipeline that every report consumes, extracted verbatim from the
 * `<timeline-report>` StacheElement so the React shell can host it while keeping the CanJS
 * reactive semantics unchanged. Reports still receive `value.from(vm, …)` observable props, so
 * they need no changes (see spec/011-react-rewrite/timeline-report/rewrite-plan.md — Option A).
 *
 * Reads the shared `routeData` singleton; exposes the same computed getters the shell had.
 */
export class TimelineReportViewModel extends ObservableObject {
  static props = {
    routeData: {
      get default() {
        return routeData;
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

    // the timing calculations for the type and below
    // this is telling you how things roll up to you
    get rollupTimingLevelsAndCalculations() {
      // Slice the timing calculations to the selected From→To range. `fromType` is the top level
      // (primary); `toType` caps the descent. When `toType` is absent/unknown (or above From), the
      // range extends to the deepest level — i.e. full hierarchy, unchanged from prior behavior.
      function getIssueHierarchyUnderType(timingCalculations = [], fromType, toType) {
        const fromIndex = timingCalculations.findIndex((calc) => calc.type === fromType);
        const toIndex = toType ? timingCalculations.findIndex((calc) => calc.type === toType) : -1;
        const end = toIndex >= fromIndex ? toIndex + 1 : timingCalculations.length;
        return timingCalculations.slice(fromIndex, end);
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
        return getIssueHierarchyUnderType(
          this.routeData.issueTimingCalculations,
          this.routeData.primaryIssueType,
          this.routeData.toIssueType,
        );
      }
    },

    // this all the data pre-compiled
    get rolledupAndRolledBackIssuesAndReleases() {
      if (!this.filteredDerivedIssues || !this.rollupTimingLevelsAndCalculations || !this.routeData.normalizeOptions) {
        return [];
      }

      const when = new Date(new Date().getTime() - this.routeData.compareTo * 1000);

      const rolledUp = rollupAndRollback(
        this.filteredDerivedIssues,
        this.routeData.normalizeOptions,
        this.rollupTimingLevelsAndCalculations,
        when,
      );

      const statuses = calculateReportStatuses(rolledUp, when);

      if (logReportData()) {
        console.log('logReportData: rolledupAndRolledBackIssuesAndReleases', {
          reportType: this.routeData.primaryReportType,
          roundTo: this.routeData.roundTo,
          count: statuses.length,
          issues: statuses.map(projectIssueForLog),
        });
      }

      return statuses;
    },

    get groupedParentDownHierarchy() {
      if (!this.rolledupAndRolledBackIssuesAndReleases || !this.rollupTimingLevelsAndCalculations) {
        return [];
      }
      const groupedHierarchy = groupIssuesByHierarchyLevelOrType(
        this.rolledupAndRolledBackIssuesAndReleases,
        this.rollupTimingLevelsAndCalculations,
      );
      return groupedHierarchy.reverse();
    },

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
    },

    get primaryIssuesOrReleases() {
      if (!this.groupedParentDownHierarchy.length) {
        return [];
      }
      const unfilteredPrimaryIssuesOrReleases = this.groupedParentDownHierarchy[0];

      const hideUnknownInitiatives = this.routeData.hideUnknownInitiatives;
      const filterRows = this.routeData.effectiveFilterRows;

      function startBeforeDue(initiative) {
        return initiative.rollupStatuses.rollup.start < initiative.rollupStatuses.rollup.due;
      }

      // The Scatter Plot ('due' report) only needs a due date to plot a point, so its
      // "no dates" definition is narrower than the legacy `startBeforeDue` rule (which also
      // requires a start date). Gate on that when it's the primary report so a due-only issue
      // isn't hidden by this toggle.
      function hasNoDueDate(initiative) {
        return initiative.rollupStatuses?.rollup?.due == null;
      }
      const isScatterPlot = this.routeData.primaryReportType === 'due';

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

        if (
          hideUnknownInitiatives &&
          (isScatterPlot ? hasNoDueDate(issueOrRelease) : !startBeforeDue(issueOrRelease))
        ) {
          return false;
        }

        if (!matchesAllFilterRows(issueOrRelease, filterRows)) {
          return false;
        }

        return true;
      });

      if (this.routeData.sortByDueDate) {
        return filtered.toSorted((i1, i2) => i1.rollupStatuses.rollup.due - i2.rollupStatuses.rollup.due);
      } else {
        return filtered;
      }
    },
  };
}
