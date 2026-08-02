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

// --- serializers, the inverse of the parsers above -----------------------------------------------
//
// New to a child, which has only ever *read* its configuration — but not new to the app:
// route-data.js round-trips every one of these keys through the URL today, so each of these is a
// port of the converter it already hands `state-storage.js`. They exist so an edit made *inside* an
// embedded report can be captured back onto its node in the document.
// See spec/016-report-of-reports/006-url-state Phase 2.

const fromString = (value) => '' + value;

// Ports `makeArrayOfStringsQueryParamValueButAlsoLookAtReportData`, unescaped comma and all: a
// status name containing a `,` round-trips as two values. Pre-existing and shared with every list
// param in the app (state-storage.js:320 says so) — not something to diverge on here.
const fromList = (value) => {
  if (!value) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(',');
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
};

const string = (defaultRaw = '') => ({ parse: asString, stringify: fromString, defaultRaw });
const boolean = (defaultRaw = 'false') => ({ parse: asBoolean, stringify: fromString, defaultRaw });
const list = (defaultRaw = '') => ({ parse: asList, stringify: fromList, defaultRaw });
const number = (defaultRaw) => ({ parse: asNumber, stringify: fromString, defaultRaw });
const json = (defaultValue) => ({
  parse: asJSON(() => structuredClone(defaultValue)),
  stringify: JSON.stringify,
  defaultRaw: JSON.stringify(defaultValue),
});
const isoDate = () => ({
  parse: (raw) => (isValidIsoDateString('' + raw) ? '' + raw : ''),
  stringify: fromString,
  defaultRaw: '',
});

/**
 * Every setting an embedded child parses out of its own `queryParams`. Keyed by the property name
 * the reports and the view model read; the URL key is the same in every case.
 *
 * A test asserts this covers every report-aware parameter `RouteData` defines, so adding a setting
 * to route-data.js without adding it here fails the build rather than silently handing every child
 * that setting's default. See spec/016-report-of-reports Phase 2.
 *
 * Exported for `childParams.js`'s `parseChildQuery`, which lets the *document* ask "what query does
 * this saved report run?" without building a config. There must be exactly one parser: if the
 * document parsed a child's query differently from how the child parses it, request-dedupe groups
 * would be computed off the wrong values and split, with nothing thrown and nothing rendered wrong.
 * See spec/016-report-of-reports/005-optimize/001-request-dedupe Phase 0.
 */
