import { ObservableObject, value, diff, type } from '../../../can.js';

import { DAY_IN_MS } from '../../../utils/date/date-helpers.js';
import { daysBetween } from '../../../utils/date/days-between.js';
import { isoToLocalDate } from '../../../utils/date/local.js';

import { allStatusesSorted } from '../../../jira/normalized/normalize.ts';
import { bitoviTrainingFields } from '../../../examples/bitovi-training.js';
import { requiredFieldsFor } from '../../../react/reports/TableReport/model/builtinFieldRegistry.ts';
import { deriveFieldMaps } from '../../../jira-oidc-helpers/fields.ts';
import { CORE_FIELDS } from '../../../stateful-data/jira-data-requests.js';
import { sameRequestedFields } from './requested-fields.ts';

import {
  rawIssuesRequestData,
  configurationPromise,
  derivedIssuesRequestData,
  serverInfoPromise,
} from '../../controls/timeline-configuration/state-helpers.js';

import {
  saveJSONToUrl,
  // saveJSONToUrlButAlsoLookAtReportData_LongForm,
  saveJSONToUrlButAlsoLookAtReport_DataWrapper,
  updateUrlParam,
  makeArrayOfStringsQueryParamValueButAlsoLookAtReportData,
  pushStateObservable,
  paramValue,
  getUrlParamValue,
  makeParamAndReportDataReducer,
  listenToReportDataChanged,
  listenToUrlChange,
} from '../state-storage.js';

import { roundDate } from '../../../utils/date/round.js';

const ROUND_OPTIONS = ['day', ...Object.keys(roundDate)];

import {
  getAllTeamData,
  createFullyInheritedConfig,
  createTeamFieldLookup,
} from '../../../react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration';

import { createNormalizeConfiguration } from '../../../react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize';

import { getSimplifiedIssueHierarchy } from '../../../stateful-data/jira-data-requests.js';
import {
  issueHierarchyFromNormalizedIssues,
  makeAsyncFromObservableButStillSettableProperty,
  toSelectedParts,
} from '../data-utils.js';
import { getTimingLevels } from '../../../utils/timing/helpers';
import { getAllReports } from '../../../jira/reports/fetcher';
import { reportKeys } from '../../../react/services/reports';
import { queryClient } from '../../../react/services/query/queryClient';
import { nowUTC } from '../../../utils/date/utc';

const _15DAYS_IN_S = (DAY_IN_MS / 1000) * 15;

/** True for a well-formed, real calendar `YYYY-MM-DD` string (rejects e.g. "2025-13-40"). */
function isValidIsoDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
}

const booleanParsing = {
  parse: (x) => {
    return { '': true, true: true, false: false }[x];
  },
  stringify: (x) => '' + x,
};

import { reports } from '../../../configuration/reports';

export const REPORTS = reports.map((report) => {
  return {
    key: report.key,
    name: report.name,
  };
});

