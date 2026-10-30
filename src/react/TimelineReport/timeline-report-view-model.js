import { ObservableObject } from '../../can';

import routeData from '../../canjs/routing/route-data';

import { rollupAndRollback } from '../../jira/rolledup-and-rolledback/rollup-and-rollback';
import { calculateReportStatuses } from '../../jira/rolledup/work-status/work-status';
import {
  ALL_LEVELS,
  filterBeforeRollup,
  filtersApplyBeforeRollup,
  findAncestorAtLevel,
  isLevelFilterActive,
  matchesLevelFilter,
  reportOnLevelKey,
  splitLevels,
} from '../../jira/rollup/filter-rows/level-filters';
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

// Report on and the levels below it are judged by their rolled-up dates; ancestors above Report on
// are never rolled up, so they use their own Jira dates (`derivedTiming`).
const rollupDates = (issueOrRelease) => issueOrRelease.rollupStatuses?.rollup ?? {};

const toISO = (date) => (date instanceof Date && !isNaN(date) ? date.toISOString() : (date ?? null));

/**
 * Slice the timing calculations to the selected From→To range, matching by hierarchy LEVEL rather
 * than by type name. `fromType`/`toType` are the "Report on" and "To" labels, which come from
 * `issueHierarchy` — a hierarchy derived from the *loaded issues*. That label can differ from the
 * issue-type-config label for the same level: a JQL that loads only Risks labels level 0 "Risk",
 * while the config (which `timingCalculations` is built from) calls level 0 "Story". Matching by
 * name silently fails in that case (the primary bucket ends up empty and the report shows
 * "0 issues"); matching by level is robust. `fromType` is the top (primary) level; `toType` caps
 * the descent. When `toType` is absent/unknown (or above From), the range extends to the deepest
 * level. Falls back to name matching when a label isn't present in `issueHierarchy` (e.g. nothing of
 * that type was loaded), preserving prior behavior.
 *
 * @param {Array<{type: string, hierarchyLevel: number}>} timingCalculations top-down config levels
 * @param {string} fromType primary "Report on" label
 * @param {string} [toType] optional "To" cap label
 * @param {Array<{name: string, hierarchyLevel: number}>} [issueHierarchy] data-derived hierarchy
 */