export const CHILD_PARAMS = {
  // core query
  jql: string(),
  childJQL: string(),
  loadChildren: boolean(),
  primaryReportType: {
    parse: (raw) => (REPORTS.find((report) => report.key === raw) ? '' + raw : REPORTS[0].key),
    stringify: fromString,
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
    // Re-emits in the object's insertion order, which needn't match the order the saved string had.
    // That is why an override is compared against the *canonicalized* saved value rather than the
    // raw one — see `childOverrideValue` in childParams.js.
    stringify: (value) =>
      Object.keys(value)
        .map((key) => key + ':' + value[key])
        .join(','),
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
    // Lossy by construction — see NON_OVERRIDABLE_CHILD_PARAM_KEYS, which keeps it out of the
    // override mechanism. route-data's version has a `value instanceof Date` branch above this one
    // that references an undeclared `date` and would throw a ReferenceError; it is dead there (the
    // value is always a number by then) and deliberately not reproduced here.
    stringify: fromString,
    defaultRaw: '' + _15DAYS_IN_S,
  },
  roundTo: {
    parse: (raw) => (ROUND_OPTIONS.find((option) => option === raw) ? '' + raw : 'day'),
    stringify: fromString,
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
    stringify: fromString,
    defaultRaw: 'average',
  },
  selectedStartDate: {
    parse: (raw) => (raw ? new Date(raw) : nowUTC()),
    stringify: (value) => (value ? value.toISOString() : nowUTC().toISOString()),
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
    stringify: (value) => (value ? JSON.stringify(value) : ''),
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
 * `stringify` for the {@link AD_HOC_CHILD_PARAM_KEYS}. Both are plain strings in the URL, so both
 * invert trivially — but they are not in {@link CHILD_PARAMS}, so a table built over that object
 * alone would silently miss them, and a missing serializer means an edit that vanishes on refresh
 * rather than an error. Nothing writes them from inside a report today (`SelectIssueType` is shell
 * chrome, which `ReportControls` hides for a document), so this is a guard, not a live path.
 */
const AD_HOC_CHILD_PARAM_STRINGIFY = {
  selectedIssueType: fromString,
  toIssueType: fromString,
};

/**
 * Settings an embedded child may change in memory but never records as an override.
 *
 * `compareTo`'s parse collapses `compareTo=2026-06-01` into "how many seconds ago is that",
 * computed against `new Date()` — the date string is unrecoverable. Writing the result back would
 * silently rewrite a *fixed date* as a *relative offset that drifts every day*, and `compareToType`
 * reads the raw URL to decide which of the two the user is shown. Excluded until that pair is
 * modelled properly. See spec/016-report-of-reports/006-url-state Phase 2.
 */
export const NON_OVERRIDABLE_CHILD_PARAM_KEYS = ['compareTo'];

/**
 * A child's in-memory value as the query-string fragment that would produce it, or `undefined` to
 * mean "no value — remove the key".
 *
 * `undefined` is never the string `"undefined"`: `asBoolean` returns it for an unrecognized value by
 * design, and `timeInStatusReorder` returns it deliberately. `route-data.js` sets the same
 * precedent with `value ? JSON.stringify(value) : ''`.
 */
export function serializeChildParam(key, value) {
  if (value === undefined) {
    return undefined;
  }

  const spec = CHILD_PARAMS[key];
  const stringify = spec ? spec.stringify : AD_HOC_CHILD_PARAM_STRINGIFY[key];

  if (!stringify) {
    // Unreachable while the drift test holds — it fails the build for a spec with no `stringify`.
    console.error(`No stringify for child param "${key}"; the change will not survive a refresh.`);
    return undefined;
  }

  return stringify(value);
}

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
  const overridable = !NON_OVERRIDABLE_CHILD_PARAM_KEYS.includes(key);

  return {
    enumerable: true,
    value({ resolve, lastSet, listenTo }) {
      const resolveFromParams = () => {
        const raw = new URLSearchParams(this.queryParams).get(key);
        resolve(parse(raw == null ? defaultRaw : raw));
      };

      listenTo('queryParams', resolveFromParams);
      // An edit made inside the child (a column sort, say) resolves in memory and is announced
      // upward, so the document can record it on this child's node and put it in the page URL.
      // Only a *set* announces: a `queryParams` resolve is the document telling us, not us telling
      // the document, and echoing it back would be a loop.
      // See spec/016-report-of-reports/006-url-state Phase 2.
      listenTo(lastSet, (newValue) => {
        resolve(newValue);

        if (overridable && this.onParamChange) {
          this.onParamChange(key, serializeChildParam(key, newValue));
        }
      });

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
    /**
     * The wider field list this child should LOAD, when the document found other embedded reports
     * asking Jira the same question — the union of what that group between them needs, so all of them
     * send identical requests and `getRawIssues` collapses them onto one fetch. `null` outside a
     * document, or for a report whose query nothing else shares.
     *
     * See spec/016-report-of-reports/005-optimize/001-request-dedupe Phase 1 and `childQueryGroups`.
     */
    tableColumnFieldsOverride: { enumerable: false, default: null },
    /**
     * Called `(key, serialized)` when something inside the report writes one of this child's
     * settings — `serialized` being `undefined` for "no value". The document uses it to record the
     * change as an override on this child's node, which puts it in the page URL and saves with the
     * report. Absent everywhere else, so nothing outside a document changes behaviour.
     * See spec/016-report-of-reports/006-url-state Phase 2.
     */
    onParamChange: { enumerable: false, type: type.Any, default: null },

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

    /**
     * Jira fields implied by this child's own Table columns. Mirrors route-data's version, except
     * that a document can widen it — see {@link tableColumnFieldsOverride}.
     *
     * **`tableColumns` itself is never overridden.** The report renders exactly the columns it was
     * saved with (plus whatever the document has recorded on its node); only what gets loaded
     * widens. Override the load, never the view.
     *
     * The union is computed from the child's *effective* `queryParams`, so a column change made
     * inside the report is recorded as a node override and the union recomputes from it
     * (spec/016-report-of-reports/006-url-state Phase 3). What still isn't reconciled is a change
     * that never reaches the node: a key with no serializer, or one this config declines to record.
     * A column added that way would render empty, because its field was never requested.
     */
    get tableColumnFields() {
      if (this.tableColumnFieldsOverride) {
        return [...this.tableColumnFieldsOverride];
      }

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
        listenTo(lastSet, (newValue) => {
          resolve(newValue);
          this.onParamChange?.('selectedIssueType', serializeChildParam('selectedIssueType', newValue));
        });

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
        listenTo(lastSet, (newValue) => {
          resolve(newValue);
          this.onParamChange?.('toIssueType', serializeChildParam('toIssueType', newValue));
        });

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
