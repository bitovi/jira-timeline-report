import { ObservableObject, value, type } from '../../../../can';

import {
  rawIssuesRequestData,
  derivedIssuesRequestData,
} from '../../../../canjs/controls/timeline-configuration/state-helpers.js';
import { requiredFieldsFor } from '../../TableReport/model/builtinFieldRegistry';
import { allStatusesSorted } from '../../../../jira/normalized/normalize';
import { getTimingLevels } from '../../../../utils/timing/helpers';
import { issueHierarchyFromNormalizedIssues, toSelectedParts } from '../../../../canjs/routing/data-utils.js';
import { reports as REPORTS } from '../../../../configuration/reports';
import { DAY_IN_MS } from '../../../../utils/date/date-helpers.js';
import { daysBetween } from '../../../../utils/date/days-between.js';
import { isoToLocalDate } from '../../../../utils/date/local.js';
import { roundDate } from '../../../../utils/date/round.js';
import { nowUTC } from '../../../../utils/date/utc';

const _15DAYS_IN_S = (DAY_IN_MS / 1000) * 15;
const ROUND_OPTIONS = ['day', ...Object.keys(roundDate)];

/** True for a well-formed, real calendar `YYYY-MM-DD` string. Mirrors route-data.js. */
function isValidIsoDateString(candidate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
}

// --- parsers, mirroring the converters route-data.js hands to state-storage.js -------------------
//
// Each spec is `{ parse, defaultRaw }` and is always called as `parse(raw ?? defaultRaw)`. That is
// exactly what `makeParamAndReportDataReducer` does when neither the URL nor the report supplies a
// value (`proposeNewSerializedValue(state.defaultValue)`, where `defaultValue` is the *stringified*
// default), so a child and the shell agree on defaults by construction.

const asString = (raw) => '' + raw;

// `{'': true, true: true, false: false}[x]` — an unrecognized value is `undefined`, same as the URL layer.
const asBoolean = (raw) => ({ '': true, true: true, false: false })[raw];

const asList = (raw) => (!raw ? [] : raw.split(','));

const asNumber = (raw) => Number(raw);

// route-data hands `JSON` to state-storage, so a malformed param throws there. A child swallows it
// instead: one bad param must not take down a document that renders several reports.
const asJSON = (fallback) => (raw) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback() : parsed;
  } catch {
    return fallback();
  }
};

const string = (defaultRaw = '') => ({ parse: asString, defaultRaw });
const boolean = (defaultRaw = 'false') => ({ parse: asBoolean, defaultRaw });
const list = (defaultRaw = '') => ({ parse: asList, defaultRaw });
const number = (defaultRaw) => ({ parse: asNumber, defaultRaw });
const json = (defaultValue) => ({
  parse: asJSON(() => structuredClone(defaultValue)),
  defaultRaw: JSON.stringify(defaultValue),
});
const isoDate = () => ({ parse: (raw) => (isValidIsoDateString('' + raw) ? '' + raw : ''), defaultRaw: '' });

/**
 * Every setting an embedded child parses out of its own `queryParams`. Keyed by the property name
 * the reports and the view model read; the URL key is the same in every case.
 *
 * A test asserts this covers every report-aware parameter `RouteData` defines, so adding a setting
 * to route-data.js without adding it here fails the build rather than silently handing every child
 * that setting's default. See spec/016-report-of-reports Phase 2.
 */