export function getIssueHierarchyUnderType(timingCalculations = [], fromType, toType, issueHierarchy = []) {
  const levelForType = (typeName) => {
    const entry = issueHierarchy.find((h) => h.name === typeName);
    return entry ? entry.hierarchyLevel : undefined;
  };
  const indexForType = (typeName) => {
    const level = levelForType(typeName);
    return level != null
      ? timingCalculations.findIndex((calc) => calc.hierarchyLevel === level)
      : timingCalculations.findIndex((calc) => calc.type === typeName);
  };

  const fromIndex = indexForType(fromType);
  if (fromIndex < 0) return timingCalculations;
  const toIndex = toType ? indexForType(toType) : -1;
  const end = toIndex >= fromIndex ? toIndex + 1 : timingCalculations.length;
  return timingCalculations.slice(fromIndex, end);
}

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

    // `filteredDerivedIssues` minus the issues the Filters panel hides, for the reports that read
    // issues before rollup (Flow Metrics, Time in Status). Rollup still reads the unfiltered list.
    get levelFilteredDerivedIssues() {
      if (!this.filteredDerivedIssues) {
        return this.filteredDerivedIssues;
      }
      return filterBeforeRollup(
        this.filteredDerivedIssues,
        this.routeData.effectiveLevelFilters ?? {},
        this.routeData.issueHierarchy,
      );
    },

    // How many issues the open report has to show, which decides report vs. empty-result. Reports
    // that filter before rollup don't read `primaryIssuesOrReleases`, so its count doesn't apply.
    get reportIssueCount() {
      if (filtersApplyBeforeRollup(this.routeData.primaryReportType)) {
        return this.levelFilteredDerivedIssues?.length ?? 0;
      }
      return this.primaryIssuesOrReleases?.length ?? 0;
    },

    // the timing calculations for the type and below
    // this is telling you how things roll up to you
    get rollupTimingLevelsAndCalculations() {
      if (this.routeData.primaryIssueType === 'Release') {
        if (this.routeData.secondaryIssueType) {
          const secondary = getIssueHierarchyUnderType(
            this.routeData.issueTimingCalculations,
            this.routeData.secondaryIssueType,
            undefined,
            this.routeData.issueHierarchy,
          );
          return [{ type: 'Release', hierarchyLevel: Infinity, calculation: 'childrenOnly' }, ...secondary];
        }
      } else {
        return getIssueHierarchyUnderType(
          this.routeData.issueTimingCalculations,
          this.routeData.primaryIssueType,
          this.routeData.toIssueType,
          this.routeData.issueHierarchy,
        );
      }
    },

    // this all the data pre-compiled
    get rolledupAndRolledBackIssuesAndReleases() {
      if (
        !this.filteredDerivedIssues ||
        !this.rollupTimingLevelsAndCalculations ||
        !this.routeData.normalizeConfiguration
      ) {
        return [];
      }

      const when = new Date(new Date().getTime() - this.routeData.compareTo * 1000);

      const rolledUp = rollupAndRollback(
        this.filteredDerivedIssues,
        this.routeData.normalizeConfiguration,
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

      const levels = this.routeData.effectiveLevelFilters ?? {};
      const allFilter = levels[ALL_LEVELS];
      const reportOnFilter = levels[reportOnLevelKey(this.routeData)];

      // The Scatter Plot ('due' report) only needs a due date to plot a point, so its
      // "no dates" definition is narrower than the legacy `startBeforeDue` rule (which also
      // requires a start date). Gate on that when it's the primary report so a due-only issue
      // isn't hidden by "Hide items without dates".
      const scatter = this.routeData.primaryReportType === 'due';

      // A row is kept only when its ancestor at each filtered level above Report on matches. Those
      // ancestors aren't in the rolled-up list, so they come from `filteredDerivedIssues` (the same
      // fallback `groupIssues.ts` uses for grandparent grouping). A missing ancestor doesn't match.
      const ancestorFilters = splitLevels(this.routeData)
        .above.filter(({ name }) => isLevelFilterActive(levels[name]))
        .map((level) => ({ level, filter: levels[level.name] }));
      const derivedByKey = ancestorFilters.length
        ? new Map((this.filteredDerivedIssues ?? []).map((issue) => [issue.key, issue]))
        : null;

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

        // The due-date range for this level is applied by the reports themselves (Scatter needs the
        // outside-range list), via `effectiveDueDateStart`/`End`.
        const options = { dates: rollupDates(issueOrRelease), scatter, skipDateRange: true };
        if (
          !matchesLevelFilter(issueOrRelease, allFilter, options) ||
          !matchesLevelFilter(issueOrRelease, reportOnFilter, options)
        ) {
          return false;
        }

        return ancestorFilters.every(({ level, filter }) => {
          const ancestor = findAncestorAtLevel(issueOrRelease, derivedByKey, level.hierarchyLevel);
          return !!ancestor && matchesLevelFilter(ancestor, filter, { dates: ancestor.derivedTiming ?? {}, scatter });
        });
      });

      if (this.routeData.sortByDueDate) {
        return filtered.toSorted((i1, i2) => i1.rollupStatuses.rollup.due - i2.rollupStatuses.rollup.due);
      } else {
        return filtered;
      }
    },

    // `rolledupAndRolledBackIssuesAndReleases` minus the issues below Report on that fail All items
    // or their own level's filter. Only hides rows: rollup already ran on the unfiltered list, so
    // parent dates, status and percent complete are unchanged. Reports that render children (Gantt
    // expanded rows, Cards) read this; everything else keeps the unfiltered list.
    get visibleIssuesOrReleases() {
      const issues = this.rolledupAndRolledBackIssuesAndReleases;
      const levels = this.routeData.effectiveLevelFilters ?? {};
      const below = splitLevels(this.routeData).below;
      const anyActive =
        isLevelFilterActive(levels[ALL_LEVELS]) || below.some(({ name }) => isLevelFilterActive(levels[name]));
      if (!anyActive) {
        return issues;
      }

      const belowNameByLevel = new Map(below.map(({ name, hierarchyLevel }) => [hierarchyLevel, name]));
      const scatter = this.routeData.primaryReportType === 'due';
      return issues.filter((issue) => {
        const name = issue.type === 'Release' ? undefined : belowNameByLevel.get(issue.hierarchyLevel);
        if (!name) {
          return true;
        }
        const options = { dates: rollupDates(issue), scatter };
        return (
          matchesLevelFilter(issue, levels[ALL_LEVELS], options) && matchesLevelFilter(issue, levels[name], options)
        );
      });
    },
  };
}