export class RouteData extends ObservableObject {
  static props = {
    // passed values
    licensingPromise: {
      enumerable: false,
      default: null,
    },
    jiraHelpers: {
      enumerable: false,
      default: null,
    },
    isLoggedInObservable: {
      enumerable: false,
      default: null,
    },
    storage: {
      enumerable: false,
      default: null,
    },

    // static requests
    jiraFieldsPromise: {
      get default() {
        if (this.isLoggedInObservable.value) {
          return this.jiraHelpers.fetchJiraFields();
        } else {
          return bitoviTrainingFields();
        }
      },
      enumerable: false,
    },
    // Resolved Jira field name<->id maps (from `jiraFieldsPromise`). Used only to canonicalize the
    // requested-field comparison in `allFieldsToRequest` (spec/012 column-source-registry.md §6);
    // stays `undefined` until the field list loads, in which case the comparison falls back to a
    // plain id-space diff.
    fieldMaps: {
      value({ resolve, listenTo }) {
        const update = (fields) => {
          if (fields) resolve(deriveFieldMaps(fields));
        };
        listenTo('jiraFieldsPromise', ({ value }) => {
          Promise.resolve(value).then(update);
        });
        Promise.resolve(this.jiraFieldsPromise).then(update);
      },
      enumerable: false,
    },
    report: saveJSONToUrl('report', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    reportsData: {
      type: Object,
      set(value) {
        return value;
      },
      enumerable: false,
    },
    get reportData() {
      if (this.report && this.reportsData) {
        return this.reportsData[this.report];
      }
    },
    get allTeamDataPromise() {
      return getAllTeamData(this.storage);
    },
    get simplifiedIssueHierarchyPromise() {
      return getSimplifiedIssueHierarchy({
        jiraHelpers: this.jiraHelpers,
        isLoggedIn: this.isLoggedInObservable.value,
      });
    },
    /**
     * simplifiedIssueHierarchy is an array of issues that represents the hierarchy levels
     */
    simplifiedIssueHierarchy: {
      async(resolve) {
        return this.simplifiedIssueHierarchyPromise;
      },
    },
    get issueTimingCalculations() {
      if (!this.simplifiedIssueHierarchy || !this.timingCalculations) {
        return [];
      } else {
        const allLevels = getTimingLevels(this.simplifiedIssueHierarchy, this.timingCalculations);

        return allLevels.map((level) => {
          return {
            type: level.type,
            hierarchyLevel: level.hierarchyLevel,
            calculation: level.calculations.find((level) => level.selected).calculation,
          };
        });
      }
    },

    // PURE ROUTES
    uncertaintyWeight: saveJSONToUrlButAlsoLookAtReport_DataWrapper('uncertaintyWeight', 'average', type.Any, {
      parse: (param) => {
        if (param === 'average') {
          return param;
        }

        const parsed = +param;

        if (isNaN(parsed)) {
          return 'average';
        }

        return parsed;
      },
      stringify: (value) => {
        return value.toString();
      },
    }),
    selectedStartDate: saveJSONToUrlButAlsoLookAtReport_DataWrapper('selectedStartDate', nowUTC(), String, {
      parse: (dateString) => {
        if (!dateString) {
          return nowUTC();
        }

        return new Date(dateString);
      },
      stringify: (date) => {
        if (!date) {
          return nowUTC().toISOString();
        }

        return date.toISOString();
      },
    }),
    showSettings: saveJSONToUrlButAlsoLookAtReport_DataWrapper('settings', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    jql: saveJSONToUrlButAlsoLookAtReport_DataWrapper('jql', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    loadChildren: saveJSONToUrlButAlsoLookAtReport_DataWrapper('loadChildren', false, Boolean, booleanParsing),
    childJQL: saveJSONToUrlButAlsoLookAtReport_DataWrapper('childJQL', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),

    roundTo: saveJSONToUrlButAlsoLookAtReport_DataWrapper('roundTo', 'day', String, {
      parse: function (x) {
        if (ROUND_OPTIONS.find((key) => key === x)) {
          return x;
        } else {
          return 'day';
        }
      },
      stringify: (x) => '' + x,
    }),

    statusesToExclude: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('statusesToExclude'),

    // this is always in seconds
    compareTo: saveJSONToUrlButAlsoLookAtReport_DataWrapper('compareTo', _15DAYS_IN_S, undefined, {
      parse(string) {
        const parsedAsDate = isoToLocalDate(string);
        if (/^\d+$/.test(string)) {
          return Number(string);
        } else if (!isNaN(parsedAsDate)) {
          // parsedAsDate is 2025-01-18 to a UTC "date"
          // want to know how many days that was in the past compare to someone's timeframe right now
          return (daysBetween(new Date(), parsedAsDate) * DAY_IN_MS) / 1000;
        } else {
          return _15DAYS_IN_S;
        }
      },
      stringify(number) {
        // assume the date is in UTC?
        if (number instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        return '' + number;
      },
    }),
    // returns "seconds" or "date"
    // duplicates some code above. We should refactor at some point
    get compareToType() {
      // just for the side effects:
      pushStateObservable.value;
      // we probably should make the pushstate observable go into new URL()
      const string = new URL(window.location).searchParams.get('compareTo') || '';
      const parsedAsDate = isoToLocalDate(string);
      if (/^\d+$/.test(string)) {
        return 'seconds';
      } else if (!isNaN(parsedAsDate)) {
        return 'date';
      } else {
        return 'seconds';
      }
    },

    // DERIVED
    rawIssuesRequestData: {
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
    get serverInfoPromise() {
      return serverInfoPromise({
        jiraHelpers: this.jiraHelpers,
        isLoggedIn: this.isLoggedInObservable,
      });
    },
    get fullyInheritedTeamConfigPromise() {
      return Promise.all([this.jiraFieldsPromise, this.allTeamDataPromise, this.simplifiedIssueHierarchyPromise]).then(
        ([jiraFields, teamData, hierarchyLevels]) => {
          const allTeamData = createFullyInheritedConfig(
            teamData,
            jiraFields,
            hierarchyLevels.map((type) => type.hierarchyLevel.toString()),
          );

          return allTeamData;
        },
      );
    },
    get teamFieldLookUp() {
      return this.fullyInheritedTeamConfigPromise.then((allTeamData) => {
        const fieldLookup = createTeamFieldLookup(allTeamData);

        window.fieldLookup = fieldLookup;

        return fieldLookup;
      });
    },
    // normalize options without the server info
    get baseNormalizeOptionsAndFieldsToRequestPromise() {
      return this.fullyInheritedTeamConfigPromise
        .then((allTeamData) => {
          const normalizedConfig = createNormalizeConfiguration(allTeamData);

          return normalizedConfig;
        })
        .catch((e) => {
          // Could fail because storage hasn't been setup yet
          console.warn('could not have team data', e);
          return {};
        })
        .then(({ fields, ...baseNormalizeOptions }) => {
          return { fields, baseNormalizeOptions };
        });
    },

    get baseNormalizeOptionsPromise() {
      return this.baseNormalizeOptionsAndFieldsToRequestPromise.then(
        ({ baseNormalizeOptions }) => baseNormalizeOptions,
      );
    },
    baseNormalizeOptions: {
      async() {
        return this.baseNormalizeOptionsPromise;
      },
    },
    get fieldsToRequestPromise() {
      return this.baseNormalizeOptionsAndFieldsToRequestPromise.then(({ fields }) => fields);
    },
    get normalizeOptionsPromise() {
      return configurationPromise({
        serverInfoPromise: this.serverInfoPromise,
        normalizeObservable: value.from(this, 'baseNormalizeOptions'),
      });
    },

    // THESE are settable by react
    // This was using
    //
    // but we don't want the fields to change until they REALLY changed
    fieldsToRequest:
      // makeAsyncFromObservableButStillSettableProperty('fieldsToRequestPromise'),

      {
        value({ resolve, listenTo, lastSet }) {
          let current = [];
          function resolveIfChanges(newValue) {
            if (diff.list(newValue, current).length) {
              current = newValue;
              resolve(current);
            }
          }
          listenTo('fieldsToRequestPromise', ({ value }) => {
            value.then(resolveIfChanges);
          });
          if (this.fieldsToRequestPromise) {
            this.fieldsToRequestPromise.then(resolveIfChanges);
          }
          listenTo(lastSet, (value) => {
            resolveIfChanges(value);
          });
        },
      },

    // Jira field identifiers implied by the Table report's shown columns (spec/012 issues-plan #2,
    // column-source-registry.md). Each `tableColumns` entry is `{ sourceId }`; `requiredFieldsFor`
    // (the pure built-in registry) maps it to the Jira field **ids** that column needs LOADED:
    // `field:<id>` -> that id; `builtin:*`/`rollup:*` -> the facet's declared `requires` (often none,
    // e.g. Project Key derives from the issue key so it loads nothing); identity/estimation -> none.
    // Reading `this.tableColumns` here makes column changes auto-refetch, so `tableColumns` stays the
    // single source of truth (no parallel `fields` write, removals prune, derived columns are free).
    get tableColumnFields() {
      const columns = this.tableColumns || [];
      return columns
        .map((entry) => entry && entry.sourceId)
        .filter((sourceId) => typeof sourceId === 'string')
        .flatMap((sourceId) => requiredFieldsFor(sourceId));
    },

    // Computed property that combines the base fields, the URL `fields` param (legacy Grouper
    // "Additional Fields"), and the Table report's shown-column fields.
    //
    // Only emits when the requested field set REALLY changes, so a full issue refetch is avoided
    // when a column change doesn't alter what must be loaded. Two guards:
    //   1. `diff.list`-style: a new (content-identical) array — e.g. `tableColumns` re-parsed on an
    //      unrelated URL change — doesn't re-emit.
    //   2. canonical id set incl. `CORE_FIELDS`: adding/removing a column whose field is already
    //      always-loaded (Status, Parent, Labels, …) is a no-op. Names and ids are collapsed to one
    //      id space via `fieldMaps`, so `field:status` (id) matches the core `Status` (name). Until
    //      the maps load, this falls back to a plain id-space comparison.
    // The resolved VALUE stays the raw union (unchanged request payload) — `getRawIssues` still adds
    // `CORE_FIELDS` — we only gate WHEN it emits.
    allFieldsToRequest: {
      value({ resolve, listenTo }) {
        let current;
        let resolved = false;
        const recompute = () => {
          const baseFields = this.fieldsToRequest;
          const urlFields = this.fields;
          const next =
            baseFields && urlFields
              ? [...new Set([...baseFields, ...urlFields, ...this.tableColumnFields])]
              : undefined;
          let changed;
          if (!resolved || (next === undefined) !== (current === undefined)) {
            changed = true;
          } else if (next && current) {
            changed = !sameRequestedFields(next, current, CORE_FIELDS, this.fieldMaps);
          } else {
            changed = false;
          }
          if (changed) {
            current = next;
            resolved = true;
            resolve(current);
          }
        };
        listenTo('fieldsToRequest', recompute);
        listenTo('fields', recompute);
        listenTo('tableColumnFields', recompute);
        listenTo('fieldMaps', recompute);
        recompute();
      },
    },

    // This can get set, but needs some base loaded normalize option
    normalizeOptions: makeAsyncFromObservableButStillSettableProperty('normalizeOptionsPromise'),

    derivedIssuesRequestData: {
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
      // this can't use async b/c we need the value to turn to undefined
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
    get allStatusesSorted() {
      if (this.derivedIssues) {
        return allStatusesSorted(this.derivedIssues);
      } else {
        return [];
      }
    },
    /*makeParamAndReportDataReducer({
      key: "timingCalculations",
      parse(value){
        let phrases = value.split(",");
        const data = {};
        for (let phrase of phrases) {
          const parts = phrase.split(":");
          data[parts[0]] = parts[1];
        }
        return data;
      },
      stringify(obj) {
        return Object.keys(obj || {})
            .map((key) => key + ":" + obj[key])
            .join(",");
      },
      checkIfChanged(newValue, currentValue) {
        if(!Array.isArray(currentValue)) {
          return true;
        } else if (diff.map(newValue, currentValue).length) {
          return true;
        }
      }
    }),*/

    /**
     * A string like "[HIERARCHY-TYPE]:[CALCULATION],[HIERARCHY-TYPE]:[CALCULATION]"
     */
    timingCalculations:
      // the following was an alternative timing calculation implementation
      // we might want this if we see a bug toggling percentages completion
      {
        enumerable: true,
        value({ resolve, lastSet, listenTo }) {
          //console.log("timingCalculations value init")
          var currentValue = undefined;
          function parse(value) {
            let phrases = value.split(',');
            const data = {};
            for (let phrase of phrases) {
              const parts = phrase.split(':');
              data[parts[0]] = parts[1];
            }
            return data;
          }
          function stringify(obj) {
            return Object.keys(obj)
              .map((key) => key + ':' + obj[key])
              .join(',');
          }

          const resolveValue = () => {
            const urlParamValue = getUrlParamValue('timingCalculations');
            const reportParamValue = this.reportData && paramValue(this.reportData, 'timingCalculations');

            if (urlParamValue != null) {
              parseAndResolve(urlParamValue);
            } else if (reportParamValue != null) {
              parseAndResolve(reportParamValue);
            } else {
              parseAndResolve({});
            }
          };
          // breaks if both are active
          // seeming works if just reportData
          listenTo('reportData', resolveValue);
          listenTo(pushStateObservable, resolveValue);
          resolveValue();

          listenTo(lastSet, (value) => {
            let defaultValue = this.reportData ? paramValue(this.reportData, 'timingCalculations') : stringify([]);
            updateUrlParam('timingCalculations', stringify(value), defaultValue);
          });

          function parseAndResolve(value) {
            if (typeof value === 'string') {
              try {
                value = parse(value);
              } catch (e) {
                value = {};
              }
            } else {
              value = {};
            }
            if (typeof currentValue !== typeof value) {
              //console.log("timingCalculations resolve", value, currentValue)
              currentValue = value;
              resolve(currentValue);
            } else if (diff.map(value, currentValue).length) {
              //console.log("timingCalculations resolve", value, currentValue)
              currentValue = value;
              resolve(currentValue);
            } else {
              //console.log("timingCalculations no-resolve")
            }
          }
        },
      },

    primaryReportType: saveJSONToUrlButAlsoLookAtReport_DataWrapper('primaryReportType', REPORTS[0].key, String, {
      parse: function (x) {
        if (REPORTS.find((report) => report.key === x)) {
          return x;
        } else {
          return REPORTS[0].key; // default to the first report
        }
      },
      stringify: (x) => '' + x,
    }),
    reports: {
      get default() {
        return REPORTS;
      },
      enumerable: false,
    },

    get issueHierarchy() {
      // temporarily removing picking the "nice" name. We will try to bring this back later.
      //return this.simplifiedIssueHierarchy;

      return this.derivedIssues && this.derivedIssues.length
        ? issueHierarchyFromNormalizedIssues(this.derivedIssues)
        : this.simplifiedIssueHierarchy;
    },
    selectedIssueType: {
      enumerable: true,
      value({ resolve, lastSet, listenTo }) {
        let reportDataParam;
        let urlParam;
        let resolveCurrentValue;

        // bind to stuff ... but we don't want to respond to change just yet
        listenToReportDataChanged(this, 'selectedIssueType', listenTo, (param) => {
          reportDataParam = param;
          resolveCurrentValue && resolveCurrentValue();
        });

        listenToUrlChange('selectedIssueType', listenTo, (param) => {
          urlParam = param;
          resolveCurrentValue && resolveCurrentValue();
        });

        listenTo('issueHierarchy', ({ value }) => {
          resolveCurrentValue && resolveCurrentValue();
        });

        function getParamValue() {
          if (urlParam != null) {
            return urlParam;
          } else if (reportDataParam != null) {
            return reportDataParam;
          } else {
            return '';
          }
        }

        let timers = [];
        function clearTimers() {
          timers.forEach((value) => clearTimeout(value));
          timers = [];
        }

        // Writes the selected type to the URL the same way a manual selection does:
        // omits the param when it matches the saved report's value (keeps the URL clean
        // while the report still provides it), otherwise writes it explicitly.
        const writeUrlParam = (value) => {
          const param = this.reportData && paramValue(this.reportData, 'selectedIssueType');
          updateUrlParam('selectedIssueType', value, param || '');
        };

        // anything happens in state, update the route
        // the route updates, update the state (or the route if it's wrong)
        resolveCurrentValue = () => {
          clearTimers();

          // Don't resolve anything until derivedIssues are loaded. Both defaulting
          // and validation must use the real issue hierarchy — not the Jira metadata
          // hierarchy (simplifiedIssueHierarchy), which may include levels (e.g. Outcomes)
          // that aren't present in the actual query results.
          if (!(this.derivedIssues && this.derivedIssues.length)) {
            return;
          }

          // we wait to resolve to a defined value until we can check it's right
          if (this.issueHierarchy && this.issueHierarchy.length) {
            const curParamValue = getParamValue();

            // helps with legacy support to pick the first type
            if (curParamValue === 'Release') {
              resolve('Release-' + this.issueHierarchy[0].name);
            } else {
              const curSelectedParts = toSelectedParts(curParamValue);

              if (curSelectedParts) {
                // check it's ok
                let typeToCheck = curSelectedParts.secondary ?? curSelectedParts.primary;

                if (this.issueHierarchy.some((issue) => issue.name === typeToCheck)) {
                  resolve(curParamValue);
                }
                // The stored value (URL param or saved report) names a level that isn't
                // present in the returned results. Default to the highest available level
                // and persist it to the URL so the selection stays consistent on reload,
                // share, and when the hierarchy changes (e.g. switching issue sources).
                else {
                  const defaultType = this.issueHierarchy[0].name;
                  resolve(defaultType);
                  writeUrlParam(defaultType);
                }
              } else {
                // No stored value — default to the highest level present in the results
                // and persist it to the URL.
                const defaultType = this.issueHierarchy[0].name;
                resolve(defaultType);
                writeUrlParam(defaultType);
              }
            }
          } else {
            resolve(undefined);
          }
        };

        listenTo(lastSet, (value) => {
          writeUrlParam(value);
        });

        resolveCurrentValue();
      },
      /*
      value({ resolve, lastSet, listenTo }) {
        function getParamValue() {
          return new URL(window.location).searchParams.get("selectedIssueType") || "";
        }
        let timers = [];
        function clearTimers() {
          timers.forEach((value) => clearTimeout(value));
          timers = [];
        }

        // anything happens in state, update the route
        // the route updates, update the state (or the route if it's wrong)
        const resolveCurrentValue = () => {
          clearTimers();
          const curParamValue = getParamValue();

          // we wait to resolve to a defined value until we can check it's right
          if (this.issueHierarchy && this.issueHierarchy.length) {
            const curParamValue = getParamValue();

            // helps with legacy support to pick the first type
            if (curParamValue === "Release") {
              resolve("Release-" + this.issueHierarchy[0].name);
            } else {
              const curSelectedParts = toSelectedParts(curParamValue);
              //const lastSelectedParts = toSelectedParts(lastSelectedValue);

              if (curSelectedParts) {
                // check it's ok
                let typeToCheck = curSelectedParts.secondary ?? curSelectedParts.primary;

                if (this.issueHierarchy.some((issue) => issue.name === typeToCheck)) {
                  // make sure we actually need to update
                  resolve(curParamValue);
                }
                // set back to default
                else {
                  timers.push(
                    setTimeout(() => {
                      updateUrlParam("selectedIssueType", "", "");
                    }, 20)
                  );
                }
              } else {
                // default to the first type
                resolve(this.issueHierarchy[0].name);
              }
            }
          } else {
            resolve(undefined);
          }
        };

        // when the route changes, check stuff ...
        listenTo(pushStateObservable, () => {
          resolveCurrentValue();
        });

        listenTo("issueHierarchy", ({ value }) => {
          resolveCurrentValue();
        });

        listenTo(lastSet, (value) => {
          console.log("LAST SET sit", value);
          updateUrlParam("selectedIssueType", value, "");
        });

        resolveCurrentValue();
      },*/
    },
    get primaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).primary;
    },
    get secondaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).secondary;
    },

    // The "To" (bottom) cap of the From→To hierarchy range. `selectedIssueType`/`primaryIssueType`
    // is the "From" (top, required, self-healing) level; this is the optional bottom cap.
    //
    // Unlike `selectedIssueType`, this is TRULY OPTIONAL: when absent (or invalid) it resolves to
    // the deepest level present in the results ("full hierarchy" = today's behavior) but does NOT
    // write itself back to the URL. Only an explicit user selection persists. That keeps clearing
    // the cap ("Show full hierarchy") from re-adding the param, while `selectedIssueType` keeps its
    // required-level self-heal.
    toIssueType: {
      enumerable: true,
      value({ resolve, lastSet, listenTo }) {
        let reportDataParam;
        let urlParam;
        let resolveCurrentValue;

        listenToReportDataChanged(this, 'toIssueType', listenTo, (param) => {
          reportDataParam = param;
          resolveCurrentValue && resolveCurrentValue();
        });

        listenToUrlChange('toIssueType', listenTo, (param) => {
          urlParam = param;
          resolveCurrentValue && resolveCurrentValue();
        });

        listenTo('issueHierarchy', () => {
          resolveCurrentValue && resolveCurrentValue();
        });

        // Re-clamp when the "From" level changes (a To above the new From is invalid).
        listenTo('selectedIssueType', () => {
          resolveCurrentValue && resolveCurrentValue();
        });

        function getParamValue() {
          if (urlParam != null) {
            return urlParam;
          } else if (reportDataParam != null) {
            return reportDataParam;
          } else {
            return '';
          }
        }

        // Persist the cap the same way a manual selection does: omit the param when it matches the
        // saved report's value (keeps the URL clean), otherwise write it explicitly.
        const writeUrlParam = (value) => {
          const param = this.reportData && paramValue(this.reportData, 'toIssueType');
          updateUrlParam('toIssueType', value || '', param || '');
        };

        resolveCurrentValue = () => {
          // Wait for derivedIssues before defaulting/validating — same reasoning as
          // selectedIssueType: use the real results-based hierarchy, not Jira metadata.
          if (!(this.derivedIssues && this.derivedIssues.length)) {
            return;
          }

          const hierarchy = this.issueHierarchy;
          if (!(hierarchy && hierarchy.length)) {
            resolve(undefined);
            return;
          }

          // issueHierarchy is ordered top→bottom, so the last entry is the deepest level =
          // "full hierarchy" (the default, absent-cap behavior).
          const deepest = hierarchy[hierarchy.length - 1].name;

          // The cap is relative to "From". When From is Release (or not yet resolved), the cap
          // does not apply — descend fully. (Releases are out of scope for this control.)
          const fromType = this.primaryIssueType;
          const fromIndex = hierarchy.findIndex((level) => level.name === fromType);
          if (fromType === 'Release' || fromIndex === -1) {
            resolve(deepest);
            return;
          }

          const curParamValue = getParamValue();
          if (curParamValue) {
            const toIndex = hierarchy.findIndex((level) => level.name === curParamValue);
            // Valid only when present AND at or below "From" (clamp: To is never above From).
            if (toIndex !== -1 && toIndex >= fromIndex) {
              resolve(curParamValue);
              return;
            }
          }

          // Absent or invalid ⇒ deepest (full hierarchy). Deliberately no writeUrlParam here, so
          // the param does not re-add itself when cleared.
          resolve(deepest);
        };

        // Only an explicit user selection persists to the URL.
        listenTo(lastSet, (value) => {
          writeUrlParam(value);
        });

        resolveCurrentValue();
      },
    },

    primaryReportBreakdown: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'primaryReportBreakdown',
      false,
      Boolean,
      booleanParsing,
    ),
    openAutoSchedulerModal: {
      type: Boolean,
      defaultValue: false,
    },
    secondaryReportType: saveJSONToUrlButAlsoLookAtReport_DataWrapper('secondaryReportType', 'none', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    // TEST
    showPercentComplete: saveJSONToUrl('showPercentComplete', false, Boolean, booleanParsing),
    // Focus/"fullscreen" mode — hides top nav, left sidebar, and report chrome (spec-less,
    // see FullscreenToggle). Plain URL flag, not tied to saved-report data, so it's
    // bookmarkable but doesn't get baked into saved reports.
    fullscreen: saveJSONToUrl('fullscreen', false, Boolean, booleanParsing),
    sortByDueDate: saveJSONToUrlButAlsoLookAtReport_DataWrapper('sortByDueDate', false, Boolean, booleanParsing),
    hideUnknownInitiatives: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'hideUnknownInitiatives',
      false,
      Boolean,
      booleanParsing,
    ),
    showOnlySemverReleases: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'showOnlySemverReleases',
      false,
      Boolean,
      booleanParsing,
    ),
    statusesToShow: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('statusesToShow'),
    statusesToRemove: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('statusesToRemove'),
    // Generic filter-row control (spec/007-secondary-improvements/filter-changed-and-blocked).
    // Raw, persisted state — empty until the user adds a row. See `effectiveFilterRows` below for
    // the legacy `statusesToShow`/`statusesToRemove` migration read by the actual filtering logic.
    filterRows: saveJSONToUrlButAlsoLookAtReport_DataWrapper('filterRows', [], Array, JSON),
    // Independent filter-row state for the secondary (Work Breakdown) report's own Filters
    // control. No legacy migration needed — this param is new.
    secondaryFilterRows: saveJSONToUrlButAlsoLookAtReport_DataWrapper('secondaryFilterRows', [], Array, JSON),
    // A second, independent filter-row state scoped to the Work Breakdown's CHILD issue type.
    // Decides which children (if any) render within an already-shown card — doesn't affect
    // whether the card itself shows (that's `secondaryFilterRows`, above).
    secondaryChildFilterRows: saveJSONToUrlButAlsoLookAtReport_DataWrapper('secondaryChildFilterRows', [], Array, JSON),
    // If `filterRows` is empty/unset, seed an equivalent `Jira Status` row from the legacy
    // `statusesToShow`/`statusesToRemove` params so old bookmarks/saved reports keep filtering.
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
    planningStatuses: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('planningStatuses'),
    releasesToShow: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('releasesToShow'),
    fields: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('fields'),

    // GroupingReport routing properties
    rowGroup: saveJSONToUrlButAlsoLookAtReport_DataWrapper('rowGroup', 'projectKey', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    colGroup: saveJSONToUrlButAlsoLookAtReport_DataWrapper('colGroup', 'dueInMonth', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    aggregators: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('aggregators', () => ['issuesList']),

    // GroupBy is not available for release ... so if a release primaryIssueType is set
    // then we need to remove it
    groupBy: makeParamAndReportDataReducer({
      key: 'groupBy',
      defaultValue: '',

      parse: (x) => '' + x,
      stringify: (x) => '' + x,

      listeners: {
        primaryIssueType({ state, updateUrlParam }, { value }) {
          const primaryIssueType = value;
          if (primaryIssueType === 'Release') {
            updateUrlParam('', '');
          } else {
            // if it changes to something else .... keep it ... not sure why this is even needed
            updateUrlParam(state.urlParamValue, state.reportParamValue || '');
          }
        },
      },
    }),

    // Table report (`table2`, spec/012-table-and-grouper Phase 5) routing properties. These are new,
    // namespaced with a `table` prefix so they never collide with the legacy Grouper keys
    // (`fields`/`rowGroup`/`colGroup`/`aggregators`) — no legacy migration (plan Q2). Ephemeral UI
    // toggles (expand/collapse of tree rows and groups) are NOT persisted; they stay local React state.
    //
    // `tableColumns` is the ordered shown-column list. Each entry is `{ sourceId, aggregation?, width? }`
    // — the per-column aggregation override folds into the entry (no separate map). Default = the
    // combined "Icon & Summary" tree column.
    tableColumns: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'tableColumns',
      [{ sourceId: 'identity:treeSummary' }],
      Array,
      JSON,
    ),
    // Active column sort. Empty `tableSortColumn` means no sort (SortState === null). Row ordering is
    // a property of the tree column's sort: `tableSortDir === 'tree'` on a tree-capable column nests
    // the rows (no separate row-ordering key). Default = the tree column in Hierarchy mode.
    tableSortColumn: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableSortColumn', 'identity:treeSummary', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    tableSortDir: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableSortDir', 'tree', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    // Per-column filter state — a `columnId → FilterValue` map (JSON object).
    tableFilters: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableFilters', {}, Object, JSON),
    // 1D/2D grouping column ids. Empty string means ungrouped / no column dimension (null).
    tableGroupBy: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableGroupBy', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    tableGroupByCol: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableGroupByCol', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    // Date-bucket granularity ('day' | 'week' | 'month' | 'quarter' | 'year') for the corresponding
    // `tableGroupBy`/`tableGroupByCol` column, when that column is a date/datetime field. Empty
    // string means "not set" — the report defaults an unset granularity to 'day' for date columns
    // (spec/012-table-and-grouper/date-bucket-grouping.md) so old saved links never regress to
    // raw-timestamp grouping. Ignored entirely for non-date group columns.
    tableGroupByGranularity: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableGroupByGranularity', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    tableGroupByColGranularity: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableGroupByColGranularity', '', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    // Cross-tab fields axis: 'rows' (each measure a sub-row) | 'cols' (measures as sub-columns).
    tableFieldAxis: saveJSONToUrlButAlsoLookAtReport_DataWrapper('tableFieldAxis', 'rows', String, {
      parse: (x) => '' + x,
      stringify: (x) => '' + x,
    }),
    // Cross-tab totals visibility — independent toggles, both default off (totals used to always
    // show; now opt-in). Row totals = the right-edge "Total" column (sum across each row); column
    // totals = the bottom "Total" row (sum down each column).
    tableShowRowTotals: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'tableShowRowTotals',
      false,
      Boolean,
      booleanParsing,
    ),
    tableShowColTotals: saveJSONToUrlButAlsoLookAtReport_DataWrapper(
      'tableShowColTotals',
      false,
      Boolean,
      booleanParsing,
    ),

    // Scatter Plot (`due` report) — due-date range filter. Empty string means unbounded on
    // that side. Namespaced `scatter*` because the range is scatter-only for now (see
    // spec/004-scatter-improvements/date-range.md).
    scatterDateRangeStart: saveJSONToUrlButAlsoLookAtReport_DataWrapper('scatterDateRangeStart', '', String, {
      parse: (x) => (isValidIsoDateString('' + x) ? '' + x : ''),
      stringify: (x) => '' + x,
    }),
    scatterDateRangeEnd: saveJSONToUrlButAlsoLookAtReport_DataWrapper('scatterDateRangeEnd', '', String, {
      parse: (x) => (isValidIsoDateString('' + x) ? '' + x : ''),
      stringify: (x) => '' + x,
    }),

    // Flow Metrics report settings
    flowMetricsCycleTimeRange: saveJSONToUrlButAlsoLookAtReport_DataWrapper('flowMetricsCycleTimeRange', 30, Number, {
      parse: Number,
      stringify: (x) => '' + x,
    }),
    flowMetricsStatusFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('flowMetricsStatusFilter'),
    flowMetricsIssueTypeFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('flowMetricsIssueTypeFilter'),
    flowMetricsProjectFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('flowMetricsProjectFilter'),
    flowMetricsTeamFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('flowMetricsTeamFilter'),

    // Time in Status report settings
    timeInStatusDateRange: saveJSONToUrlButAlsoLookAtReport_DataWrapper('timeInStatusDateRange', 30, Number, {
      parse: Number,
      stringify: (x) => '' + x,
    }),
    timeInStatusStatusFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('timeInStatusStatusFilter'),
    timeInStatusIssueTypeFilter:
      makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('timeInStatusIssueTypeFilter'),
    timeInStatusProjectFilter: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData('timeInStatusProjectFilter'),
    timeInStatusReorder: saveJSONToUrlButAlsoLookAtReport_DataWrapper('timeInStatusReorder', undefined, type.Any, {
      parse: (value) => {
        if (!value) return undefined;
        try {
          const parsed = JSON.parse(value);
          return parsed && typeof parsed === 'object' ? parsed : undefined;
        } catch {
          return undefined;
        }
      },
      stringify: (value) => (value ? JSON.stringify(value) : ''),
    }),
  };
}

const routeData = new RouteData();

export default routeData;