const CHILD_PARAMS = {
  // core query
  jql: string(),
  childJQL: string(),
  loadChildren: boolean(),
  primaryReportType: {
    parse: (raw) => (REPORTS.find((report) => report.key === raw) ? '' + raw : REPORTS[0].key),
    defaultRaw: REPORTS[0].key,
  },

  // hierarchy + timing
  timingCalculations: {
    parse: (raw) => {
      if (typeof raw !== 'string' || !raw) {
        return {};
      }
      return raw.split(',').reduce((data, phrase) => {
        const [key, calculation] = phrase.split(':');
        data[key] = calculation;
        return data;
      }, {});
    },
    defaultRaw: '',
  },

  // filtering
  statusesToExclude: list(),
  statusesToShow: list(),
  statusesToRemove: list(),
  planningStatuses: list(),
  releasesToShow: list(),
  filterRows: json([]),
  hideUnknownInitiatives: boolean(),
  showOnlySemverReleases: boolean(),
  sortByDueDate: boolean(),

  // presentation
  compareTo: {
    parse: (raw) => {
      const parsedAsDate = isoToLocalDate(raw);
      if (/^\d+$/.test(raw)) {
        return Number(raw);
      } else if (!isNaN(parsedAsDate)) {
        return (daysBetween(new Date(), parsedAsDate) * DAY_IN_MS) / 1000;
      }
      return _15DAYS_IN_S;
    },
    defaultRaw: '' + _15DAYS_IN_S,
  },
  roundTo: {
    parse: (raw) => (ROUND_OPTIONS.find((option) => option === raw) ? '' + raw : 'day'),
    defaultRaw: 'day',
  },
  primaryReportBreakdown: boolean(),
  showPercentComplete: boolean(),
  uncertaintyWeight: {
    parse: (raw) => {
      if (raw === 'average') {
        return raw;
      }
      const parsed = +raw;
      return isNaN(parsed) ? 'average' : parsed;
    },
    defaultRaw: 'average',
  },
  selectedStartDate: {
    parse: (raw) => (raw ? new Date(raw) : nowUTC()),
    defaultRaw: '',
  },

  groupBy: string(),

  // Table report

  tableColumns: json([{ sourceId: 'identity:treeSummary' }]),
  tableSortColumn: string('identity:treeSummary'),
  tableSortDir: string('tree'),
  tableFilters: json({}),
  tableGroupBy: string(),
  tableGroupByCol: string(),
  tableGroupByGranularity: string(),
  tableGroupByColGranularity: string(),
  tableFieldAxis: string('rows'),
  tableShowRowTotals: boolean(),
  tableShowColTotals: boolean(),

  // Scatter Plot
  scatterDateRangeStart: isoDate(),
  scatterDateRangeEnd: isoDate(),

  // Flow Metrics
  flowMetricsCycleTimeRange: number('30'),
  flowMetricsStatusFilter: list(),
  flowMetricsIssueTypeFilter: list(),
  flowMetricsProjectFilter: list(),
  flowMetricsTeamFilter: list(),

  // Time in Status
  timeInStatusDateRange: number('30'),
  timeInStatusStatusFilter: list(),
  timeInStatusIssueTypeFilter: list(),
  timeInStatusProjectFilter: list(),
  timeInStatusReorder: {
    parse: (raw) => {
      if (!raw) {
        return undefined;
      }
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
    defaultRaw: '',
  },
};

export const CHILD_PARAM_KEYS = Object.keys(CHILD_PARAMS);

/**
 * Settings the child reads out of its own `queryParams` but *not* through {@link CHILD_PARAMS},
 * because they self-heal against the hierarchy its query returned rather than simply parsing. Listed
 * so the drift test can tell "handled further down this file" from "forgotten".
 */
export const AD_HOC_CHILD_PARAM_KEYS = ['selectedIssueType', 'toIssueType'];

/**
 * Report-aware parameters an embedded child deliberately does NOT take from its own `queryParams`.
 * Listed explicitly so the drift test can tell "handled elsewhere" from "forgotten".
 */
export const SHELL_ONLY_PARAM_KEYS = [
  // Settings-sidebar chrome — a page-level concern, not a property of an embedded report.
  'showSettings',
  // Children render no secondary report in v1 (spec/016 "Out of scope").
  'secondaryReportType',
  'secondaryFilterRows',
  'secondaryChildFilterRows',
  // Which saved report the *page* has open. A child is identified by its node in the document tree;
  // it never reads `?report=`.
  'report',
  // Page chrome, like `showSettings`: the whole page goes fullscreen, or opens the modal, not one
  // embedded report.
  'fullscreen',
  'openAutoSchedulerModal',
];

/** Builds a CanJS prop that resolves from `queryParams` but stays settable in memory. */
function childParam(key, { parse, defaultRaw }) {
  return {
    enumerable: true,
    value({ resolve, lastSet, listenTo }) {
      const resolveFromParams = () => {
        const raw = new URLSearchParams(this.queryParams).get(key);
        resolve(parse(raw == null ? defaultRaw : raw));
      };

      listenTo('queryParams', resolveFromParams);
      // An edit made inside the child (a column sort, say) stays in memory. Children render as
      // saved and never write to the page URL — that URL belongs to the composed document.
      listenTo(lastSet, (newValue) => resolve(newValue));

      resolveFromParams();
    },
  };
}

const childParamProps = Object.fromEntries(
  Object.entries(CHILD_PARAMS).map(([key, spec]) => [key, childParam(key, spec)]),
);

/** Mirrors a genuinely global property off the shared parent `routeData`. */
function sharedFromParent(key) {
  return {
    enumerable: false,
    get() {
      return this.parent ? this.parent[key] : undefined;
    },
  };
}

/**
 * The config an embedded child report reads instead of the global `routeData`.
 *
 * Three buckets (see spec/016-report-of-reports Phase 2):
 *
 * - **Per-child** — parsed from that child's saved `queryParams` string. Never from the page URL:
 *   the URL describes the composed document, not any report inside it.
 * - **Shared global** — Jira metadata and team configuration, read straight off the parent
 *   `routeData`. These are the same for every report on the page and are expensive to derive.
 * - **Hybrid** — `issueTimingCalculations` and `allFieldsToRequest`, each of which combines
 *   something global with something per-child and so must be recomputed per child.
 *
 * It then runs its **own** fetch through the same already-parameterized helpers `route-data.js`
 * uses, which is what lets two children with different JQLs show different data on one page.
 */
export class ChildReportConfig extends ObservableObject {
  static props = {
    /** The embedded report's saved `queryParams` string — this child's entire configuration. */
    queryParams: { type: String, default: '' },
    /** The shared `routeData` singleton, injected so this class stays testable. */
    parent: { enumerable: false, default: null },

    ...childParamProps,

    // --- shared global -------------------------------------------------------------------------
    jiraHelpers: sharedFromParent('jiraHelpers'),
    isLoggedInObservable: sharedFromParent('isLoggedInObservable'),
    licensingPromise: sharedFromParent('licensingPromise'),
    normalizeOptions: sharedFromParent('normalizeOptions'),
    simplifiedIssueHierarchy: sharedFromParent('simplifiedIssueHierarchy'),
    fieldsToRequest: sharedFromParent('fieldsToRequest'),
    fieldMaps: sharedFromParent('fieldMaps'),

    // --- hybrid --------------------------------------------------------------------------------

    /**
     * The global hierarchy sliced by THIS child's `timingCalculations`. Treating it as fully global
     * would silently give every child the first child's hierarchy slicing.
     */
    get issueTimingCalculations() {
      if (!this.simplifiedIssueHierarchy || !this.simplifiedIssueHierarchy.length || !this.timingCalculations) {
        return [];
      }

      return getTimingLevels(this.simplifiedIssueHierarchy, this.timingCalculations).map((level) => ({
        type: level.type,
        hierarchyLevel: level.hierarchyLevel,
        calculation: level.calculations.find((calculation) => calculation.selected).calculation,
      }));
    },

    /** Jira fields implied by this child's own Table columns. Mirrors route-data's version. */
    get tableColumnFields() {
      return (this.tableColumns || [])
        .map((entry) => entry && entry.sourceId)
        .filter((sourceId) => typeof sourceId === 'string')
        .flatMap((sourceId) => requiredFieldsFor(sourceId));
    },

    /**
     * The second hybrid: the base field list comes from team configuration (global), but the Table
     * report's shown columns are per-child. A child sharing the parent's list would silently fail to
     * load the fields its own report needs.
     */
    get allFieldsToRequest() {
      const baseFields = this.fieldsToRequest;

      if (!baseFields) {
        return undefined;
      }

      return [...new Set([...baseFields, ...this.tableColumnFields])];
    },

    // --- own fetch -----------------------------------------------------------------------------

    rawIssuesRequestData: {
      enumerable: false,
      value({ listenTo, resolve }) {
        return rawIssuesRequestData(
          {
            jql: value.from(this, 'jql'),
            childJQL: value.from(this, 'childJQL'),
            loadChildren: value.from(this, 'loadChildren'),
            isLoggedIn: this.isLoggedInObservable,
            jiraHelpers: this.jiraHelpers,
            fields: value.from(this, 'allFieldsToRequest'),
          },
          { listenTo, resolve },
        );
      },
    },
    derivedIssuesRequestData: {
      enumerable: false,
      value({ listenTo, resolve }) {
        return derivedIssuesRequestData(
          {
            rawIssuesRequestData: value.from(this, 'rawIssuesRequestData'),
            configurationPromise: value.from(this, 'normalizeOptions'),
            licensingPromise: value.from(this, 'licensingPromise'),
          },
          { listenTo, resolve },
        );
      },
    },
    get derivedIssuesPromise() {
      return this.derivedIssuesRequestData.issuesPromise;
    },
    derivedIssues: {
      enumerable: false,
      value({ listenTo, resolve }) {
        const resolveValueFromPromise = () => {
          resolve(undefined);
          if (this.derivedIssuesRequestData?.issuesPromise) {
            this.derivedIssuesRequestData.issuesPromise.then(resolve);
          }
        };
        listenTo('derivedIssuesRequestData', resolveValueFromPromise);
        resolveValueFromPromise();
      },
    },

    // --- derived from this child's own results ---------------------------------------------------

    get issueHierarchy() {
      return this.derivedIssues && this.derivedIssues.length
        ? issueHierarchyFromNormalizedIssues(this.derivedIssues)
        : this.simplifiedIssueHierarchy;
    },

    /**
     * The From (top) level. Same self-heal as route-data's `selectedIssueType` — validate the saved
     * value against the hierarchy actually returned, else fall back to the highest level — minus
     * the URL write-back, which has no meaning for an embedded child.
     */
    selectedIssueType: {
      enumerable: true,
      value({ resolve, lastSet, listenTo }) {
        const resolveCurrentValue = () => {
          const saved = new URLSearchParams(this.queryParams).get('selectedIssueType') || '';
          const hierarchy = this.issueHierarchy;

          if (!hierarchy || !hierarchy.length) {
            resolve(undefined);
            return;
          }

          if (saved === 'Release') {
            resolve('Release-' + hierarchy[0].name);
            return;
          }

          const parts = saved && toSelectedParts(saved);

          if (parts) {
            const typeToCheck = parts.secondary ?? parts.primary;

            if (hierarchy.some((level) => level.name === typeToCheck)) {
              resolve(saved);
              return;
            }
          }

          resolve(hierarchy[0].name);
        };

        listenTo('queryParams', resolveCurrentValue);
        listenTo('issueHierarchy', resolveCurrentValue);
        listenTo(lastSet, (newValue) => resolve(newValue));

        resolveCurrentValue();
      },
    },
    get primaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).primary;
    },
    get secondaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).secondary;
    },

    /** The optional To (bottom) cap. Absent or invalid means "descend fully". */
    toIssueType: {
      enumerable: true,
      value({ resolve, lastSet, listenTo }) {
        const resolveCurrentValue = () => {
          const hierarchy = this.issueHierarchy;

          if (!hierarchy || !hierarchy.length) {
            resolve(undefined);
            return;
          }

          const deepest = hierarchy[hierarchy.length - 1].name;
          const fromType = this.primaryIssueType;
          const fromIndex = hierarchy.findIndex((level) => level.name === fromType);

          if (fromType === 'Release' || fromIndex === -1) {
            resolve(deepest);
            return;
          }

          const saved = new URLSearchParams(this.queryParams).get('toIssueType') || '';

          if (saved) {
            const toIndex = hierarchy.findIndex((level) => level.name === saved);

            if (toIndex !== -1 && toIndex >= fromIndex) {
              resolve(saved);
              return;
            }
          }

          resolve(deepest);
        };

        listenTo('queryParams', resolveCurrentValue);
        listenTo('issueHierarchy', resolveCurrentValue);
        listenTo('selectedIssueType', resolveCurrentValue);
        listenTo(lastSet, (newValue) => resolve(newValue));

        resolveCurrentValue();
      },
    },

    /**
     * Seeds a `Jira Status` row from the legacy `statusesToShow`/`statusesToRemove` params when
     * `filterRows` is empty, exactly as route-data does. Without it, an older saved report embedded
     * as a child silently loses its status filter.
     */
    get effectiveFilterRows() {
      if (this.filterRows && this.filterRows.length) {
        return this.filterRows;
      }
      if (this.statusesToShow && this.statusesToShow.length) {
        return [{ id: 'legacy-statuses-to-show', field: 'jiraStatus', operator: 'is', value: this.statusesToShow }];
      }
      if (this.statusesToRemove && this.statusesToRemove.length) {
        return [
          { id: 'legacy-statuses-to-remove', field: 'jiraStatus', operator: 'is not', value: this.statusesToRemove },
        ];
      }
      return [];
    },

    /** Reports read this off routeData to decide whether a status list is available. */
    get allStatusesSorted() {
      return this.derivedIssues ? allStatusesSorted(this.derivedIssues) : [];
    },

    // Present so a report reaching for it on a child behaves as it does with no saved report open,
    // rather than throwing. A child is never itself a saved report being edited.
    reportData: { enumerable: false, default: undefined },
    '*': type.Any,
  };
}

export default ChildReportConfig;
